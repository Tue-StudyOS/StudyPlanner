from __future__ import annotations

from typing import Any

from db.d1 import fetch_all, fetch_one


def _safe_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_ects(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


async def list_regulation_versions(env: Any) -> list[dict[str, Any]]:
    sql = """
        SELECT
            rv.id,
            rv.code,
            rv.version_label AS versionLabel,
            rv.total_ects AS totalEcts,
            rv.language,
            rv.source_status AS sourceStatus,
            rv.notes,
            er.code AS regulationCode,
            er.name AS regulationName,
            er.degree,
            er.subject,
            COUNT(DISTINCT rrg.id) AS ruleGroupCount,
            COUNT(DISTINCT rcm.course_id) AS mappedCourseCount
        FROM regulation_versions AS rv
        JOIN examination_regulations AS er ON er.id = rv.regulation_id
        LEFT JOIN regulation_rule_groups AS rrg ON rrg.regulation_version_id = rv.id
        LEFT JOIN regulation_course_mappings AS rcm ON rcm.regulation_version_id = rv.id
        GROUP BY
            rv.id,
            rv.code,
            rv.version_label,
            rv.total_ects,
            rv.language,
            rv.source_status,
            rv.notes,
            er.code,
            er.name,
            er.degree,
            er.subject
        ORDER BY er.degree ASC, er.subject ASC, rv.version_label ASC
    """
    return await fetch_all(env, sql)


async def get_regulation_version(env: Any, regulation_version_code: str) -> dict[str, Any] | None:
    version_sql = """
        SELECT
            rv.id,
            rv.code,
            rv.version_label AS versionLabel,
            rv.total_ects AS totalEcts,
            rv.language,
            rv.source_status AS sourceStatus,
            rv.notes,
            er.code AS regulationCode,
            er.name AS regulationName,
            er.degree,
            er.subject
        FROM regulation_versions AS rv
        JOIN examination_regulations AS er ON er.id = rv.regulation_id
        WHERE rv.code = ?
        LIMIT 1
    """
    version = await fetch_one(env, version_sql, [regulation_version_code])
    if version is None:
        return None

    rule_groups_sql = """
        SELECT
            rrg.id,
            rrg.code,
            rrg.name,
            rrg.group_type AS groupType,
            rrg.required_ects AS requiredEcts,
            rrg.min_ects AS minEcts,
            rrg.max_ects AS maxEcts,
            rrg.sort_order AS sortOrder,
            rrg.notes,
            sa.code AS studyAreaCode,
            sa.name AS studyAreaName,
            COUNT(DISTINCT rcm.course_id) AS mappedCourseCount
        FROM regulation_rule_groups AS rrg
        LEFT JOIN study_areas AS sa ON sa.id = rrg.study_area_id
        LEFT JOIN regulation_course_mappings AS rcm ON rcm.rule_group_id = rrg.id
        WHERE rrg.regulation_version_id = ?
        GROUP BY
            rrg.id,
            rrg.code,
            rrg.name,
            rrg.group_type,
            rrg.required_ects,
            rrg.min_ects,
            rrg.max_ects,
            rrg.sort_order,
            rrg.notes,
            sa.code,
            sa.name
        ORDER BY rrg.sort_order ASC, rrg.code ASC
    """
    rule_groups = await fetch_all(env, rule_groups_sql, [version["id"]])

    return {
        **version,
        "ruleGroups": rule_groups,
    }


async def list_regulation_course_categories(
    env: Any,
    regulation_version_code: str,
    limit: int = 100,
    search: str | None = None,
) -> list[dict[str, Any]]:
    safe_limit = max(1, min(limit, 200))
    course_id_sql = """
        SELECT DISTINCT
            c.id,
            COALESCE(c.number, c.unit_id) AS sortKey,
            c.title
        FROM regulation_course_mappings AS rcm
        JOIN regulation_versions AS rv ON rv.id = rcm.regulation_version_id
        JOIN courses AS c ON c.id = rcm.course_id
        WHERE rv.code = ?
    """
    params: list[Any] = [regulation_version_code]
    normalized_search = _safe_text(search)
    if normalized_search:
        like_value = f"%{normalized_search}%"
        course_id_sql += """
          AND (
              COALESCE(c.number, '') LIKE ?
              OR c.title LIKE ?
          )
        """
        params.extend([like_value, like_value])

    course_id_sql += """
        ORDER BY sortKey ASC, c.title ASC
        LIMIT ?
    """
    params.append(safe_limit)

    course_rows = await fetch_all(env, course_id_sql, params)
    if not course_rows:
        return []

    course_ids = [int(row["id"]) for row in course_rows]
    placeholders = ", ".join("?" for _ in course_ids)

    mapping_rows = await fetch_all(
        env,
        f"""
        SELECT
            c.id AS courseId,
            COALESCE(c.number, c.unit_id) AS number,
            c.title,
            c.course_type AS courseType,
            c.offering_frequency AS offeringFrequency,
            c.semester_hours AS semesterHours,
            rg.code AS ruleGroupCode,
            rg.name AS ruleGroupName,
            rg.group_type AS groupType,
            rcm.status,
            rcm.ects_counted AS ectsCounted,
            rcm.match_type AS matchType,
            cm.module_code AS moduleCode,
            cm.title AS moduleTitle
        FROM regulation_course_mappings AS rcm
        JOIN regulation_versions AS rv ON rv.id = rcm.regulation_version_id
        JOIN courses AS c ON c.id = rcm.course_id
        JOIN regulation_rule_groups AS rg ON rg.id = rcm.rule_group_id
        LEFT JOIN curriculum_modules AS cm ON cm.id = rcm.module_id
        WHERE rv.code = ?
          AND c.id IN ({placeholders})
        ORDER BY c.title ASC, rg.sort_order ASC, rg.code ASC
        """,
        [regulation_version_code, *course_ids],
    )

    by_course_id: dict[int, dict[str, Any]] = {}
    for row in mapping_rows:
        course_id = int(row["courseId"])
        course_entry = by_course_id.setdefault(
            course_id,
            {
                "id": str(course_id),
                "number": _safe_text(row.get("number")) or "",
                "title": _safe_text(row.get("title")) or "Untitled course",
                "courseType": _safe_text(row.get("courseType")) or "",
                "frequency": _safe_text(row.get("offeringFrequency")) or "",
                "sws": _normalize_ects(row.get("semesterHours")),
                "regulationCategories": [],
            },
        )
        course_entry["regulationCategories"].append(
            {
                "code": _safe_text(row.get("ruleGroupCode")) or "",
                "name": _safe_text(row.get("ruleGroupName")) or "",
                "groupType": _safe_text(row.get("groupType")) or "study_area",
                "status": _safe_text(row.get("status")) or "allowed",
                "ectsCounted": _normalize_ects(row.get("ectsCounted")),
                "matchType": _safe_text(row.get("matchType")) or "curriculum_match",
                "moduleCode": _safe_text(row.get("moduleCode")),
                "moduleTitle": _safe_text(row.get("moduleTitle")),
            }
        )

    ordered_courses: list[dict[str, Any]] = []
    for course_row in course_rows:
        course_id = int(course_row["id"])
        if course_id in by_course_id:
            ordered_courses.append(by_course_id[course_id])
    return ordered_courses

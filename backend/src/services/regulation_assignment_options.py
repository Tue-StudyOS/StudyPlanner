from __future__ import annotations

from typing import Any

from db.d1 import fetch_all


def safe_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalize_study_area_code(value: Any) -> str | None:
    normalized_value = safe_text(value)
    return normalized_value.upper() if normalized_value else None


def normalize_optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


async def load_regulation_rule_groups(
    env: Any,
    regulation_version_id: int | None,
) -> dict[str, dict[str, Any]]:
    if regulation_version_id is None:
        return {}

    rows = await fetch_all(
        env,
        """
        SELECT
            code,
            name,
            group_type AS groupType,
            required_ects AS requiredEcts,
            max_ects AS maxEcts,
            sort_order AS sortOrder
        FROM regulation_rule_groups
        WHERE regulation_version_id = ?
        ORDER BY sort_order ASC, code ASC
        """,
        [regulation_version_id],
    )

    rule_groups: dict[str, dict[str, Any]] = {}
    for row in rows:
        code = normalize_study_area_code(row.get('code'))
        if not code:
            continue
        rule_groups[code] = {
            **row,
            'code': code,
            'name': safe_text(row.get('name')),
            'groupType': safe_text(row.get('groupType')),
            'requiredEcts': normalize_optional_float(row.get('requiredEcts')),
            'maxEcts': normalize_optional_float(row.get('maxEcts')),
            'sortOrder': int(row.get('sortOrder') or 0),
        }
    return rule_groups


async def load_regulation_course_options(
    env: Any,
    regulation_version_id: int | None,
    course_ids: list[int],
    *,
    allowed_only: bool = False,
) -> dict[int, list[dict[str, Any]]]:
    if regulation_version_id is None or not course_ids:
        return {}

    unique_course_ids = list(dict.fromkeys(course_ids))
    placeholders = ', '.join('?' for _ in unique_course_ids)
    status_filter = "AND rcm.status = 'allowed'" if allowed_only else ''
    rows = await fetch_all(
        env,
        f"""
        SELECT
            rcm.course_id AS courseId,
            rrg.code AS studyAreaCode,
            rrg.name AS studyAreaName,
            rrg.group_type AS groupType,
            rrg.sort_order AS sortOrder,
            rcm.ects_counted AS ectsCounted
        FROM regulation_course_mappings AS rcm
        JOIN regulation_rule_groups AS rrg ON rrg.id = rcm.rule_group_id
        WHERE rcm.regulation_version_id = ?
          AND rcm.course_id IN ({placeholders})
          {status_filter}
        ORDER BY rcm.course_id ASC, rrg.sort_order ASC, rrg.code ASC
        """,
        [regulation_version_id, *unique_course_ids],
    )

    options_by_course_id: dict[int, list[dict[str, Any]]] = {}
    seen_options: set[tuple[int, str]] = set()
    for row in rows:
        course_id = int(row['courseId'])
        study_area_code = normalize_study_area_code(row.get('studyAreaCode'))
        if not study_area_code:
            continue
        option_key = (course_id, study_area_code)
        if option_key in seen_options:
            continue
        seen_options.add(option_key)
        options_by_course_id.setdefault(course_id, []).append(
            {
                'courseId': course_id,
                'studyAreaCode': study_area_code,
                'studyAreaName': safe_text(row.get('studyAreaName')),
                'groupType': safe_text(row.get('groupType')),
                'sortOrder': int(row.get('sortOrder') or 0),
                'ectsCounted': normalize_optional_float(row.get('ectsCounted')),
            }
        )
    return options_by_course_id

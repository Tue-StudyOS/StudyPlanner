"""Credit-assignment ("Anrechnung") optimizer for completed courses.

Completed courses that can count toward more than one regulation area carry a
free choice. This module searches for an assignment that covers more PO areas and
credits more ECTS than the current one, so the editor can offer it per button.

The objective is lexicographic and intentionally tunable:
  1. maximize the number of covered areas (an area is covered once its credited
     ECTS reaches the area's required ECTS),
  2. then maximize total credited ECTS (capped at each area's requirement),
  3. then a light grade-quality tilt so good grades fill required areas first.

The module is pure (no DB/network) so it can be unit-tested directly.
"""

from __future__ import annotations

from typing import Any

# A move is only worth searching when a course can land in more than one area;
# bounding the local search keeps it cheap for the small course counts involved.
_MAX_LOCAL_SEARCH_PASSES = 50


def _grade_quality_multiplier(grade: float | None) -> float:
    if grade is None:
        return 1.0
    clamped_grade = max(1.0, min(4.0, grade))
    return max(0.85, 1.05 - (clamped_grade - 1.0) * 0.06)


def _required_ects_by_area(rule_groups: list[dict[str, Any]]) -> dict[str, float]:
    required: dict[str, float] = {}
    for rule_group in rule_groups:
        code = rule_group.get('code')
        if not code:
            continue
        try:
            required[str(code)] = float(rule_group.get('requiredEcts') or 0.0)
        except (TypeError, ValueError):
            required[str(code)] = 0.0
    return required


def _objective(
    assignment: dict[str, str],
    courses_by_id: dict[str, dict[str, Any]],
    required_by_area: dict[str, float],
) -> tuple[int, float, float]:
    earned_by_area: dict[str, float] = {}
    for course_id, area_code in assignment.items():
        course = courses_by_id[course_id]
        earned_by_area[area_code] = earned_by_area.get(area_code, 0.0) + float(course.get('ects') or 0.0)

    covered_areas = 0
    credited_ects = 0.0
    for area_code, earned in earned_by_area.items():
        required = required_by_area.get(area_code, 0.0)
        if required > 0:
            credited_ects += min(earned, required)
            if earned >= required - 1e-9:
                covered_areas += 1
        else:
            credited_ects += earned

    quality = 0.0
    for course_id, area_code in assignment.items():
        if required_by_area.get(area_code, 0.0) > 0:
            quality += _grade_quality_multiplier(courses_by_id[course_id].get('grade'))

    return (covered_areas, round(credited_ects, 3), round(quality, 3))


def _baseline_area(course: dict[str, Any]) -> str | None:
    """The area a course counts toward today: its explicit choice, otherwise the
    primary (first, sort-ordered) candidate — mirroring the progress fallback."""
    candidates = [str(code) for code in course.get('candidateAreaCodes') or [] if code]
    current = course.get('currentAreaCode')
    if current and str(current) in candidates:
        return str(current)
    return candidates[0] if candidates else None


def optimize_anrechnung(
    courses: list[dict[str, Any]],
    rule_groups: list[dict[str, Any]],
) -> dict[str, Any]:
    required_by_area = _required_ects_by_area(rule_groups)
    courses_by_id = {str(course['id']): course for course in courses}

    baseline: dict[str, str] = {}
    for course in courses:
        area = _baseline_area(course)
        if area is not None:
            baseline[str(course['id'])] = area

    assignment = dict(baseline)
    for _ in range(_MAX_LOCAL_SEARCH_PASSES):
        improved = False
        for course in courses:
            course_id = str(course['id'])
            candidates = [str(code) for code in course.get('candidateAreaCodes') or [] if code]
            if len(candidates) <= 1:
                continue
            best_area = assignment.get(course_id)
            best_objective = _objective(assignment, courses_by_id, required_by_area)
            for area_code in candidates:
                if area_code == assignment.get(course_id):
                    continue
                trial = dict(assignment)
                trial[course_id] = area_code
                trial_objective = _objective(trial, courses_by_id, required_by_area)
                if trial_objective > best_objective:
                    best_objective = trial_objective
                    best_area = area_code
            if best_area is not None and best_area != assignment.get(course_id):
                assignment[course_id] = best_area
                improved = True
        if not improved:
            break

    before_covered, before_credited, _ = _objective(baseline, courses_by_id, required_by_area)
    after_covered, after_credited, _ = _objective(assignment, courses_by_id, required_by_area)

    changes = [
        {
            'completedCourseId': course_id,
            'fromAreaCode': baseline.get(course_id),
            'toAreaCode': assignment[course_id],
        }
        for course_id in assignment
        if assignment[course_id] != baseline.get(course_id)
    ]

    has_improvement = (after_covered, after_credited) > (before_covered, before_credited) and bool(changes)

    return {
        'baseline': baseline,
        'assignment': assignment,
        'changes': changes,
        'before': {'coveredAreas': before_covered, 'creditedEcts': before_credited},
        'after': {'coveredAreas': after_covered, 'creditedEcts': after_credited},
        'gainedAreas': after_covered - before_covered,
        'gainedEcts': round(after_credited - before_credited, 3),
        'hasImprovement': has_improvement,
    }

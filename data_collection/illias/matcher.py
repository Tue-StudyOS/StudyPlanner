from __future__ import annotations

import re
import sqlite3
import unicodedata
from collections import defaultdict
from collections.abc import Iterable
from pathlib import Path

from .models import AlmaCourseCandidate, CourseMatch, IliasCourse
from .scraper import COURSE_CODE_RE


STOPWORDS = {
    "and",
    "der",
    "die",
    "das",
    "ein",
    "eine",
    "for",
    "für",
    "im",
    "in",
    "of",
    "praktikum",
    "seminar",
    "the",
    "und",
    "vorlesung",
    "zu",
}
TITLE_VARIANT_SPLIT_RE = re.compile(r"\s+(?:/|\||-|–|—)\s+")


def load_alma_candidates(alma_db_path: Path, *, period_label: str | None = None) -> list[AlmaCourseCandidate]:
    connection = sqlite3.connect(alma_db_path)
    connection.row_factory = sqlite3.Row
    period_sql = "COALESCE(json_extract(c.raw_json, '$.period_label'), c.period_id)"
    where = ""
    params: list[str] = []
    if period_label:
        where = f"WHERE {period_sql} = ?"
        params.append(period_label)
    rows = connection.execute(
        f"""
        SELECT c.id, c.number, c.title, c.period_id, {period_sql} AS period_label,
               l.display_name AS lecturer
        FROM courses AS c
        LEFT JOIN course_lecturers AS cl ON cl.course_id = c.id
        LEFT JOIN lecturers AS l ON l.id = cl.lecturer_id
        {where}
        ORDER BY c.id
        """,
        params,
    ).fetchall()
    by_id: dict[int, AlmaCourseCandidate] = {}
    for row in rows:
        course_id = int(row["id"])
        candidate = by_id.get(course_id)
        if candidate is None:
            candidate = AlmaCourseCandidate(
                course_id=course_id,
                number=row["number"],
                title=row["title"],
                period_id=row["period_id"],
                period_label=row["period_label"],
            )
            by_id[course_id] = candidate
        if row["lecturer"]:
            candidate.lecturers.append(row["lecturer"])
    return list(by_id.values())


def match_courses(
    illias_courses: list[IliasCourse],
    alma_candidates: list[AlmaCourseCandidate],
) -> list[CourseMatch]:
    by_number: dict[str, list[AlmaCourseCandidate]] = defaultdict(list)
    for candidate in alma_candidates:
        if candidate.number:
            by_number[normalize_code(candidate.number)].append(candidate)

    matches: list[CourseMatch] = []
    for course in illias_courses:
        codes = extract_codes(course)
        code_candidates = _unique_candidates(
            candidate
            for code in codes
            for candidate in by_number.get(normalize_code(code), [])
        )
        if len(code_candidates) == 1:
            candidate = code_candidates[0]
            matches.append(
                CourseMatch(course.ref_id, candidate.course_id, 1.0, "exact_course_number", "Matched exact course code.", 1)
            )
            continue
        if len(code_candidates) > 1:
            narrowed = _narrow_by_people(course, code_candidates)
            if len(narrowed) == 1:
                matches.append(
                    CourseMatch(course.ref_id, narrowed[0].course_id, 0.95, "course_number_and_lecturer", "Exact code narrowed by lecturer.", len(code_candidates))
                )
                continue
            matches.append(
                CourseMatch(course.ref_id, None, 0.0, "ambiguous_course_number", "Multiple ALMA courses share the extracted code.", len(code_candidates))
            )
            continue

        title_candidates = _title_candidates(course, alma_candidates)
        narrowed = _narrow_by_people(course, title_candidates)
        if len(title_candidates) == 1:
            matches.append(
                CourseMatch(course.ref_id, title_candidates[0].course_id, 0.74, "title_similarity", "Single strong title match.", 1)
            )
        elif len(narrowed) == 1:
            matches.append(
                CourseMatch(course.ref_id, narrowed[0].course_id, 0.82, "title_and_lecturer", "Title similarity narrowed by lecturer.", len(title_candidates))
            )
        elif title_candidates:
            matches.append(
                CourseMatch(course.ref_id, None, 0.0, "ambiguous_title", "Several ALMA courses have similar titles; no safe automatic match.", len(title_candidates))
            )
        else:
            matches.append(
                CourseMatch(course.ref_id, None, 0.0, "unmatched", "No exact code or strong title/person match found.", 0)
            )
    return matches


def extract_codes(course: IliasCourse) -> list[str]:
    values = [course.title, course.raw_text, *course.tags]
    seen: set[str] = set()
    codes: list[str] = []
    for value in values:
        for match in COURSE_CODE_RE.findall(value or ""):
            normalized = normalize_code(match)
            if normalized not in seen:
                seen.add(normalized)
                codes.append(match)
    return codes


def normalize_code(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def normalize_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    asciiish = "".join(character for character in decomposed if not unicodedata.combining(character))
    return re.sub(r"[^a-z0-9äöüß]+", " ", asciiish).strip()


def title_tokens(value: str) -> set[str]:
    value = re.sub(r"\([^)]*\)", " ", value)
    return {
        token
        for token in normalize_text(value).split()
        if (
            len(token) >= 4
            and token not in STOPWORDS
            and not token.isdigit()
            and not (
                any(character.isalpha() for character in token)
                and any(character.isdigit() for character in token)
            )
        )
    }


def title_token_variants(value: str) -> list[set[str]]:
    variants: list[set[str]] = []
    for part in [value, *TITLE_VARIANT_SPLIT_RE.split(value)]:
        tokens = title_tokens(part)
        if tokens and tokens not in variants:
            variants.append(tokens)
    return variants


def _title_candidates(
    course: IliasCourse,
    alma_candidates: list[AlmaCourseCandidate],
) -> list[AlmaCourseCandidate]:
    source_variants = title_token_variants(course.title)
    if not source_variants:
        return []
    scored: list[tuple[float, AlmaCourseCandidate]] = []
    for candidate in alma_candidates:
        candidate_variants = title_token_variants(candidate.title)
        if not candidate_variants:
            continue
        best_score = 0.0
        for source_tokens in source_variants:
            for candidate_tokens in candidate_variants:
                overlap = len(source_tokens & candidate_tokens)
                score = overlap / max(len(source_tokens), len(candidate_tokens))
                if _is_strong_title_score(score, overlap, source_tokens, candidate_tokens):
                    best_score = max(best_score, score)
        if best_score:
            scored.append((best_score, candidate))
    scored.sort(key=lambda item: (-item[0], item[1].course_id))
    if not scored:
        return []
    best_score = scored[0][0]
    return [candidate for score, candidate in scored if best_score - score <= 0.12]


def _is_strong_title_score(
    score: float,
    overlap: int,
    source_tokens: set[str],
    candidate_tokens: set[str],
) -> bool:
    if score >= 0.55 and overlap >= 2:
        return True
    return score >= 0.9 and overlap >= 1 and min(len(source_tokens), len(candidate_tokens)) <= 2


def _narrow_by_people(
    course: IliasCourse,
    candidates: list[AlmaCourseCandidate],
) -> list[AlmaCourseCandidate]:
    if not course.instructors:
        return candidates
    people = [person for person in (normalize_person(person) for person in course.instructors) if person]
    narrowed = [
        candidate
        for candidate in candidates
        if any(
            people_match(source_person, candidate_person)
            for source_person in people
            for candidate_person in (normalize_person(person) for person in candidate.lecturers)
            if candidate_person
        )
    ]
    return narrowed or candidates


def normalize_person(value: str) -> str:
    text = normalize_text(value)
    parts = [part for part in text.split() if len(part) > 1 and part not in {"prof", "dr"}]
    return " ".join(parts[-2:])


def people_match(source_person: str, candidate_person: str) -> bool:
    if source_person == candidate_person:
        return True
    source_parts = source_person.split()
    candidate_parts = set(candidate_person.split())
    return bool(source_parts and source_parts[-1] in candidate_parts)


def _unique_candidates(candidates: Iterable[AlmaCourseCandidate]) -> list[AlmaCourseCandidate]:
    by_id: dict[int, AlmaCourseCandidate] = {}
    for candidate in candidates:
        by_id[candidate.course_id] = candidate
    return list(by_id.values())

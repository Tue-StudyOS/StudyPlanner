from __future__ import annotations

import json
import re
import sqlite3
import unicodedata
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


COURSE_CODE_RE = re.compile(
    r"\b(?:BIOINF|MDZINF|MEDZ|INFO|INFM|INFL|INF|ML)\s*[-./]?\s*"
    r"[A-Z]*\d{2,}[A-Z0-9./-]*\b",
    re.IGNORECASE,
)
ROMAN_TOKENS = {"i", "ii", "iii", "iv", "v", "vi"}
SUMMER_PERIOD_RE = re.compile(r"\b(?:sose|ss|sommer)\s*'?(?:20)?(\d{2})\b", re.IGNORECASE)
WINTER_PERIOD_RE = re.compile(r"\b(?:wise|ws|winter)\s*'?(?:20)?(\d{2})(?:\s*/?\s*(\d{2}))?\b", re.IGNORECASE)
STOPWORDS = {
    "and",
    "course",
    "der",
    "die",
    "das",
    "des",
    "for",
    "frueher",
    "fruher",
    "fuer",
    "für",
    "in",
    "informatik",
    "intro",
    "praktikum",
    "proseminar",
    "seminar",
    "sose",
    "sommer",
    "ss",
    "the",
    "und",
    "ubung",
    "uebung",
    "übung",
    "vorlesung",
    "winter",
    "wise",
    "ws",
    "zur",
}
TYPE_KEYWORDS = {
    "praktikum": "praktikum",
    "practical": "praktikum",
    "lab": "praktikum",
    "seminar": "seminar",
    "proseminar": "proseminar",
    "lecture": "vorlesung",
    "vorlesung": "vorlesung",
    "ubung": "uebung",
    "uebung": "uebung",
    "übung": "uebung",
}
TOKEN_SYNONYMS = {
    "roboter": "robot",
    "roboters": "robot",
    "robotic": "robot",
    "robotics": "robot",
    "robots": "robot",
}
PERIOD_LABEL_TO_ID = {
    "sommer 2026": "229",
    "winter 2025 26": "236",
    "sommer 2025": "235",
    "winter 2024 25": "234",
    "sommer 2024": "227",
    "winter 2023 24": "226",
    "sommer 2023": "225",
}


@dataclass(slots=True)
class AlmaCourseCandidate:
    course_id: int
    number: str | None
    title: str
    period_id: str | None
    period_label: str | None
    course_type: str | None
    lecturers: list[str]
    organisation: str | None


@dataclass(slots=True)
class MoodleMatch:
    moodle_course_id: str
    moodle_title: str
    course_id: int | None
    course_number: str | None
    course_title: str | None
    period_id: str | None
    match_method: str
    confidence: float
    status: str
    evidence: dict[str, Any]


def match_moodle_courses(
    moodle_courses: list[dict[str, Any]],
    alma_candidates: list[AlmaCourseCandidate],
) -> list[MoodleMatch]:
    return [match_one_moodle_course(course, alma_candidates) for course in moodle_courses]


def match_one_moodle_course(
    moodle_course: dict[str, Any],
    alma_candidates: list[AlmaCourseCandidate],
) -> MoodleMatch:
    preferred_period_label = infer_period_label(str(moodle_course.get("title") or ""))
    scoped_candidates = scope_candidates_by_period(alma_candidates, preferred_period_label)
    title_codes = extract_course_codes(str(moodle_course.get("title") or ""))
    all_codes = extract_course_codes(
        f"{moodle_course.get('title') or ''} {moodle_course.get('summary_text') or ''}"
    )
    if title_codes:
        code_candidates = [
            candidate
            for candidate in scoped_candidates
            if course_codes_overlap(title_codes, candidate_code_variants(candidate))
        ]
        if code_candidates:
            return pick_best_candidate(
                moodle_course,
                code_candidates,
                method="exact_code",
                force_review=False,
                base_confidence=0.94,
            )
        match = pick_best_candidate(
            moodle_course,
            scoped_candidates,
            method="title_after_title_code_miss",
            force_review=False,
            base_confidence=0.0,
        )
        match.evidence["detectedTitleCodes"] = title_codes
        if preferred_period_label:
            match.evidence["preferredPeriodLabel"] = preferred_period_label
        return match

    match = pick_best_candidate(
        moodle_course,
        scoped_candidates,
        method="title_lecturer",
        force_review=False,
        base_confidence=0.0,
    )
    if all_codes:
        match.evidence["detectedSummaryCodes"] = [
            code for code in all_codes if code not in title_codes
        ]
    if preferred_period_label:
        match.evidence["preferredPeriodLabel"] = preferred_period_label
    return match


def pick_best_candidate(
    moodle_course: dict[str, Any],
    candidates: list[AlmaCourseCandidate],
    *,
    method: str,
    force_review: bool,
    base_confidence: float,
) -> MoodleMatch:
    scored = [
        (score_candidate(moodle_course, candidate, base_confidence), candidate)
        for candidate in candidates
    ]
    scored.sort(key=lambda item: item[0]["confidence"], reverse=True)
    if not scored:
        return unmatched(moodle_course, method, {"reason": "no candidates"})

    best_score, best_candidate = scored[0]
    runner_up = scored[1][0]["confidence"] if len(scored) > 1 else 0.0
    confidence = best_score["confidence"]
    margin = confidence - runner_up
    status = "accepted" if not force_review and is_auto_accepted(best_score, method, margin) else "unmatched"

    if status == "unmatched":
        return unmatched(
            moodle_course,
            method,
            {
                "bestCandidate": candidate_evidence(best_candidate),
                "confidence": confidence,
                "runnerUpConfidence": runner_up,
            },
        )

    return MoodleMatch(
        moodle_course_id=str(moodle_course.get("moodle_course_id") or ""),
        moodle_title=str(moodle_course.get("title") or ""),
        course_id=best_candidate.course_id,
        course_number=best_candidate.number,
        course_title=best_candidate.title,
        period_id=best_candidate.period_id,
        match_method=method,
        confidence=round(confidence, 4),
        status=status,
        evidence={
            "best": best_score,
            "runnerUpConfidence": round(runner_up, 4),
            "candidateCount": len(candidates),
        },
    )


def is_auto_accepted(score: dict[str, Any], method: str, margin: float) -> bool:
    confidence = float(score["confidence"])
    title_score = float(score["titleSimilarity"])
    lecturer_score = float(score["lecturerOverlap"])
    type_score = float(score["typeSimilarity"])
    moodle_type = score.get("moodleType")
    candidate_type = detect_course_type(str(score.get("candidate", {}).get("courseType") or ""))
    has_type_conflict = bool(moodle_type and candidate_type and moodle_type != candidate_type)

    if method == "exact_code":
        return confidence >= 0.90
    if has_type_conflict:
        return False
    if confidence >= 0.82 and (margin >= 0.08 or title_score >= 0.92):
        return True
    if title_score >= 0.90 and (lecturer_score > 0 or type_score > 0):
        return True
    if title_score >= 0.90 and margin >= 0.20:
        return True
    if title_score >= 0.65 and lecturer_score >= 0.95 and margin >= 0.20:
        return True
    if confidence >= 0.70 and title_score >= 0.70 and type_score > 0:
        return True
    return False


def infer_period_label(text: str) -> str | None:
    normalized = normalize_text(text)
    summer_match = SUMMER_PERIOD_RE.search(normalized)
    if summer_match:
        return f"Sommer 20{summer_match.group(1)}"
    winter_match = WINTER_PERIOD_RE.search(normalized)
    if not winter_match:
        return None
    start_year = int(winter_match.group(1))
    end_year = winter_match.group(2)
    if end_year is None:
        end_year = f"{(start_year + 1) % 100:02d}"
    return f"Winter 20{start_year:02d}/{end_year}"


def scope_candidates_by_period(
    candidates: list[AlmaCourseCandidate],
    preferred_period_label: str | None,
) -> list[AlmaCourseCandidate]:
    if not preferred_period_label:
        return candidates
    scoped = [
        candidate
        for candidate in candidates
        if candidate_matches_period(candidate, preferred_period_label)
    ]
    return scoped


def candidate_matches_period(
    candidate: AlmaCourseCandidate,
    preferred_period_label: str,
) -> bool:
    normalized_label = normalize_text(preferred_period_label)
    if normalize_text(candidate.period_label) == normalized_label:
        return True
    return candidate.period_id == PERIOD_LABEL_TO_ID.get(normalized_label)


def score_candidate(
    moodle_course: dict[str, Any],
    candidate: AlmaCourseCandidate,
    base_confidence: float,
) -> dict[str, Any]:
    title_score = title_similarity(
        str(moodle_course.get("title") or ""),
        candidate.title,
    )
    lecturer_score = lecturer_overlap(
        [str(item.get("display_name") or "") for item in moodle_course.get("teachers") or []],
        candidate.lecturers,
    )
    type_score = course_type_similarity(str(moodle_course.get("title") or ""), candidate.course_type)
    confidence = max(
        base_confidence,
        (title_score * 0.75) + (lecturer_score * 0.20) + (type_score * 0.05),
    )
    moodle_type = detect_course_type(str(moodle_course.get("title") or ""))
    candidate_type = detect_course_type(candidate.course_type or "")
    if moodle_type and candidate_type and moodle_type != candidate_type and base_confidence < 0.9:
        confidence = min(confidence, 0.78)

    return {
        "confidence": round(min(confidence, 1.0), 4),
        "titleSimilarity": round(title_score, 4),
        "lecturerOverlap": round(lecturer_score, 4),
        "typeSimilarity": round(type_score, 4),
        "moodleType": moodle_type,
        "candidate": candidate_evidence(candidate),
    }


def unmatched(moodle_course: dict[str, Any], method: str, evidence: dict[str, Any]) -> MoodleMatch:
    return MoodleMatch(
        moodle_course_id=str(moodle_course.get("moodle_course_id") or ""),
        moodle_title=str(moodle_course.get("title") or ""),
        course_id=None,
        course_number=None,
        course_title=None,
        period_id=None,
        match_method=method,
        confidence=0.0,
        status="unmatched",
        evidence=evidence,
    )


def candidate_evidence(candidate: AlmaCourseCandidate) -> dict[str, Any]:
    return {
        "courseId": candidate.course_id,
        "number": candidate.number,
        "title": candidate.title,
        "periodId": candidate.period_id,
        "periodLabel": candidate.period_label,
        "courseType": candidate.course_type,
        "lecturers": candidate.lecturers,
    }


def extract_course_codes(text: str) -> list[str]:
    codes: list[str] = []
    for match in COURSE_CODE_RE.finditer(text or ""):
        code = normalize_course_code(match.group(0))
        if code:
            codes.append(code)
    return unique_preserve_order(codes)


def normalize_course_code(value: str | None) -> str | None:
    if not value:
        return None
    normalized = re.sub(r"[^A-Za-z0-9]", "", value).upper()
    return normalized if re.search(r"\d", normalized) else None


def candidate_code_variants(candidate: AlmaCourseCandidate) -> list[str]:
    variants = extract_course_codes(candidate.number or "")
    for raw_part in re.split(r"[,;()]\s*", candidate.number or ""):
        compact = normalize_course_code(raw_part)
        if compact:
            variants.append(compact)
        suffix_match = re.match(r"^([A-Za-z]+\d+[A-Za-z]?)[-./][A-Za-z]+$", raw_part.strip())
        if suffix_match:
            base = normalize_course_code(suffix_match.group(1))
            if base:
                variants.append(base)
    return unique_preserve_order([variant for variant in variants if variant])


def course_codes_overlap(left_codes: list[str], right_codes: list[str]) -> bool:
    return bool(set(left_codes) & set(right_codes))


def title_similarity(left: str, right: str) -> float:
    left_tokens = set(title_tokens(left))
    right_tokens = set(title_tokens(right))
    if not left_tokens or not right_tokens:
        return 0.0
    intersection = left_tokens & right_tokens
    union = left_tokens | right_tokens
    jaccard = len(intersection) / len(union)
    containment = len(intersection) / min(len(left_tokens), len(right_tokens))
    return max(jaccard, containment * 0.92)


def title_tokens(value: str) -> list[str]:
    normalized = normalize_text(value)
    tokens = re.findall(r"[a-z0-9]+", normalized)
    return [
        TOKEN_SYNONYMS.get(token, token)
        for token in tokens
        if (len(token) > 2 or token in ROMAN_TOKENS) and token not in STOPWORDS
    ]


def lecturer_overlap(moodle_teachers: list[str], alma_lecturers: list[str]) -> float:
    if not moodle_teachers or not alma_lecturers:
        return 0.0
    moodle_names = {last_name(name) for name in moodle_teachers if last_name(name)}
    alma_names = {last_name(name) for name in alma_lecturers if last_name(name)}
    if not moodle_names or not alma_names:
        return 0.0
    return len(moodle_names & alma_names) / len(moodle_names)


def course_type_similarity(moodle_title: str, alma_type: str | None) -> float:
    moodle_type = detect_course_type(moodle_title)
    candidate_type = detect_course_type(alma_type or "")
    if not moodle_type or not candidate_type:
        return 0.0
    return 1.0 if moodle_type == candidate_type else 0.0


def detect_course_type(value: str) -> str | None:
    normalized = normalize_text(value)
    for token, course_type in TYPE_KEYWORDS.items():
        if re.search(rf"\b{re.escape(normalize_text(token))}\b", normalized):
            return course_type
    return None


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    decomposed = unicodedata.normalize("NFKD", value)
    without_marks = "".join(
        character for character in decomposed if not unicodedata.combining(character)
    )
    return re.sub(r"\s+", " ", re.sub(r"[^a-zA-Z0-9]+", " ", without_marks).lower()).strip()


def last_name(value: str) -> str | None:
    tokens = [
        token
        for token in normalize_text(value).split()
        if token not in {"dr", "prof", "rer", "nat", "phil", "ing", "apl", "o", "ph", "d"}
    ]
    return tokens[-1] if tokens else None


def unique_preserve_order(values: list[str]) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for value in values:
        if not value or value in seen:
            continue
        unique.append(value)
        seen.add(value)
    return unique


def load_alma_candidates(sqlite_path: Path, period_id: str | None = None) -> list[AlmaCourseCandidate]:
    connection = sqlite3.connect(sqlite_path)
    connection.row_factory = sqlite3.Row
    try:
        params: list[Any] = []
        period_filter = ""
        if period_id:
            period_filter = "AND c.period_id = ?"
            params.append(period_id)
        rows = connection.execute(
            f"""
            SELECT
                c.id,
                c.number,
                c.title,
                c.period_id,
                COALESCE(json_extract(c.raw_json, '$.period_label'), c.period_id) AS period_label,
                c.course_type,
                c.organisation,
                group_concat(DISTINCT l.display_name) AS lecturers
            FROM courses AS c
            LEFT JOIN course_lecturers AS cl ON cl.course_id = c.id
            LEFT JOIN lecturers AS l ON l.id = cl.lecturer_id
            WHERE (
                c.organisation LIKE '%Fachbereich Informatik%'
                OR c.number LIKE 'INF%'
                OR c.number LIKE 'INFO%'
                OR c.number LIKE 'INFM%'
                OR c.number LIKE 'INFL%'
                OR c.number LIKE 'ML%'
                OR c.number LIKE 'BIOINF%'
                OR c.number LIKE 'MEDZ%'
                OR c.number LIKE 'MDZINF%'
            )
            {period_filter}
            GROUP BY c.id
            """,
            params,
        ).fetchall()
    finally:
        connection.close()

    return [
        AlmaCourseCandidate(
            course_id=int(row["id"]),
            number=row["number"],
            title=row["title"],
            period_id=row["period_id"],
            period_label=row["period_label"],
            course_type=row["course_type"],
            lecturers=[
                lecturer.strip()
                for lecturer in str(row["lecturers"] or "").split(",")
                if lecturer.strip()
            ],
            organisation=row["organisation"],
        )
        for row in rows
    ]


def build_match_payload(
    moodle_payload: dict[str, Any],
    alma_candidates: list[AlmaCourseCandidate],
) -> dict[str, Any]:
    courses = []
    for course in moodle_payload.get("courses") or []:
        enriched_course = dict(course)
        enriched_course["detected_codes"] = extract_course_codes(
            str(course.get("title") or "")
        )
        courses.append(enriched_course)
    matches = match_moodle_courses(courses, alma_candidates)
    return {
        "source": {
            **(moodle_payload.get("source") or {}),
            "match_candidate_count": len(alma_candidates),
        },
        "courses": courses,
        "matches": [match_to_dict(match) for match in matches],
    }


def match_to_dict(match: MoodleMatch) -> dict[str, Any]:
    return asdict(match)


def write_json(path: Path, payload: dict[str, Any], *, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2 if pretty else None),
        encoding="utf-8",
    )

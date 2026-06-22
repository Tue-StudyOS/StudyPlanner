from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class IliasCourse:
    ref_id: str
    title: str
    url: str
    object_type: str | None = None
    description: str | None = None
    instructors: list[str] = field(default_factory=list)
    availability: str | None = None
    registration: str | None = None
    deadline: str | None = None
    max_participants: int | None = None
    tags: list[str] = field(default_factory=list)
    fields: dict[str, str] = field(default_factory=dict)
    raw_text: str = ""


@dataclass(slots=True)
class AlmaCourseCandidate:
    course_id: int
    number: str | None
    title: str
    period_id: str
    period_label: str | None
    lecturers: list[str] = field(default_factory=list)


@dataclass(slots=True)
class CourseMatch:
    illias_course_ref_id: str
    alma_course_id: int | None
    confidence: float
    match_type: str
    notes: str
    candidate_count: int

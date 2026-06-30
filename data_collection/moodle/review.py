from __future__ import annotations

import argparse
import json
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from .matching import (
    AlmaCourseCandidate,
    infer_period_label,
    load_alma_candidates,
    scope_candidates_by_period,
    score_candidate,
    write_json,
)


DEFAULT_MATCHES = Path("data_collection/output/moodle_matches.json")
DEFAULT_ALMA_DB = Path("backend/data/alma.sqlite")
DEFAULT_OVERRIDES = Path("data_collection/output/moodle_manual_overrides.json")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Review and apply manual Moodle/ALMA match overrides.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    serve = subparsers.add_parser("serve", help="Serve a local HTML review UI for unresolved Moodle matches.")
    serve.add_argument("--matches", type=Path, default=DEFAULT_MATCHES)
    serve.add_argument("--alma-db", type=Path, default=DEFAULT_ALMA_DB)
    serve.add_argument("--out", type=Path, default=DEFAULT_OVERRIDES)
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8765)
    serve.add_argument("--candidate-limit", type=int, default=8)
    serve.add_argument("--open", action="store_true", help="Open the review page in the default browser.")

    apply = subparsers.add_parser("apply", help="Apply saved manual overrides to a Moodle match JSON file.")
    apply.add_argument("--matches", type=Path, default=DEFAULT_MATCHES)
    apply.add_argument("--overrides", type=Path, default=DEFAULT_OVERRIDES)
    apply.add_argument("--out", type=Path, default=DEFAULT_MATCHES)

    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.command == "serve":
        serve_review(args)
    elif args.command == "apply":
        apply_review(args)


def serve_review(args: argparse.Namespace) -> None:
    payload = load_json(args.matches)
    candidates = load_alma_candidates(args.alma_db)
    review_model = build_review_model(payload, candidates, candidate_limit=args.candidate_limit)

    class ReviewHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.path == "/":
                self._send_text(REVIEW_HTML, "text/html; charset=utf-8")
                return
            if self.path == "/data":
                self._send_json(review_model)
                return
            self.send_error(404)

        def do_POST(self) -> None:
            if self.path != "/save":
                self.send_error(404)
                return
            length = int(self.headers.get("Content-Length") or "0")
            body = self.rfile.read(length).decode("utf-8")
            overrides = json.loads(body or "{}")
            saved_payload = {
                "source": {
                    "matches": str(args.matches),
                    "saved_at_unix": int(time.time()),
                },
                "overrides": normalize_overrides(overrides.get("overrides") or []),
            }
            args.out.parent.mkdir(parents=True, exist_ok=True)
            args.out.write_text(json.dumps(saved_payload, ensure_ascii=False, indent=2), encoding="utf-8")
            self._send_json({"ok": True, "path": str(args.out), "count": len(saved_payload["overrides"])})

        def log_message(self, format: str, *values: object) -> None:
            print(format % values)

        def _send_json(self, payload: object) -> None:
            self._send_text(json.dumps(payload, ensure_ascii=False), "application/json; charset=utf-8")

        def _send_text(self, text: str, content_type: str) -> None:
            body = text.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer((args.host, args.port), ReviewHandler)
    url = f"http://{args.host}:{args.port}/"
    print(f"Reviewing {len(review_model['unresolved'])} unresolved Moodle matches at {url}")
    print(f"Saving overrides to {args.out}")
    if args.open:
        webbrowser.open(url)
    server.serve_forever()


def apply_review(args: argparse.Namespace) -> None:
    payload = load_json(args.matches)
    overrides_payload = load_json(args.overrides)
    updated = apply_overrides(payload, normalize_overrides(overrides_payload.get("overrides") or []))
    write_json(args.out, updated, pretty=True)
    accepted = sum(1 for match in updated.get("matches") or [] if match.get("status") == "accepted")
    unmatched = sum(1 for match in updated.get("matches") or [] if match.get("status") == "unmatched")
    print(f"Wrote {args.out} (accepted={accepted}, unmatched={unmatched})")


def build_review_model(
    payload: dict[str, Any],
    alma_candidates: list[AlmaCourseCandidate],
    *,
    candidate_limit: int,
) -> dict[str, Any]:
    courses_by_id = {
        str(course.get("moodle_course_id") or ""): course
        for course in payload.get("courses") or []
    }
    unresolved: list[dict[str, Any]] = []
    for match in payload.get("matches") or []:
        if match.get("status") == "accepted":
            continue
        moodle_course_id = str(match.get("moodle_course_id") or "")
        course = courses_by_id.get(moodle_course_id) or {}
        preferred_period_label = infer_period_label(str(course.get("title") or match.get("moodle_title") or ""))
        scoped_candidates = scope_candidates_by_period(alma_candidates, preferred_period_label)
        if not scoped_candidates:
            scoped_candidates = alma_candidates
        scored = [
            score_candidate(course or match, candidate, 0.0)
            for candidate in scoped_candidates
        ]
        scored.sort(key=lambda item: float(item["confidence"]), reverse=True)
        unresolved.append(
            {
                "moodleCourseId": moodle_course_id,
                "title": match.get("moodle_title") or course.get("title") or "",
                "url": course.get("course_url") or "",
                "teachers": course.get("teachers") or [],
                "summaryText": course.get("summary_text") or "",
                "currentEvidence": match.get("evidence") or {},
                "preferredPeriodLabel": preferred_period_label,
                "candidates": scored[: max(candidate_limit, 1)],
            }
        )
    return {"unresolved": unresolved}


def apply_overrides(payload: dict[str, Any], overrides: list[dict[str, Any]]) -> dict[str, Any]:
    by_moodle_id = {
        str(override.get("moodle_course_id") or ""): override
        for override in overrides
        if override.get("moodle_course_id")
    }
    updated = json.loads(json.dumps(payload, ensure_ascii=False))
    for match in updated.get("matches") or []:
        moodle_course_id = str(match.get("moodle_course_id") or "")
        override = by_moodle_id.get(moodle_course_id)
        if not override:
            continue
        action = override.get("action")
        if action == "accept":
            match.update(
                {
                    "course_id": override.get("course_id"),
                    "course_number": override.get("course_number"),
                    "course_title": override.get("course_title"),
                    "period_id": override.get("period_id"),
                    "match_method": "manual",
                    "confidence": 1.0,
                    "status": "accepted",
                    "evidence": {
                        "manualOverride": True,
                        "savedAtUnix": int(time.time()),
                        "candidate": {
                            "courseId": override.get("course_id"),
                            "number": override.get("course_number"),
                            "title": override.get("course_title"),
                            "periodId": override.get("period_id"),
                        },
                    },
                }
            )
        elif action == "ignore":
            match.update(
                {
                    "course_id": None,
                    "course_number": None,
                    "course_title": None,
                    "period_id": None,
                    "match_method": "manual_ignore",
                    "confidence": 0.0,
                    "status": "unmatched",
                    "evidence": {
                        "manualIgnore": True,
                        "savedAtUnix": int(time.time()),
                        "reason": override.get("reason") or "No ALMA course should be linked.",
                    },
                }
            )
    return updated


def normalize_overrides(overrides: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for item in overrides:
        action = item.get("action")
        moodle_course_id = str(item.get("moodle_course_id") or "")
        if action not in {"accept", "ignore"} or not moodle_course_id:
            continue
        if action == "accept":
            normalized.append(
                {
                    "moodle_course_id": moodle_course_id,
                    "action": "accept",
                    "course_id": maybe_int(item.get("course_id")),
                    "course_number": item.get("course_number"),
                    "course_title": item.get("course_title"),
                    "period_id": item.get("period_id"),
                }
            )
        else:
            normalized.append(
                {
                    "moodle_course_id": moodle_course_id,
                    "action": "ignore",
                    "reason": item.get("reason") or "",
                }
            )
    return normalized


def maybe_int(value: object) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise SystemExit(f"Input not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


REVIEW_HTML = r"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Moodle Match Review</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; background: #f7f7f4; color: #222; }
    header { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #ddd; padding: 12px 18px; z-index: 2; }
    main { max-width: 1180px; margin: 0 auto; padding: 16px; }
    button, select, input { font: inherit; }
    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .toolbar input { min-width: 240px; flex: 1; padding: 8px; border: 1px solid #bbb; border-radius: 6px; }
    .toolbar button { padding: 8px 12px; border: 1px solid #222; background: #222; color: #fff; border-radius: 6px; cursor: pointer; }
    .course { background: #fff; border: 1px solid #ddd; border-radius: 8px; margin: 14px 0; padding: 14px; }
    .course h2 { font-size: 18px; margin: 0 0 8px; }
    .meta { color: #555; font-size: 13px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr); gap: 14px; }
    .summary { max-height: 120px; overflow: auto; border: 1px solid #eee; padding: 8px; border-radius: 6px; background: #fafafa; }
    .candidate { display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: start; border: 1px solid #eee; border-radius: 6px; padding: 8px; margin: 8px 0; }
    .candidate strong { display: block; }
    .score { color: #555; font-size: 13px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .actions button { padding: 7px 10px; border-radius: 6px; border: 1px solid #aaa; cursor: pointer; background: #fff; }
    .actions .accept { border-color: #14532d; color: #14532d; }
    .actions .ignore { border-color: #7f1d1d; color: #7f1d1d; }
    .chosen { outline: 2px solid #14532d; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <div class="toolbar">
      <strong id="count">Loading...</strong>
      <input id="filter" placeholder="Filter unresolved courses or candidates" />
      <button id="save">Save Overrides</button>
    </div>
  </header>
  <main id="root"></main>
  <script>
    let model = { unresolved: [] };
    const overrides = new Map();
    const root = document.getElementById('root');
    const filter = document.getElementById('filter');
    const count = document.getElementById('count');

    fetch('/data').then(response => response.json()).then(data => {
      model = data;
      render();
    });

    filter.addEventListener('input', render);
    document.getElementById('save').addEventListener('click', async () => {
      const response = await fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: Array.from(overrides.values()) })
      });
      const result = await response.json();
      alert(`Saved ${result.count} overrides to ${result.path}`);
    });

    function render() {
      const query = filter.value.trim().toLowerCase();
      root.innerHTML = '';
      const courses = model.unresolved.filter(course => JSON.stringify(course).toLowerCase().includes(query));
      count.textContent = `${courses.length} unresolved Moodle matches`;
      for (const course of courses) {
        root.appendChild(renderCourse(course));
      }
    }

    function renderCourse(course) {
      const section = document.createElement('section');
      section.className = 'course';
      section.innerHTML = `
        <h2>${escapeHtml(course.title)}</h2>
        <div class="meta">Moodle ${escapeHtml(course.moodleCourseId)} ${course.preferredPeriodLabel ? ' | ' + escapeHtml(course.preferredPeriodLabel) : ''}</div>
        <div class="grid">
          <div>
            <p><a href="${escapeAttr(course.url)}" target="_blank" rel="noreferrer">Open Moodle</a></p>
            <div class="summary">${escapeHtml(course.summaryText || 'No summary')}</div>
            <pre class="summary">${escapeHtml(JSON.stringify(course.currentEvidence, null, 2))}</pre>
          </div>
          <div class="candidates"></div>
        </div>
        <div class="actions">
          <button class="ignore" type="button">Ignore / no ALMA course</button>
        </div>
      `;
      const candidates = section.querySelector('.candidates');
      for (const candidate of course.candidates) {
        candidates.appendChild(renderCandidate(course, candidate));
      }
      section.querySelector('.ignore').addEventListener('click', () => {
        overrides.set(course.moodleCourseId, {
          moodle_course_id: course.moodleCourseId,
          action: 'ignore',
          reason: 'Reviewed manually; no ALMA course should be linked.'
        });
        section.classList.add('chosen');
      });
      return section;
    }

    function renderCandidate(course, score) {
      const candidate = score.candidate;
      const label = `${candidate.number || ''} ${candidate.title || ''}`.trim();
      const div = document.createElement('div');
      div.className = 'candidate';
      div.innerHTML = `
        <input type="radio" name="candidate-${escapeAttr(course.moodleCourseId)}" />
        <div>
          <strong>${escapeHtml(label)}</strong>
          <div class="score">course ${escapeHtml(candidate.courseId)} | period ${escapeHtml(candidate.periodId)} | confidence ${escapeHtml(score.confidence)} | title ${escapeHtml(score.titleSimilarity)} | lecturer ${escapeHtml(score.lecturerOverlap)} | type ${escapeHtml(score.typeSimilarity)}</div>
        </div>
      `;
      div.querySelector('input').addEventListener('change', () => {
        overrides.set(course.moodleCourseId, {
          moodle_course_id: course.moodleCourseId,
          action: 'accept',
          course_id: candidate.courseId,
          course_number: candidate.number,
          course_title: candidate.title,
          period_id: candidate.periodId
        });
      });
      return div;
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[character]));
    }

    function escapeAttr(value) {
      return escapeHtml(value).replace(/`/g, '&#96;');
    }
  </script>
</body>
</html>
"""


if __name__ == "__main__":
    main()

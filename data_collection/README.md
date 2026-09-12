# alma-course-scraper

Standalone Python scraper for the public ALMA course catalog at
`alma.uni-tuebingen.de`. It crawls the JSF catalog trees (VVZ + degree
programs), fetches course detail pages, and writes a JSON file that is later
turned into the D1 seed by `backend/scripts/import_alma_json_to_d1.py`.

## Docs

- [`QUICKSTART.md`](QUICKSTART.md) — runnable commands.
- [`CLAUDE.md`](CLAUDE.md) — architecture, catalog trees, period mapping, gotchas.

## Quick run

Run from `data_collection/` after the [setup](QUICKSTART.md#setup).

```bash
# From WiSe 2022/23 through the newest available semester:
uv run python -m alma.cli --details --from-semester "Winter 2022/23"
```

Output is written to `output/<timestamp>/courses_multi_semester.json`.

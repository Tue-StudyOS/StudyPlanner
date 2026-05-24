from __future__ import annotations

import argparse
import re
import sqlite3
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SQLITE_PATH = ROOT_DIR / "data" / "alma.sqlite"
DEFAULT_SCHEMA_OUT = ROOT_DIR / "migrations" / "0001_initial.sql"
SKIP_TABLES = {
    "course_search",
    "course_search_data",
    "course_search_idx",
    "course_search_content",
    "course_search_docsize",
    "course_search_config",
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Export the local alma.sqlite database into D1-friendly SQL files.",
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SQLITE_PATH,
        help="Path to the source SQLite database.",
    )
    parser.add_argument(
        "--schema-out",
        type=Path,
        default=DEFAULT_SCHEMA_OUT,
        help="Path for the generated schema migration file.",
    )
    parser.add_argument(
        "--data-out",
        type=Path,
        help="Optional path for a data-only SQL seed dump.",
    )
    parser.add_argument(
        "--skip-schema",
        action="store_true",
        help="Do not regenerate the schema migration file.",
    )
    return parser


def sort_tables_by_dependency(
    sqlite_conn: sqlite3.Connection,
    tables: list[str],
) -> list[str]:
    """Order tables so foreign-key dependencies are created first."""
    table_set = set(tables)
    dependencies: dict[str, set[str]] = {}
    for table in tables:
        foreign_keys = sqlite_conn.execute(
            f'PRAGMA foreign_key_list("{table}")'
        ).fetchall()
        dependencies[table] = {
            row[2]
            for row in foreign_keys
            if row[2] in table_set and row[2] != table
        }

    ordered_tables: list[str] = []
    placed_tables: set[str] = set()
    while len(ordered_tables) < len(tables):
        progressed = False
        for table in tables:
            if table in placed_tables:
                continue
            if dependencies[table] <= placed_tables:
                ordered_tables.append(table)
                placed_tables.add(table)
                progressed = True
        if not progressed:
            remaining_tables = sorted(set(tables) - placed_tables)
            raise RuntimeError(f"Cyclic foreign keys detected among: {remaining_tables}")
    return ordered_tables


def add_if_not_exists(create_sql: str) -> str:
    """Make generated CREATE statements idempotent for local D1 rebuilds."""
    replacements = [
        (r"^CREATE TABLE\s+", "CREATE TABLE IF NOT EXISTS "),
        (r"^CREATE INDEX\s+", "CREATE INDEX IF NOT EXISTS "),
        (r"^CREATE UNIQUE INDEX\s+", "CREATE UNIQUE INDEX IF NOT EXISTS "),
        (r"^CREATE VIEW\s+", "CREATE VIEW IF NOT EXISTS "),
    ]

    result = create_sql
    for pattern, replacement in replacements:
        if re.match(pattern, result, flags=re.IGNORECASE):
            return re.sub(pattern, replacement, result, count=1, flags=re.IGNORECASE)
    return result


def load_schema_objects(
    sqlite_conn: sqlite3.Connection,
) -> tuple[list[str], dict[str, str], list[tuple[str, str, str]], list[tuple[str, str]]]:
    """Return ordered tables, create statements, indexes, and views."""
    table_rows = sqlite_conn.execute(
        "SELECT name, sql FROM sqlite_master "
        "WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).fetchall()
    create_statements = {
        name: sql
        for name, sql in table_rows
        if sql and name not in SKIP_TABLES
    }
    ordered_tables = sort_tables_by_dependency(sqlite_conn, list(create_statements))

    index_rows = sqlite_conn.execute(
        "SELECT name, tbl_name, sql FROM sqlite_master "
        "WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).fetchall()
    indexes = [
        (name, table_name, sql)
        for name, table_name, sql in index_rows
        if sql and table_name not in SKIP_TABLES
    ]

    view_rows = sqlite_conn.execute(
        "SELECT name, sql FROM sqlite_master WHERE type = 'view' ORDER BY name"
    ).fetchall()
    views = [(name, sql) for name, sql in view_rows if sql]

    return ordered_tables, create_statements, indexes, views


def export_schema(source_path: Path, output_path: Path) -> None:
    """Write a D1-compatible schema migration from the source SQLite database."""
    sqlite_conn = sqlite3.connect(source_path)
    try:
        tables, create_statements, indexes, views = load_schema_objects(sqlite_conn)
    finally:
        sqlite_conn.close()

    parts: list[str] = [
        "-- Generated from backend/data/alma.sqlite for Cloudflare D1.",
        "-- Full-text search virtual tables are intentionally excluded for the first D1 migration.",
        "PRAGMA foreign_keys = ON;",
        "",
    ]

    for table in tables:
        parts.append(add_if_not_exists(create_statements[table]).rstrip() + ";")
        parts.append("")

    for _, _, sql in indexes:
        parts.append(add_if_not_exists(sql).rstrip() + ";")
        parts.append("")

    for _, sql in views:
        parts.append(add_if_not_exists(sql).rstrip() + ";")
        parts.append("")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(parts).strip() + "\n", encoding="utf-8")


def quote_value(sqlite_conn: sqlite3.Connection, value: object) -> str:
    """Quote a value using SQLite's own SQL literal formatter."""
    quoted = sqlite_conn.execute("SELECT quote(?)", (value,)).fetchone()
    return str(quoted[0]) if quoted else "NULL"


def export_data(source_path: Path, output_path: Path) -> None:
    """Write a data-only SQL dump that can be executed against D1.

    Remote D1 imports reject explicit transaction statements in SQL files, so the
    generated dump intentionally avoids BEGIN/COMMIT wrappers.
    """
    sqlite_conn = sqlite3.connect(source_path)
    try:
        tables, _, _, _ = load_schema_objects(sqlite_conn)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as handle:
            handle.write("-- Generated from backend/data/alma.sqlite for Cloudflare D1.\n")
            handle.write("PRAGMA foreign_keys = OFF;\n\n")

            for table in reversed(tables):
                handle.write(f'DELETE FROM "{table}";\n')
            handle.write("\n")

            for table in tables:
                column_rows = sqlite_conn.execute(
                    f'PRAGMA table_info("{table}")'
                ).fetchall()
                columns = [row[1] for row in column_rows]
                column_list = ", ".join(f'"{column}"' for column in columns)
                select_sql = f'SELECT {column_list} FROM "{table}"'
                rows = sqlite_conn.execute(select_sql).fetchall()

                for row in rows:
                    values_sql = ", ".join(quote_value(sqlite_conn, value) for value in row)
                    handle.write(
                        f'INSERT INTO "{table}" ({column_list}) VALUES ({values_sql});\n'
                    )
                handle.write("\n")

            handle.write("PRAGMA foreign_keys = ON;\n")
    finally:
        sqlite_conn.close()


def main() -> None:
    args = build_parser().parse_args()
    if not args.source.exists():
        raise SystemExit(f"SQLite database not found: {args.source}")

    if not args.skip_schema:
        export_schema(args.source, args.schema_out)
        print(f"Wrote schema migration: {args.schema_out}")

    if args.data_out is not None:
        export_data(args.source, args.data_out)
        print(f"Wrote data seed dump: {args.data_out}")


if __name__ == "__main__":
    main()

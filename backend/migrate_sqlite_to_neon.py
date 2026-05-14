"""Migrate the normalized Alma course data from the local SQLite database to Neon.

The SQLite file at backend/data/alma.sqlite already holds the scraped course
catalog in a fully normalized 24-table schema. This script copies that schema
and its data into a Postgres (Neon) database.

FTS5 search tables are skipped: full-text search is SQLite-specific and would
need to be rebuilt with Postgres' own tsvector machinery.

Usage:
    DATABASE_URL must point at the Neon database (read from the environment,
    or from backend/.env). Then:
        python backend/migrate_sqlite_to_neon.py
"""

from __future__ import annotations

import os
import re
import sqlite3
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

SQLITE_PATH = Path(__file__).parent / "data" / "alma.sqlite"

# FTS5 virtual table plus its shadow tables: SQLite-only, not migrated.
SKIP_TABLES = {
    "course_search",
    "course_search_data",
    "course_search_idx",
    "course_search_content",
    "course_search_docsize",
    "course_search_config",
}

INSERT_BATCH_SIZE = 1000


def get_database_url() -> str:
    """Return DATABASE_URL from the environment, falling back to backend/.env."""
    # load_dotenv does not override variables already set in the environment,
    # so a value exported from the shell profile still wins.
    load_dotenv(Path(__file__).parent / ".env")
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL is not set (export it or put it in backend/.env).")
    return url


def to_postgres_ddl(create_sql: str) -> str:
    """Translate a SQLite CREATE TABLE statement into valid Postgres DDL.

    Only the differences that actually occur in this schema are handled:
      - SQLite's unixepoch() default has no Postgres equivalent.
      - The appointments.instructors_text column has no declared type, which
        SQLite permits but Postgres rejects.
    """
    ddl = create_sql.replace("unixepoch()", "extract(epoch from now())::bigint")
    ddl = re.sub(r"instructors_text\s*,", "instructors_text TEXT,", ddl)
    return ddl


def sort_tables_by_dependency(
    sqlite_conn: sqlite3.Connection, tables: list[str]
) -> list[str]:
    """Order tables so every table comes after the tables its foreign keys reference."""
    table_set = set(tables)
    deps: dict[str, set[str]] = {}
    for table in tables:
        rows = sqlite_conn.execute(f'PRAGMA foreign_key_list("{table}")').fetchall()
        referenced = {row[2] for row in rows if row[2] in table_set and row[2] != table}
        deps[table] = referenced

    ordered: list[str] = []
    placed: set[str] = set()
    while len(ordered) < len(tables):
        progressed = False
        for table in tables:
            if table in placed:
                continue
            if deps[table] <= placed:
                ordered.append(table)
                placed.add(table)
                progressed = True
        if not progressed:
            remaining = sorted(set(tables) - placed)
            sys.exit(f"Cyclic foreign keys among: {remaining}")
    return ordered


def copy_table(
    sqlite_conn: sqlite3.Connection,
    pg_cursor,
    table: str,
) -> int:
    """Copy every row of one table from SQLite into the matching Postgres table."""
    columns = [row[1] for row in sqlite_conn.execute(f'PRAGMA table_info("{table}")')]
    col_list = ", ".join(f'"{col}"' for col in columns)
    select_sql = f'SELECT {col_list} FROM "{table}"'
    insert_sql = f'INSERT INTO "{table}" ({col_list}) VALUES %s'

    total = 0
    cursor = sqlite_conn.execute(select_sql)
    while True:
        batch = cursor.fetchmany(INSERT_BATCH_SIZE)
        if not batch:
            break
        execute_values(pg_cursor, insert_sql, batch, page_size=INSERT_BATCH_SIZE)
        total += len(batch)
    return total


def main() -> None:
    if not SQLITE_PATH.exists():
        sys.exit(f"SQLite database not found at {SQLITE_PATH}")

    database_url = get_database_url()

    sqlite_conn = sqlite3.connect(f"file:{SQLITE_PATH}?mode=ro", uri=True)
    sqlite_conn.text_factory = str

    table_rows = sqlite_conn.execute(
        "SELECT name, sql FROM sqlite_master "
        "WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    create_sql = {
        name: sql for name, sql in table_rows if name not in SKIP_TABLES
    }
    tables = sort_tables_by_dependency(sqlite_conn, list(create_sql))

    print(f"Migrating {len(tables)} tables to Neon...")

    pg_conn = psycopg2.connect(database_url)
    pg_conn.set_client_encoding("UTF8")
    try:
        with pg_conn:
            with pg_conn.cursor() as cur:
                # Drop existing tables first so the script is re-runnable.
                for table in reversed(tables):
                    cur.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE')
                for table in tables:
                    cur.execute(to_postgres_ddl(create_sql[table]))
                for table in tables:
                    count = copy_table(sqlite_conn, cur, table)
                    print(f"  {table}: {count} rows")
        print("Done. Changes committed.")
    finally:
        pg_conn.close()
        sqlite_conn.close()


if __name__ == "__main__":
    main()

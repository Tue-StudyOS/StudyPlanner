from __future__ import annotations

from typing import Any


class D1ExecutionError(RuntimeError):
    """Raised when a D1 binding is missing or a query fails."""



def _get_database(env: Any) -> Any | None:
    if isinstance(env, dict):
        return env.get("DB")
    return getattr(env, "DB", None)



def has_database(env: Any) -> bool:
    """Return whether the Cloudflare D1 binding exists."""
    return _get_database(env) is not None



def _require_database(env: Any) -> Any:
    database = _get_database(env)
    if database is None:
        raise D1ExecutionError("Missing D1 binding 'DB'.")
    return database



def _bind_statement(statement: Any, params: list[Any]) -> Any:
    if not params:
        return statement

    bind = getattr(statement, "bind", None)
    if not callable(bind):
        raise D1ExecutionError("The D1 statement object does not expose a bind() method.")

    try:
        return bind(*params)
    except TypeError:
        bound_statement = statement
        for value in params:
            bound_statement = getattr(bound_statement, "bind")(value)
        return bound_statement



def _to_python(value: Any) -> Any:
    converter = getattr(value, "to_py", None)
    if callable(converter):
        try:
            return converter()
        except TypeError:
            return converter(depth=-1)
    return value



def _normalize_row(row: Any) -> dict[str, Any]:
    row = _to_python(row)
    if isinstance(row, dict):
        return row
    if hasattr(row, "items"):
        return {str(key): value for key, value in row.items()}
    if hasattr(row, "__dict__"):
        return {str(key): value for key, value in vars(row).items()}
    return {"value": row}



def _extract_rows(result: Any) -> list[dict[str, Any]]:
    result = _to_python(result)
    if result is None:
        return []
    if isinstance(result, list):
        return [_normalize_row(row) for row in result]
    if isinstance(result, dict):
        rows = _to_python(result.get("results"))
        if isinstance(rows, list):
            return [_normalize_row(row) for row in rows]
        if "results" not in result:
            return [_normalize_row(result)]
        return []

    rows = _to_python(getattr(result, "results", None))
    if isinstance(rows, list):
        return [_normalize_row(row) for row in rows]

    return []


async def fetch_all(
    env: Any,
    sql: str,
    params: list[Any] | None = None,
) -> list[dict[str, Any]]:
    """Execute a SELECT query and return all rows."""
    database = _require_database(env)
    prepared_statement = database.prepare(sql)
    bound_statement = _bind_statement(prepared_statement, params or [])

    try:
        result = await bound_statement.all()
    except Exception as exc:  # pragma: no cover - runtime-specific integration
        raise D1ExecutionError(f"D1 query failed: {exc}") from exc

    return _extract_rows(result)


async def fetch_one(
    env: Any,
    sql: str,
    params: list[Any] | None = None,
) -> dict[str, Any] | None:
    """Execute a SELECT query and return one row."""
    rows = await fetch_all(env, sql, params)
    return rows[0] if rows else None


async def execute(env: Any, sql: str, params: list[Any] | None = None) -> Any:
    """Execute a write query and return the raw D1 result."""
    database = _require_database(env)
    prepared_statement = database.prepare(sql)
    bound_statement = _bind_statement(prepared_statement, params or [])

    try:
        return await bound_statement.run()
    except Exception as exc:  # pragma: no cover - runtime-specific integration
        raise D1ExecutionError(f"D1 statement failed: {exc}") from exc

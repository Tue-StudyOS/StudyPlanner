from __future__ import annotations

import json
import sys
import tomllib
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]

EXPECTED_ACTIVE_D1_NAME = 'studyplaner-db-test'
EXPECTED_ACTIVE_D1_ID = '297f7a28-9069-431d-b989-49acf2537513'
RESERVED_PRODUCTION_D1_NAME = 'studyplanner-db'
RESERVED_PRODUCTION_D1_ID = '80ca9092-ddc6-454a-b04a-8ccae85ef2f5'
EXPECTED_D1_BINDING = 'DB'
EXPECTED_WORKER_NAME = 'studyplanner-api'
LEGACY_WORKER_NAME = 'studyplaner-api'
EXPECTED_API_BASE_URL = 'https://studyplanner-api.ben-tischberger.workers.dev'
EXPECTED_PAGES_PROJECT = 'studyplaner'
EXPECTED_PAGES_OUTPUT_DIR = 'dist'


class ConfigVerificationError(RuntimeError):
    """Raised when a checked Cloudflare configuration file is invalid."""


def _load_toml(path: Path) -> dict[str, Any]:
    with path.open('rb') as file:
        parsed = tomllib.load(file)
    return parsed


def _read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def _record_check(errors: list[str], condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


def _verify_backend_wrangler(errors: list[str]) -> None:
    path = REPO_ROOT / 'backend' / 'wrangler.toml'
    config = _load_toml(path)
    databases = config.get('d1_databases')

    _record_check(errors, config.get('name') == EXPECTED_WORKER_NAME, f'{path}: Worker name must stay {EXPECTED_WORKER_NAME!r}.')
    _record_check(errors, isinstance(databases, list) and len(databases) == 1, f'{path}: exactly one D1 database binding is expected.')

    if not isinstance(databases, list) or not databases:
        return

    database = databases[0]
    _record_check(errors, database.get('binding') == EXPECTED_D1_BINDING, f'{path}: D1 binding must stay {EXPECTED_D1_BINDING!r}.')
    _record_check(errors, database.get('database_name') == EXPECTED_ACTIVE_D1_NAME, f'{path}: active D1 database_name must be {EXPECTED_ACTIVE_D1_NAME!r}, not {database.get("database_name")!r}.')
    _record_check(errors, database.get('database_id') == EXPECTED_ACTIVE_D1_ID, f'{path}: active D1 database_id must be {EXPECTED_ACTIVE_D1_ID!r}.')


def _verify_frontend_wrangler(errors: list[str]) -> None:
    path = REPO_ROOT / 'frontend' / 'wrangler.toml'
    config = _load_toml(path)
    vars_config = config.get('vars') if isinstance(config.get('vars'), dict) else {}
    env_config = config.get('env') if isinstance(config.get('env'), dict) else {}
    production_config = env_config.get('production') if isinstance(env_config.get('production'), dict) else {}
    production_vars = production_config.get('vars') if isinstance(production_config.get('vars'), dict) else {}

    _record_check(errors, config.get('name') == EXPECTED_PAGES_PROJECT, f'{path}: Pages project name must stay {EXPECTED_PAGES_PROJECT!r}.')
    _record_check(errors, config.get('pages_build_output_dir') == EXPECTED_PAGES_OUTPUT_DIR, f'{path}: pages_build_output_dir must stay {EXPECTED_PAGES_OUTPUT_DIR!r}.')
    _record_check(errors, vars_config.get('VITE_API_BASE_URL') == EXPECTED_API_BASE_URL, f'{path}: preview VITE_API_BASE_URL must be {EXPECTED_API_BASE_URL!r}.')
    _record_check(errors, production_vars.get('VITE_API_BASE_URL') == EXPECTED_API_BASE_URL, f'{path}: production VITE_API_BASE_URL must be {EXPECTED_API_BASE_URL!r}.')


def _verify_env_examples(errors: list[str]) -> None:
    root_env = _read_env_file(REPO_ROOT / '.env.example')
    frontend_env = _read_env_file(REPO_ROOT / 'frontend' / '.env.production')

    _record_check(errors, root_env.get('D1_DATABASE_NAME') == EXPECTED_ACTIVE_D1_NAME, '.env.example: D1_DATABASE_NAME must document the current active test database.')
    _record_check(errors, root_env.get('D1_DATABASE_ID') == EXPECTED_ACTIVE_D1_ID, '.env.example: D1_DATABASE_ID must document the current active test database id.')
    _record_check(errors, frontend_env.get('VITE_API_BASE_URL') == EXPECTED_API_BASE_URL, 'frontend/.env.production: VITE_API_BASE_URL must point at the canonical Worker URL.')


def _verify_package_scripts(errors: list[str]) -> None:
    path = REPO_ROOT / 'package.json'
    package = json.loads(path.read_text(encoding='utf-8'))
    scripts = package.get('scripts', {})

    _record_check(errors, scripts.get('predeploy:backend') == 'python backend/scripts/verify_cloudflare_config.py', f'{path}: predeploy:backend must run the Cloudflare config verifier.')
    _record_check(errors, scripts.get('db:verify-config') == 'python backend/scripts/verify_cloudflare_config.py', f'{path}: db:verify-config must run the Cloudflare config verifier.')
    _record_check(errors, scripts.get('db:migrate:local') == 'cd backend && npx wrangler d1 migrations apply DB --local', f'{path}: db:migrate:local must use the checked D1 binding name DB.')
    _record_check(errors, scripts.get('db:migrate:remote') == 'cd backend && npx wrangler d1 migrations apply DB --remote', f'{path}: db:migrate:remote must use the checked D1 binding name DB.')


def verify_cloudflare_config() -> None:
    errors: list[str] = []
    _verify_backend_wrangler(errors)
    _verify_frontend_wrangler(errors)
    _verify_env_examples(errors)
    _verify_package_scripts(errors)

    if errors:
        formatted_errors = '\n'.join(f'- {error}' for error in errors)
        raise ConfigVerificationError(f'Cloudflare config verification failed:\n{formatted_errors}')


def main() -> int:
    try:
        verify_cloudflare_config()
    except ConfigVerificationError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(
        'Cloudflare config OK: '
        f'active D1 {EXPECTED_ACTIVE_D1_NAME} ({EXPECTED_ACTIVE_D1_ID}), '
        f'reserved production D1 {RESERVED_PRODUCTION_D1_NAME} ({RESERVED_PRODUCTION_D1_ID}), '
        f'Worker {EXPECTED_WORKER_NAME}, legacy Worker {LEGACY_WORKER_NAME}.'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

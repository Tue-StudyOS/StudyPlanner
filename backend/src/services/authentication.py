from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from typing import Any

from db.d1 import execute, fetch_one
from env_config import get_env_value
from http_utils import get_request_header
from services.user_data import dumps_json, ensure_user_progress, ensure_user_state, now_unix, parse_json_object

PASSWORD_PBKDF2_ITERATIONS = 310_000
DEFAULT_AUTH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
AUTH_TOKEN_MAX_CLOCK_SKEW_SECONDS = 60
LOGIN_IDENTIFIER_MAX_LENGTH = 255
SUPPORTED_REGULATION_SOURCE_STATUS = 'official'
SUPPORTED_REGULATION_PO_VERSION = '2021'
ALLOWED_PLANNER_MOBILE_LAYOUTS = {'compact-grid', 'weekly-list'}
ALLOWED_APP_LANGUAGES = {'en', 'de'}


class AuthenticationError(ValueError):
    """Raised when credentials are invalid or missing."""


class RegistrationError(ValueError):
    """Raised when user registration input is invalid."""


class AuthorizationError(PermissionError):
    """Raised when an authenticated action is not allowed."""


class ProfileUpdateError(ValueError):
    """Raised when a user profile update is invalid."""


class CredentialUpdateError(ValueError):
    """Raised when a credential (email/password) update is invalid."""


class AuthConfigurationError(RuntimeError):
    """Raised when authentication cannot run safely because configuration is missing."""


def _safe_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _validate_app_language(value: Any) -> str | None:
    language = _safe_text(value)
    if language is None:
        return None
    normalized_language = language.lower()
    if normalized_language not in ALLOWED_APP_LANGUAGES:
        raise ProfileUpdateError('appLanguage must be en or de.')
    return normalized_language


def _bool_setting(value: Any) -> bool:
    return value is True or value == 1 or value == 'true'


def _auth_token_ttl_seconds(env: Any) -> int:
    raw_value = get_env_value(env, 'AUTH_TOKEN_TTL_SECONDS', str(DEFAULT_AUTH_TOKEN_TTL_SECONDS))
    try:
        ttl_seconds = int(raw_value or DEFAULT_AUTH_TOKEN_TTL_SECONDS)
    except ValueError:
        ttl_seconds = DEFAULT_AUTH_TOKEN_TTL_SECONDS
    return max(60, ttl_seconds)


def _get_auth_token_secret(env: Any) -> str:
    token_secret = get_env_value(env, 'AUTH_TOKEN_SECRET')
    if not token_secret:
        raise AuthConfigurationError('AUTH_TOKEN_SECRET must be configured as a Worker secret.')
    return token_secret


def _hash_password(password: str, salt_hex: str) -> str:
    salt_bytes = bytes.fromhex(salt_hex)
    password_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt_bytes,
        PASSWORD_PBKDF2_ITERATIONS,
    )
    return password_hash.hex()


def _create_password_hash(password: str) -> tuple[str, str]:
    salt_hex = secrets.token_hex(16)
    return _hash_password(password, salt_hex), salt_hex


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode('ascii').rstrip('=')


def _base64url_decode(value: str) -> bytes:
    padding = '=' * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode('ascii'))


def _json_token_part(value: dict[str, Any]) -> str:
    return _base64url_encode(json.dumps(value, separators=(',', ':'), sort_keys=True).encode('utf-8'))


def _sign_token_input(token_input: str, secret: str) -> str:
    signature = hmac.new(
        secret.encode('utf-8'),
        token_input.encode('ascii'),
        hashlib.sha256,
    ).digest()
    return _base64url_encode(signature)


def _create_auth_token(env: Any, username: str) -> str:
    secret = _get_auth_token_secret(env)
    issued_at_unix = now_unix()
    expires_at_unix = issued_at_unix + _auth_token_ttl_seconds(env)
    header = {
        'alg': 'HS256',
        'typ': 'StudyPlannerAuthToken',
    }
    payload = {
        'username': username,
        'iat': issued_at_unix,
        'exp': expires_at_unix,
    }
    unsigned_token = f'{_json_token_part(header)}.{_json_token_part(payload)}'
    signature = _sign_token_input(unsigned_token, secret)
    return f'{unsigned_token}.{signature}'


def _verify_auth_token(env: Any, token: str) -> dict[str, Any] | None:
    secret = _get_auth_token_secret(env)
    token_parts = token.split('.')
    if len(token_parts) != 3:
        return None

    encoded_header, encoded_payload, provided_signature = token_parts
    unsigned_token = f'{encoded_header}.{encoded_payload}'
    expected_signature = _sign_token_input(unsigned_token, secret)
    if not hmac.compare_digest(provided_signature, expected_signature):
        return None

    try:
        header = json.loads(_base64url_decode(encoded_header).decode('utf-8'))
        payload = json.loads(_base64url_decode(encoded_payload).decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return None

    if not isinstance(header, dict) or not isinstance(payload, dict):
        return None
    if header.get('alg') != 'HS256' or header.get('typ') != 'StudyPlannerAuthToken':
        return None

    username = _safe_text(payload.get('username'))
    if not username:
        return None

    try:
        issued_at_unix = int(payload.get('iat'))
        expires_at_unix = int(payload.get('exp'))
    except (TypeError, ValueError):
        return None

    current_unix = now_unix()
    if expires_at_unix <= current_unix:
        return None
    if issued_at_unix > current_unix + AUTH_TOKEN_MAX_CLOCK_SKEW_SECONDS:
        return None

    return {
        'username': username,
        'iat': issued_at_unix,
        'exp': expires_at_unix,
    }


def _validate_login_identifier(identifier: str | None) -> str:
    normalized = (identifier or '').strip().lower()
    if not normalized:
        raise RegistrationError('An email or username is required.')
    if len(normalized) > LOGIN_IDENTIFIER_MAX_LENGTH:
        raise RegistrationError(
            f'Identifiers must be shorter than {LOGIN_IDENTIFIER_MAX_LENGTH + 1} characters.'
        )
    return normalized


def _derive_display_name(identifier: str) -> str:
    base = identifier.split('@', 1)[0] if '@' in identifier else identifier
    return base.strip()[:80] or identifier[:80]


def _validate_password(password: Any) -> str:
    normalized_password = password if isinstance(password, str) else ''
    if len(normalized_password) == 0:
        raise RegistrationError('Passwords must not be empty.')
    return normalized_password


def _extract_bearer_token(request: Any) -> str | None:
    authorization_header = get_request_header(request, 'Authorization')
    if not authorization_header:
        return None
    prefix = 'Bearer '
    if not authorization_header.startswith(prefix):
        return None
    token = authorization_header[len(prefix) :].strip()
    return token or None


def _registration_identity(payload: dict[str, Any]) -> tuple[str, str, str]:
    raw_identifier = payload.get('identifier')
    raw_username = payload.get('username')
    raw_email = payload.get('email')

    username = _validate_login_identifier(_safe_text(raw_username or raw_identifier or raw_email))
    email = _validate_login_identifier(_safe_text(raw_email or raw_identifier or username))
    display_name = _safe_text(payload.get('displayName')) or _derive_display_name(username)
    return username, email, display_name[:80]


async def _get_user_by_identifier(env: Any, identifier: str) -> dict[str, Any] | None:
    sql = """
        SELECT
            ua.username,
            ua.email,
            ua.password_hash AS passwordHash,
            ua.password_salt AS passwordSalt,
            us.display_name AS displayName
        FROM user_auth AS ua
        LEFT JOIN user_state AS us ON us.username = ua.username
        WHERE ua.username = ? OR ua.email = ?
        LIMIT 1
    """
    return await fetch_one(env, sql, [identifier, identifier])


async def _get_supported_study_program_by_id(
    env: Any,
    study_program_id: int,
) -> dict[str, Any] | None:
    return await fetch_one(
        env,
        """
        SELECT sp.id, sp.code
        FROM study_programs AS sp
        JOIN study_program_regulation_versions AS sprv
            ON sprv.study_program_id = sp.id
           AND sprv.is_default = 1
        JOIN regulation_versions AS rv
            ON rv.id = sprv.regulation_version_id
        WHERE sp.id = ?
          AND sp.source_status = ?
          AND sp.po_version = ?
          AND rv.source_status = ?
          AND rv.version_label = ?
        LIMIT 1
        """,
        [
            study_program_id,
            SUPPORTED_REGULATION_SOURCE_STATUS,
            SUPPORTED_REGULATION_PO_VERSION,
            SUPPORTED_REGULATION_SOURCE_STATUS,
            SUPPORTED_REGULATION_PO_VERSION,
        ],
    )


async def _get_supported_study_program_by_code(
    env: Any,
    study_program_code: str,
) -> dict[str, Any] | None:
    return await fetch_one(
        env,
        """
        SELECT sp.id, sp.code
        FROM study_programs AS sp
        JOIN study_program_regulation_versions AS sprv
            ON sprv.study_program_id = sp.id
           AND sprv.is_default = 1
        JOIN regulation_versions AS rv
            ON rv.id = sprv.regulation_version_id
        WHERE sp.code = ?
          AND sp.source_status = ?
          AND sp.po_version = ?
          AND rv.source_status = ?
          AND rv.version_label = ?
        LIMIT 1
        """,
        [
            study_program_code,
            SUPPORTED_REGULATION_SOURCE_STATUS,
            SUPPORTED_REGULATION_PO_VERSION,
            SUPPORTED_REGULATION_SOURCE_STATUS,
            SUPPORTED_REGULATION_PO_VERSION,
        ],
    )


async def _get_supported_regulation_version_by_id(
    env: Any,
    regulation_version_id: int,
) -> dict[str, Any] | None:
    return await fetch_one(
        env,
        """
        SELECT id, code
        FROM regulation_versions
        WHERE id = ?
          AND source_status = ?
          AND version_label = ?
        LIMIT 1
        """,
        [
            regulation_version_id,
            SUPPORTED_REGULATION_SOURCE_STATUS,
            SUPPORTED_REGULATION_PO_VERSION,
        ],
    )


async def _get_supported_regulation_version_by_code(
    env: Any,
    regulation_version_code: str,
) -> dict[str, Any] | None:
    return await fetch_one(
        env,
        """
        SELECT id, code
        FROM regulation_versions
        WHERE code = ?
          AND source_status = ?
          AND version_label = ?
        LIMIT 1
        """,
        [
            regulation_version_code,
            SUPPORTED_REGULATION_SOURCE_STATUS,
            SUPPORTED_REGULATION_PO_VERSION,
        ],
    )


async def _get_user_profile(env: Any, username: str) -> dict[str, Any] | None:
    sql = """
        SELECT
            ua.username,
            ua.email,
            us.display_name AS displayName,
            us.current_semester_label AS currentSemesterLabel,
            sp.id AS studyProgramId,
            sp.code AS studyProgramCode,
            sp.name AS studyProgramName,
            rv.id AS regulationVersionId,
            rv.code AS regulationVersionCode,
            rv.version_label AS regulationVersionLabel,
            rv.total_ects AS regulationTotalEcts,
            er.code AS regulationCode,
            er.name AS regulationName,
            us.planner_mobile_mode AS plannerMobileMode,
            us.planner_mobile_layout AS plannerMobileLayout,
            us.settings_json AS settingsJson,
            sp.total_ects AS studyProgramTotalEcts
        FROM user_auth AS ua
        LEFT JOIN user_state AS us ON us.username = ua.username
        LEFT JOIN study_programs AS sp ON sp.id = us.study_program_id
        LEFT JOIN regulation_versions AS rv ON rv.id = us.regulation_version_id
        LEFT JOIN examination_regulations AS er ON er.id = rv.regulation_id
        WHERE ua.username = ?
        LIMIT 1
    """
    row = await fetch_one(env, sql, [username])
    if row is None:
        return None

    row_username = str(row['username'])
    settings = parse_json_object(row.get('settingsJson'))
    app_language = settings.get('appLanguage') if settings.get('appLanguage') in ALLOWED_APP_LANGUAGES else None
    return {
        'id': row_username,
        'username': row_username,
        'email': row['email'],
        'displayName': row.get('displayName') or _derive_display_name(row_username),
        'profile': {
            'currentSemesterLabel': row.get('currentSemesterLabel'),
            'studyProgramId': row.get('studyProgramId'),
            'studyProgramCode': row.get('studyProgramCode'),
            'studyProgramName': row.get('studyProgramName'),
            'regulationVersionId': row.get('regulationVersionId'),
            'regulationVersionCode': row.get('regulationVersionCode'),
            'regulationVersionLabel': row.get('regulationVersionLabel'),
            'totalEcts': row.get('regulationTotalEcts') or row.get('studyProgramTotalEcts'),
            'regulationCode': row.get('regulationCode'),
            'regulationName': row.get('regulationName'),
            'plannerMobileLayout': row.get('plannerMobileLayout') or 'compact-grid',
            'appLanguage': app_language,
            'onboardingTourCompleted': _bool_setting(settings.get('onboardingTourCompleted')),
        },
    }


async def register_user(env: Any, payload: dict[str, Any], request: Any) -> dict[str, Any]:
    del request
    username, email, display_name = _registration_identity(payload)
    password = _validate_password(payload.get('password'))

    if await _get_user_by_identifier(env, username) is not None:
        raise RegistrationError('An account already exists for this email or username.')
    if email != username and await _get_user_by_identifier(env, email) is not None:
        raise RegistrationError('An account already exists for this email or username.')

    password_hash, password_salt = _create_password_hash(password)
    current_unix = now_unix()

    await execute(
        env,
        """
        INSERT INTO user_auth (
            username,
            email,
            password_hash,
            password_salt,
            created_at_unix,
            updated_at_unix
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        [username, email, password_hash, password_salt, current_unix, current_unix],
    )

    reg_study_program_id: int | None = None
    raw_sp = payload.get('studyProgramId')
    if raw_sp not in (None, ''):
        try:
            candidate_id = int(raw_sp)
        except (TypeError, ValueError) as exc:
            raise RegistrationError('Study program ids must be numeric.') from exc
        supported_program = await _get_supported_study_program_by_id(env, candidate_id)
        if supported_program is None:
            raise RegistrationError('Only the supported PO 2021 study programs can be selected.')
        reg_study_program_id = candidate_id

    reg_regulation_version_id: int | None = None
    if reg_study_program_id is not None:
        reg_regulation_version_id = await _get_default_regulation_version_id(env, reg_study_program_id)

    reg_semester_label = _safe_text(payload.get('currentSemesterLabel')) if 'currentSemesterLabel' in payload else None
    reg_app_language = _validate_app_language(payload.get('appLanguage')) if 'appLanguage' in payload else None
    initial_settings: dict[str, Any] = {}
    if reg_app_language:
        initial_settings['appLanguage'] = reg_app_language

    await execute(
        env,
        """
        INSERT INTO user_state (
            username,
            display_name,
            study_program_id,
            regulation_version_id,
            current_semester_label,
            settings_json,
            created_at_unix,
            updated_at_unix
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            username,
            display_name,
            reg_study_program_id,
            reg_regulation_version_id,
            reg_semester_label,
            dumps_json(initial_settings),
            current_unix,
            current_unix,
        ],
    )
    await ensure_user_progress(env, username)

    user = await _get_user_profile(env, username)
    if user is None:
        raise RegistrationError('The new account profile could not be loaded.')

    return {
        'token': _create_auth_token(env, username),
        'user': user,
    }


async def login_user(env: Any, payload: dict[str, Any], request: Any) -> dict[str, Any]:
    del request
    raw_identifier = payload.get('identifier')
    if raw_identifier in (None, ''):
        raw_identifier = payload.get('email') or payload.get('username')
    identifier = _validate_login_identifier(_safe_text(raw_identifier))
    password = _validate_password(payload.get('password'))

    user_row = await _get_user_by_identifier(env, identifier)
    if user_row is None:
        raise AuthenticationError('Invalid credentials.')

    expected_hash = _hash_password(password, str(user_row['passwordSalt']))
    if not hmac.compare_digest(str(user_row['passwordHash']), expected_hash):
        raise AuthenticationError('Invalid credentials.')

    username = str(user_row['username'])
    await ensure_user_state(env, username)
    await ensure_user_progress(env, username)
    user = await _get_user_profile(env, username)
    if user is None:
        raise AuthenticationError('The account profile could not be loaded.')

    return {
        'token': _create_auth_token(env, username),
        'user': user,
    }


async def get_authenticated_user(env: Any, request: Any) -> dict[str, Any] | None:
    token = _extract_bearer_token(request)
    if not token:
        return None

    token_payload = _verify_auth_token(env, token)
    if token_payload is None:
        return None

    return await _get_user_profile(env, str(token_payload['username']))


async def require_authenticated_user(env: Any, request: Any) -> dict[str, Any]:
    user = await get_authenticated_user(env, request)
    if user is None:
        raise AuthorizationError('Authentication is required for this endpoint.')
    return user


async def logout_user(env: Any, request: Any) -> None:
    del env, request
    # Stateless tokens cannot be revoked without reintroducing server-side token state.
    # The frontend performs logout by deleting its stored bearer token.
    return None


async def get_current_user_profile(env: Any, request: Any) -> dict[str, Any]:
    return await require_authenticated_user(env, request)


async def _resolve_study_program_id(env: Any, payload: dict[str, Any]) -> int | None:
    if 'studyProgramId' in payload:
        raw_value = payload.get('studyProgramId')
        if raw_value in {None, ''}:
            return None
        try:
            study_program_id = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise ProfileUpdateError('Study program ids must be numeric.') from exc

        exists = await _get_supported_study_program_by_id(env, study_program_id)
        if exists is None:
            raise ProfileUpdateError('Only the supported PO 2021 study programs can be selected.')
        return study_program_id

    if 'studyProgramCode' in payload:
        study_program_code = _safe_text(payload.get('studyProgramCode'))
        if not study_program_code:
            return None
        row = await _get_supported_study_program_by_code(env, study_program_code)
        if row is None:
            raise ProfileUpdateError('Only the supported PO 2021 study programs can be selected.')
        return int(row['id'])

    return None


async def _resolve_regulation_version_id(env: Any, payload: dict[str, Any]) -> int | None:
    if 'regulationVersionId' in payload:
        raw_value = payload.get('regulationVersionId')
        if raw_value in {None, ''}:
            return None
        try:
            regulation_version_id = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise ProfileUpdateError('Regulation version ids must be numeric.') from exc

        exists = await _get_supported_regulation_version_by_id(env, regulation_version_id)
        if exists is None:
            raise ProfileUpdateError('Only the supported PO 2021 regulation versions can be selected.')
        return regulation_version_id

    if 'regulationVersionCode' in payload:
        regulation_version_code = _safe_text(payload.get('regulationVersionCode'))
        if not regulation_version_code:
            return None
        row = await _get_supported_regulation_version_by_code(env, regulation_version_code)
        if row is None:
            raise ProfileUpdateError('Only the supported PO 2021 regulation versions can be selected.')
        return int(row['id'])

    return None


async def _get_default_regulation_version_id(env: Any, study_program_id: int) -> int | None:
    row = await fetch_one(
        env,
        """
        SELECT sprv.regulation_version_id AS regulationVersionId
        FROM study_program_regulation_versions AS sprv
        JOIN regulation_versions AS rv ON rv.id = sprv.regulation_version_id
        WHERE sprv.study_program_id = ?
          AND sprv.is_default = 1
          AND rv.source_status = ?
          AND rv.version_label = ?
        LIMIT 1
        """,
        [
            study_program_id,
            SUPPORTED_REGULATION_SOURCE_STATUS,
            SUPPORTED_REGULATION_PO_VERSION,
        ],
    )
    if row is None:
        return None
    return int(row['regulationVersionId'])


async def _is_regulation_allowed_for_program(
    env: Any,
    study_program_id: int,
    regulation_version_id: int,
) -> bool:
    row = await fetch_one(
        env,
        """
        SELECT 1
        FROM study_program_regulation_versions AS sprv
        JOIN study_programs AS sp ON sp.id = sprv.study_program_id
        JOIN regulation_versions AS rv ON rv.id = sprv.regulation_version_id
        WHERE sprv.study_program_id = ?
          AND sprv.regulation_version_id = ?
          AND sp.source_status = ?
          AND sp.po_version = ?
          AND rv.source_status = ?
          AND rv.version_label = ?
        LIMIT 1
        """,
        [
            study_program_id,
            regulation_version_id,
            SUPPORTED_REGULATION_SOURCE_STATUS,
            SUPPORTED_REGULATION_PO_VERSION,
            SUPPORTED_REGULATION_SOURCE_STATUS,
            SUPPORTED_REGULATION_PO_VERSION,
        ],
    )
    return row is not None


async def update_current_user_profile(
    env: Any,
    request: Any,
    payload: dict[str, Any],
) -> dict[str, Any]:
    current_user = await require_authenticated_user(env, request)
    username = str(current_user['username'])
    await ensure_user_state(env, username)
    current_profile_row = await fetch_one(
        env,
        """
        SELECT
            study_program_id AS studyProgramId,
            regulation_version_id AS regulationVersionId,
            current_semester_label AS currentSemesterLabel,
            planner_mobile_mode AS plannerMobileMode,
            planner_mobile_layout AS plannerMobileLayout,
            settings_json AS settingsJson
        FROM user_state
        WHERE username = ?
        LIMIT 1
        """,
        [username],
    )

    current_study_program_id = current_profile_row.get('studyProgramId') if current_profile_row else None
    study_program_is_changing = 'studyProgramId' in payload or 'studyProgramCode' in payload
    next_study_program_id = (
        await _resolve_study_program_id(env, payload)
        if study_program_is_changing
        else current_study_program_id
    )

    regulation_version_is_explicit = 'regulationVersionId' in payload or 'regulationVersionCode' in payload
    program_switched = study_program_is_changing and next_study_program_id != current_study_program_id
    next_regulation_version_id = (
        await _resolve_regulation_version_id(env, payload)
        if regulation_version_is_explicit
        else None if program_switched
        else current_profile_row.get('regulationVersionId') if current_profile_row else None
    )

    if next_study_program_id is None:
        next_regulation_version_id = None
    elif next_regulation_version_id is None:
        next_regulation_version_id = await _get_default_regulation_version_id(env, next_study_program_id)

    if next_study_program_id is not None and next_regulation_version_id is not None:
        if not await _is_regulation_allowed_for_program(
            env,
            next_study_program_id,
            int(next_regulation_version_id),
        ):
            raise ProfileUpdateError(
                'The selected regulation version is not mapped to the selected study program.'
            )

    if 'currentSemesterLabel' in payload:
        current_semester_label = _safe_text(payload.get('currentSemesterLabel'))
    else:
        current_semester_label = (
            _safe_text(current_profile_row.get('currentSemesterLabel'))
            if current_profile_row
            else None
        )

    planner_mobile_mode = (
        _safe_text(current_profile_row.get('plannerMobileMode'))
        if current_profile_row and _safe_text(current_profile_row.get('plannerMobileMode'))
        else 'auto'
    )

    planner_mobile_layout = _safe_text(payload.get('plannerMobileLayout')) if 'plannerMobileLayout' in payload else (
        _safe_text(current_profile_row.get('plannerMobileLayout')) if current_profile_row else 'compact-grid'
    )
    if planner_mobile_layout not in ALLOWED_PLANNER_MOBILE_LAYOUTS:
        raise ProfileUpdateError('plannerMobileLayout must be compact-grid or weekly-list.')

    settings = parse_json_object(current_profile_row.get('settingsJson') if current_profile_row else None)
    if 'appLanguage' in payload:
        next_app_language = _validate_app_language(payload.get('appLanguage'))
        if next_app_language is None:
            settings.pop('appLanguage', None)
        else:
            settings['appLanguage'] = next_app_language
    if 'onboardingTourCompleted' in payload:
        settings['onboardingTourCompleted'] = bool(payload.get('onboardingTourCompleted'))

    current_unix = now_unix()
    await execute(
        env,
        """
        UPDATE user_state
        SET
            study_program_id = ?,
            regulation_version_id = ?,
            current_semester_label = ?,
            planner_mobile_mode = ?,
            planner_mobile_layout = ?,
            settings_json = ?,
            updated_at_unix = ?
        WHERE username = ?
        """,
        [
            next_study_program_id,
            next_regulation_version_id,
            current_semester_label,
            planner_mobile_mode,
            planner_mobile_layout,
            dumps_json(settings),
            current_unix,
            username,
        ],
    )

    updated_profile = await _get_user_profile(env, username)
    if updated_profile is None:
        raise ProfileUpdateError('The updated profile could not be loaded.')
    return updated_profile


async def update_user_credentials(
    env: Any,
    request: Any,
    payload: dict[str, Any],
) -> dict[str, Any]:
    current_user = await require_authenticated_user(env, request)
    username = str(current_user['username'])

    current_password = payload.get('currentPassword')
    if not current_password or not isinstance(current_password, str):
        raise CredentialUpdateError('Current password is required to update credentials.')

    user_row = await fetch_one(
        env,
        'SELECT password_hash AS passwordHash, password_salt AS passwordSalt FROM user_auth WHERE username = ?',
        [username],
    )
    if user_row is None:
        raise CredentialUpdateError('User not found.')

    expected_hash = _hash_password(current_password, str(user_row['passwordSalt']))
    if not hmac.compare_digest(str(user_row['passwordHash']), expected_hash):
        raise CredentialUpdateError('Current password is incorrect.')

    auth_updates: dict[str, Any] = {}
    state_updates: dict[str, Any] = {}

    if 'identifier' in payload or 'email' in payload:
        raw_identifier = payload.get('email') if 'email' in payload else payload.get('identifier')
        new_email = _validate_login_identifier(_safe_text(raw_identifier))
        existing = await _get_user_by_identifier(env, new_email)
        if existing is not None and str(existing['username']) != username:
            raise CredentialUpdateError('This email or username is already taken.')
        auth_updates['email'] = new_email
        state_updates['display_name'] = _derive_display_name(new_email)

    if 'newPassword' in payload:
        new_password = _validate_password(payload.get('newPassword'))
        pw_hash, pw_salt = _create_password_hash(new_password)
        auth_updates['password_hash'] = pw_hash
        auth_updates['password_salt'] = pw_salt

    if not auth_updates and not state_updates:
        return await _get_user_profile(env, username) or {}

    current_unix = now_unix()
    if auth_updates:
        set_clauses = ', '.join(f'{column_name} = ?' for column_name in auth_updates)
        values = list(auth_updates.values()) + [current_unix, username]
        await execute(
            env,
            f'UPDATE user_auth SET {set_clauses}, updated_at_unix = ? WHERE username = ?',  # noqa: S608
            values,
        )

    if state_updates:
        await ensure_user_state(env, username)
        state_set_clauses = ', '.join(f'{column_name} = ?' for column_name in state_updates)
        state_values = list(state_updates.values()) + [current_unix, username]
        await execute(
            env,
            f'UPDATE user_state SET {state_set_clauses}, updated_at_unix = ? WHERE username = ?',  # noqa: S608
            state_values,
        )

    updated = await _get_user_profile(env, username)
    if updated is None:
        raise CredentialUpdateError('The updated profile could not be loaded.')
    return updated

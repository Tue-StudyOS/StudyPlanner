from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from typing import Any

from db.d1 import execute, fetch_one
from env_config import get_env_value
from http_utils import get_request_header

PASSWORD_PBKDF2_ITERATIONS = 310_000
DEFAULT_SESSION_TTL_DAYS = 30
LOGIN_IDENTIFIER_MAX_LENGTH = 255
SUPPORTED_REGULATION_SOURCE_STATUS = 'official'
SUPPORTED_REGULATION_PO_VERSION = '2021'
ALLOWED_PLANNER_MOBILE_MODES = {'auto', 'mobile', 'desktop'}
ALLOWED_PLANNER_MOBILE_LAYOUTS = {'compact-grid', 'weekly-list'}


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


def _safe_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _now_unix() -> int:
    return int(time.time())


def _session_ttl_days(env: Any) -> int:
    raw_value = get_env_value(env, 'SESSION_TTL_DAYS', str(DEFAULT_SESSION_TTL_DAYS))
    try:
        ttl_days = int(raw_value or DEFAULT_SESSION_TTL_DAYS)
    except ValueError:
        ttl_days = DEFAULT_SESSION_TTL_DAYS
    return max(1, ttl_days)


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


def _hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


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
    return base.strip()[:80]


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


async def _get_user_by_identifier(env: Any, identifier: str) -> dict[str, Any] | None:
    sql = """
        SELECT
            id,
            email,
            password_hash AS passwordHash,
            password_salt AS passwordSalt,
            display_name AS displayName
        FROM users
        WHERE email = ?
        LIMIT 1
    """
    return await fetch_one(env, sql, [identifier])


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


async def _get_user_profile(env: Any, user_id: int) -> dict[str, Any] | None:
    sql = """
        SELECT
            u.id,
            u.email,
            u.display_name AS displayName,
            up.current_semester_label AS currentSemesterLabel,
            sp.id AS studyProgramId,
            sp.code AS studyProgramCode,
            sp.name AS studyProgramName,
            rv.id AS regulationVersionId,
            rv.code AS regulationVersionCode,
            rv.version_label AS regulationVersionLabel,
            rv.total_ects AS regulationTotalEcts,
            er.code AS regulationCode,
            er.name AS regulationName,
            up.planner_mobile_mode AS plannerMobileMode,
            up.planner_mobile_layout AS plannerMobileLayout,
            sp.total_ects AS studyProgramTotalEcts
        FROM users AS u
        LEFT JOIN user_profiles AS up ON up.user_id = u.id
        LEFT JOIN study_programs AS sp ON sp.id = up.study_program_id
        LEFT JOIN regulation_versions AS rv ON rv.id = up.regulation_version_id
        LEFT JOIN examination_regulations AS er ON er.id = rv.regulation_id
        WHERE u.id = ?
        LIMIT 1
    """
    row = await fetch_one(env, sql, [user_id])
    if row is None:
        return None

    return {
        'id': row['id'],
        'email': row['email'],
        'displayName': row['displayName'],
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
            'plannerMobileMode': row.get('plannerMobileMode') or 'auto',
            'plannerMobileLayout': row.get('plannerMobileLayout') or 'compact-grid',
        },
    }


async def _create_session(env: Any, user_id: int, user_agent: str | None) -> str:
    session_token = secrets.token_urlsafe(32)
    token_hash = _hash_session_token(session_token)
    now_unix = _now_unix()
    expires_at_unix = now_unix + (_session_ttl_days(env) * 24 * 60 * 60)

    await execute(
        env,
        """
        INSERT INTO user_sessions (
            user_id,
            token_hash,
            created_at_unix,
            expires_at_unix,
            last_seen_at_unix,
            user_agent
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        [user_id, token_hash, now_unix, expires_at_unix, now_unix, user_agent],
    )
    return session_token


async def register_user(env: Any, payload: dict[str, Any], request: Any) -> dict[str, Any]:
    raw_identifier = payload.get('identifier')
    if raw_identifier in (None, ''):
        raw_identifier = payload.get('email')
    identifier = _validate_login_identifier(_safe_text(raw_identifier))
    display_name = _derive_display_name(identifier)
    password = _validate_password(payload.get('password'))

    existing_user = await _get_user_by_identifier(env, identifier)
    if existing_user is not None:
        raise RegistrationError('An account already exists for this email or username.')

    password_hash, password_salt = _create_password_hash(password)
    now_unix = _now_unix()

    await execute(
        env,
        """
        INSERT INTO users (
            email,
            password_hash,
            password_salt,
            display_name,
            created_at_unix,
            updated_at_unix
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        [identifier, password_hash, password_salt, display_name, now_unix, now_unix],
    )

    created_user = await _get_user_by_identifier(env, identifier)
    if created_user is None:
        raise RegistrationError('The account could not be created.')

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

    await execute(
        env,
        """
        INSERT INTO user_profiles (
            user_id,
            study_program_id,
            regulation_version_id,
            current_semester_label,
            created_at_unix,
            updated_at_unix
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        [created_user['id'], reg_study_program_id, reg_regulation_version_id, reg_semester_label, now_unix, now_unix],
    )

    session_token = await _create_session(
        env,
        int(created_user['id']),
        _safe_text(get_request_header(request, 'User-Agent')),
    )
    user = await _get_user_profile(env, int(created_user['id']))
    if user is None:
        raise RegistrationError('The new account profile could not be loaded.')

    return {
        'token': session_token,
        'user': user,
    }


async def login_user(env: Any, payload: dict[str, Any], request: Any) -> dict[str, Any]:
    raw_identifier = payload.get('identifier')
    if raw_identifier in (None, ''):
        raw_identifier = payload.get('email')
    identifier = _validate_login_identifier(_safe_text(raw_identifier))
    password = _validate_password(payload.get('password'))

    user_row = await _get_user_by_identifier(env, identifier)
    if user_row is None:
        raise AuthenticationError('Invalid credentials.')

    expected_hash = _hash_password(password, str(user_row['passwordSalt']))
    if not hmac.compare_digest(str(user_row['passwordHash']), expected_hash):
        raise AuthenticationError('Invalid credentials.')

    session_token = await _create_session(
        env,
        int(user_row['id']),
        _safe_text(get_request_header(request, 'User-Agent')),
    )
    user = await _get_user_profile(env, int(user_row['id']))
    if user is None:
        raise AuthenticationError('The account profile could not be loaded.')

    return {
        'token': session_token,
        'user': user,
    }


async def get_authenticated_user(env: Any, request: Any) -> dict[str, Any] | None:
    token = _extract_bearer_token(request)
    if not token:
        return None

    token_hash = _hash_session_token(token)
    session_sql = """
        SELECT
            id,
            user_id AS userId,
            expires_at_unix AS expiresAtUnix,
            revoked_at_unix AS revokedAtUnix
        FROM user_sessions
        WHERE token_hash = ?
        LIMIT 1
    """
    session = await fetch_one(env, session_sql, [token_hash])
    if session is None:
        return None

    now_unix = _now_unix()
    if session.get('revokedAtUnix') is not None:
        return None
    if int(session['expiresAtUnix']) <= now_unix:
        return None

    await execute(
        env,
        """
        UPDATE user_sessions
        SET last_seen_at_unix = ?
        WHERE id = ?
        """,
        [now_unix, session['id']],
    )
    return await _get_user_profile(env, int(session['userId']))


async def require_authenticated_user(env: Any, request: Any) -> dict[str, Any]:
    user = await get_authenticated_user(env, request)
    if user is None:
        raise AuthorizationError('Authentication is required for this endpoint.')
    return user


async def logout_user(env: Any, request: Any) -> None:
    token = _extract_bearer_token(request)
    if not token:
        raise AuthorizationError('Authentication is required for this endpoint.')

    await execute(
        env,
        """
        UPDATE user_sessions
        SET revoked_at_unix = ?
        WHERE token_hash = ?
          AND revoked_at_unix IS NULL
        """,
        [_now_unix(), _hash_session_token(token)],
    )


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
    user_id = int(current_user['id'])
    current_profile_row = await fetch_one(
        env,
        """
        SELECT
            study_program_id AS studyProgramId,
            regulation_version_id AS regulationVersionId,
            current_semester_label AS currentSemesterLabel,
            planner_mobile_mode AS plannerMobileMode,
            planner_mobile_layout AS plannerMobileLayout
        FROM user_profiles
        WHERE user_id = ?
        LIMIT 1
        """,
        [user_id],
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

    planner_mobile_mode = _safe_text(payload.get('plannerMobileMode')) if 'plannerMobileMode' in payload else (
        _safe_text(current_profile_row.get('plannerMobileMode')) if current_profile_row else 'auto'
    )
    if planner_mobile_mode not in ALLOWED_PLANNER_MOBILE_MODES:
        raise ProfileUpdateError('plannerMobileMode must be auto, mobile, or desktop.')

    planner_mobile_layout = _safe_text(payload.get('plannerMobileLayout')) if 'plannerMobileLayout' in payload else (
        _safe_text(current_profile_row.get('plannerMobileLayout')) if current_profile_row else 'compact-grid'
    )
    if planner_mobile_layout not in ALLOWED_PLANNER_MOBILE_LAYOUTS:
        raise ProfileUpdateError('plannerMobileLayout must be compact-grid or weekly-list.')

    now_unix = _now_unix()
    await execute(
        env,
        """
        UPDATE user_profiles
        SET
            study_program_id = ?,
            regulation_version_id = ?,
            current_semester_label = ?,
            planner_mobile_mode = ?,
            planner_mobile_layout = ?,
            updated_at_unix = ?
        WHERE user_id = ?
        """,
        [
            next_study_program_id,
            next_regulation_version_id,
            current_semester_label,
            planner_mobile_mode,
            planner_mobile_layout,
            now_unix,
            user_id,
        ],
    )

    updated_profile = await _get_user_profile(env, user_id)
    if updated_profile is None:
        raise ProfileUpdateError('The updated profile could not be loaded.')
    return updated_profile


async def update_user_credentials(
    env: Any,
    request: Any,
    payload: dict[str, Any],
) -> dict[str, Any]:
    current_user = await require_authenticated_user(env, request)
    user_id = int(current_user['id'])

    current_password = payload.get('currentPassword')
    if not current_password or not isinstance(current_password, str):
        raise CredentialUpdateError('Current password is required to update credentials.')

    user_row = await fetch_one(
        env,
        'SELECT password_hash AS passwordHash, password_salt AS passwordSalt FROM users WHERE id = ?',
        [user_id],
    )
    if user_row is None:
        raise CredentialUpdateError('User not found.')

    expected_hash = _hash_password(current_password, str(user_row['passwordSalt']))
    if not hmac.compare_digest(str(user_row['passwordHash']), expected_hash):
        raise CredentialUpdateError('Current password is incorrect.')

    updates: dict[str, Any] = {}

    if 'identifier' in payload:
        new_identifier = _validate_login_identifier(_safe_text(payload.get('identifier')))
        existing = await _get_user_by_identifier(env, new_identifier)
        if existing is not None and int(existing['id']) != user_id:
            raise CredentialUpdateError('This email or username is already taken.')
        updates['email'] = new_identifier
        updates['display_name'] = _derive_display_name(new_identifier)

    if 'newPassword' in payload:
        new_password = _validate_password(payload.get('newPassword'))
        pw_hash, pw_salt = _create_password_hash(new_password)
        updates['password_hash'] = pw_hash
        updates['password_salt'] = pw_salt

    if not updates:
        return await _get_user_profile(env, user_id) or {}

    set_clauses = ', '.join(f'{k} = ?' for k in updates)
    values = list(updates.values()) + [_now_unix(), user_id]
    await execute(
        env,
        f'UPDATE users SET {set_clauses}, updated_at_unix = ? WHERE id = ?',  # noqa: S608
        values,
    )

    updated = await _get_user_profile(env, user_id)
    if updated is None:
        raise CredentialUpdateError('The updated profile could not be loaded.')
    return updated

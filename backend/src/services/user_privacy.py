from __future__ import annotations

from typing import Any

from db.d1 import execute_batch
from services.authentication import require_authenticated_user, verify_user_password
from services.request_rate_limit import AUTH_LOGIN_POLICY, account_rate_limit_key

ACCOUNT_DELETION_CONFIRMATION = 'DELETE'


class AccountDeletionError(ValueError):
    """Raised when an account deletion request cannot be confirmed."""


def _account_rate_limit_keys(username: str, email: str) -> list[str]:
    keys = {
        key
        for identifier in (username, email)
        if (key := account_rate_limit_key(identifier)) is not None
    }
    return sorted(keys)


async def delete_current_user_account(
    env: Any,
    request: Any,
    payload: dict[str, Any],
) -> None:
    """Delete the signed-in account and its cascade-owned data atomically."""
    current_user = await require_authenticated_user(env, request)
    username = str(current_user['username'])
    email = str(current_user.get('email') or username)

    if payload.get('confirmation') != ACCOUNT_DELETION_CONFIRMATION:
        raise AccountDeletionError(
            f'Type {ACCOUNT_DELETION_CONFIRMATION} to confirm account deletion.'
        )
    if not await verify_user_password(env, username, payload.get('currentPassword')):
        raise AccountDeletionError('Current password is incorrect.')

    rate_limit_keys = _account_rate_limit_keys(username, email)
    if len(rate_limit_keys) == 1:
        rate_limit_keys.append(rate_limit_keys[0])

    await execute_batch(
        env,
        [
            (
                'UPDATE client_error_log SET user_username = NULL WHERE user_username = ?',
                [username],
            ),
            (
                """
                UPDATE review_notices
                SET review_snapshot_json = '{"removedOnAccountDeletion":true}'
                WHERE review_id IN (
                    SELECT id FROM course_reviews WHERE username = ?
                )
                """,
                [username],
            ),
            (
                """
                DELETE FROM request_rate_limits
                WHERE scope = ? AND client_key IN (?, ?)
                """,
                [AUTH_LOGIN_POLICY.scope, rate_limit_keys[0], rate_limit_keys[1]],
            ),
            ('DELETE FROM user_auth WHERE username = ?', [username]),
        ],
    )

"""PBKDF2 password hashing, run by the runtime's native WebCrypto where available.

`hashlib.pbkdf2_hmac` executes all 310,000 iterations as interpreted Pyodide
bytecode. Measured against production that cost 421-538 ms of CPU per login,
which is most of a Worker's budget for a single request and was enough to make
`/api/auth/login` fail outright with "Worker exceeded CPU time limit". It also
holds the interpreter for that whole stretch, which widens the window for the
Pyodide GIL race that wedges concurrent requests (cloudflare/workerd#6624).

`crypto.subtle.deriveBits` computes the same PBKDF2-HMAC-SHA256 natively: same
salt, same iteration count, same 32-byte output. Stored hashes therefore stay
valid and no migration is needed — this is purely a change of executor.

`hashlib` stays as the fallback so unit tests (no JS bridge) and any runtime
without WebCrypto keep working, and so a broken fast path degrades into slow
logins rather than failed ones.
"""

from __future__ import annotations

from typing import Any

import hashlib

PASSWORD_PBKDF2_ITERATIONS = 310_000
DERIVED_KEY_BITS = 256

# Resolved on first use. The JS bridge either exists for the lifetime of an
# isolate or it does not, so probing once avoids paying an import failure on
# every request under the fallback.
_webcrypto_usable: bool | None = None


def hash_password_with_hashlib(password: str, salt_bytes: bytes, iterations: int) -> bytes:
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt_bytes, iterations)


def _to_js_bytes(data: bytes) -> Any:
    from js import Uint8Array

    buffer = Uint8Array.new(len(data))
    buffer.assign(data)
    return buffer


async def _hash_password_with_webcrypto(password: str, salt_bytes: bytes, iterations: int) -> bytes:
    from js import Object, Uint8Array, crypto
    from pyodide.ffi import to_js

    key = await crypto.subtle.importKey(
        'raw',
        _to_js_bytes(password.encode('utf-8')),
        'PBKDF2',
        False,
        to_js(['deriveBits']),
    )
    derived_bits = await crypto.subtle.deriveBits(
        to_js(
            {
                'name': 'PBKDF2',
                'salt': _to_js_bytes(salt_bytes),
                'iterations': iterations,
                'hash': 'SHA-256',
            },
            dict_converter=Object.fromEntries,
        ),
        key,
        DERIVED_KEY_BITS,
    )
    return Uint8Array.new(derived_bits).to_bytes()


async def hash_password_hex(
    password: str,
    salt_hex: str,
    iterations: int = PASSWORD_PBKDF2_ITERATIONS,
) -> str:
    """Return the hex PBKDF2-HMAC-SHA256 digest of a password for a given salt."""
    global _webcrypto_usable

    salt_bytes = bytes.fromhex(salt_hex)
    if _webcrypto_usable is not False:
        try:
            digest = await _hash_password_with_webcrypto(password, salt_bytes, iterations)
            _webcrypto_usable = True
            return digest.hex()
        except Exception as exc:  # noqa: BLE001 - any failure must degrade, not 500
            _webcrypto_usable = False
            # Surfaces in `wrangler tail`: logins still work, but slowly, and
            # the CPU-limit failures this change exists to remove will return.
            print(f'[auth] WebCrypto PBKDF2 unavailable, falling back to hashlib: {exc}')

    return hash_password_with_hashlib(password, salt_bytes, iterations).hex()

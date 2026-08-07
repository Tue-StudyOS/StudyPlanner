"""PBKDF2 password hashing.

Currently this always runs `hashlib`. The WebCrypto path below is dormant, and
the reason is worth recording because it is not discoverable from the docs:

    NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not
    supported (requested 310000).

Cloudflare Workers refuses `crypto.subtle.deriveBits` above 100,000 PBKDF2
iterations. PASSWORD_PBKDF2_ITERATIONS is 310,000, so every call would throw.

The motivation was cost. Measured against production, a login spends 421-538 ms
of CPU here, and `/api/auth/login` is the only endpoint that has failed with
"Worker exceeded CPU time limit". For scale: the same 310,000 iterations take
~313 ms as native OpenSSL and ~4.3 s as a pure-Python loop, so Pyodide's
`hashlib` is compiled C running in WASM at roughly 1.5x native — not
interpreted. Native WebCrypto would therefore have saved something in the
region of a third, not an order of magnitude.

Using it means dropping to <=100,000 iterations, which is a security decision
(it weakens hashing against offline attack) and needs a per-user iteration
count plus rehash-on-login to migrate the stored hashes. That call has not been
made, so nothing here changes behaviour today.

The two implementations agree byte for byte where both can run — same
algorithm, salt, iteration count and 32-byte output — which is what makes a
future switch a change of executor rather than a hash migration.
"""

from __future__ import annotations

from typing import Any

import hashlib

PASSWORD_PBKDF2_ITERATIONS = 310_000
DERIVED_KEY_BITS = 256

# Hard limit enforced by workerd, not a tunable.
WEBCRYPTO_MAX_PBKDF2_ITERATIONS = 100_000

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
    # Checked rather than attempted: above the cap workerd raises on every call,
    # and burning an exception per login to rediscover a fixed limit is waste.
    if iterations <= WEBCRYPTO_MAX_PBKDF2_ITERATIONS and _webcrypto_usable is not False:
        try:
            digest = await _hash_password_with_webcrypto(password, salt_bytes, iterations)
            _webcrypto_usable = True
            return digest.hex()
        except Exception as exc:  # noqa: BLE001 - any failure must degrade, not 500
            _webcrypto_usable = False
            # Surfaces in `wrangler tail`. Logins keep working via hashlib.
            print(f'[auth] WebCrypto PBKDF2 unavailable, falling back to hashlib: {exc}')

    return hash_password_with_hashlib(password, salt_bytes, iterations).hex()

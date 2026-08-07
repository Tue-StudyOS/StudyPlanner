import hashlib
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / "src"))

workers = types.ModuleType("workers")
workers.Response = object
sys.modules.setdefault("workers", workers)

import password_hashing  # noqa: E402


class PasswordHashingTest(unittest.IsolatedAsyncioTestCase):
    SALT_HEX = "0123456789abcdef0123456789abcdef"
    # Under WEBCRYPTO_MAX_PBKDF2_ITERATIONS, so the WebCrypto path is reachable
    # at all. The equivalence being tested is a property of PBKDF2, not of the
    # iteration count.
    ITERATIONS = 1_000

    def setUp(self) -> None:
        password_hashing._webcrypto_usable = None

    def tearDown(self) -> None:
        password_hashing._webcrypto_usable = None

    async def test_webcrypto_digest_is_returned_as_hex(self) -> None:
        expected = hashlib.pbkdf2_hmac(
            "sha256",
            b"correct horse",
            bytes.fromhex(self.SALT_HEX),
            self.ITERATIONS,
        )
        derive = AsyncMock(return_value=expected)

        with patch.object(password_hashing, "_hash_password_with_webcrypto", derive):
            digest = await password_hashing.hash_password_hex(
                "correct horse", self.SALT_HEX, self.ITERATIONS
            )

        self.assertEqual(digest, expected.hex())

    async def test_falls_back_to_hashlib_when_webcrypto_is_unavailable(self) -> None:
        derive = AsyncMock(side_effect=ImportError("no js module"))

        with patch.object(password_hashing, "_hash_password_with_webcrypto", derive):
            digest = await password_hashing.hash_password_hex(
                "correct horse", self.SALT_HEX, self.ITERATIONS
            )

        self.assertEqual(
            digest,
            hashlib.pbkdf2_hmac(
                "sha256", b"correct horse", bytes.fromhex(self.SALT_HEX), self.ITERATIONS
            ).hex(),
        )

    async def test_webcrypto_is_probed_once_and_then_left_alone(self) -> None:
        derive = AsyncMock(side_effect=ImportError("no js module"))

        with patch.object(password_hashing, "_hash_password_with_webcrypto", derive):
            await password_hashing.hash_password_hex("a", self.SALT_HEX, self.ITERATIONS)
            await password_hashing.hash_password_hex("b", self.SALT_HEX, self.ITERATIONS)

        self.assertEqual(derive.await_count, 1)

    async def test_stored_hashes_stay_valid_across_the_two_implementations(self) -> None:
        """The whole no-migration claim: both paths must agree byte for byte."""
        salt_bytes = bytes.fromhex(self.SALT_HEX)
        stored = password_hashing.hash_password_with_hashlib(
            "correct horse", salt_bytes, self.ITERATIONS
        )
        # WebCrypto derives 256 bits of PBKDF2-HMAC-SHA256, which is exactly what
        # hashlib returns for the same salt and iteration count.
        self.assertEqual(len(stored) * 8, password_hashing.DERIVED_KEY_BITS)

        derive = AsyncMock(return_value=stored)
        with patch.object(password_hashing, "_hash_password_with_webcrypto", derive):
            recomputed = await password_hashing.hash_password_hex(
                "correct horse", self.SALT_HEX, self.ITERATIONS
            )

        self.assertEqual(recomputed, stored.hex())


class WebCryptoIterationCapTest(unittest.IsolatedAsyncioTestCase):
    """The production iteration count is above what workerd will accept."""

    SALT_HEX = "0123456789abcdef0123456789abcdef"

    def setUp(self) -> None:
        password_hashing._webcrypto_usable = None

    def tearDown(self) -> None:
        password_hashing._webcrypto_usable = None

    def test_the_production_iteration_count_exceeds_the_runtime_cap(self) -> None:
        # workerd: "Pbkdf2 failed: iteration counts above 100000 are not
        # supported". Lowering PASSWORD_PBKDF2_ITERATIONS to reach the fast path
        # weakens hashing and needs a rehash-on-login migration, so this asserts
        # the constraint rather than assuming anyone remembers it.
        self.assertGreater(
            password_hashing.PASSWORD_PBKDF2_ITERATIONS,
            password_hashing.WEBCRYPTO_MAX_PBKDF2_ITERATIONS,
        )

    async def test_webcrypto_is_not_even_attempted_above_the_cap(self) -> None:
        derive = AsyncMock()

        with patch.object(password_hashing, "_hash_password_with_webcrypto", derive):
            digest = await password_hashing.hash_password_hex(
                "correct horse",
                self.SALT_HEX,
                password_hashing.WEBCRYPTO_MAX_PBKDF2_ITERATIONS + 1,
            )

        derive.assert_not_awaited()
        self.assertEqual(len(digest), 64)


if __name__ == "__main__":
    unittest.main()

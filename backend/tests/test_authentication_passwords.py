import sys
import types
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "src"))

workers = types.ModuleType("workers")
workers.Response = object
sys.modules.setdefault("workers", workers)

from services.authentication import RegistrationError, _validate_new_password  # noqa: E402


class PasswordPolicyTest(unittest.TestCase):
    def test_accepts_password_with_supported_length(self) -> None:
        self.assertEqual(_validate_new_password("abcdefgh"), "abcdefgh")

    def test_rejects_short_password(self) -> None:
        with self.assertRaisesRegex(RegistrationError, "at least 8"):
            _validate_new_password("short")

    def test_rejects_excessively_long_password(self) -> None:
        with self.assertRaisesRegex(RegistrationError, "at most 128"):
            _validate_new_password("x" * 129)


if __name__ == "__main__":
    unittest.main()

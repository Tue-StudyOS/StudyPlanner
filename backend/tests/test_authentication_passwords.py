import sys
import types
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "src"))

workers = types.ModuleType("workers")
workers.Response = object
sys.modules.setdefault("workers", workers)

from services.authentication import RegistrationError, _validate_password  # noqa: E402


class PasswordValidationTest(unittest.TestCase):
    def test_accepts_non_empty_password(self) -> None:
        self.assertEqual(_validate_password("test"), "test")
        self.assertEqual(_validate_password("short"), "short")

    def test_rejects_empty_password(self) -> None:
        with self.assertRaisesRegex(RegistrationError, "must not be empty"):
            _validate_password("")


if __name__ == "__main__":
    unittest.main()

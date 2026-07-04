import sys
import types
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "src"))

workers = types.ModuleType("workers")


class Response:
    def __init__(self, *args: object, **kwargs: object) -> None:
        self.args = args
        self.kwargs = kwargs


workers.Response = Response
sys.modules.setdefault("workers", workers)

from services.client_error_log import ClientErrorLogError, _validate_method, _validate_status  # noqa: E402


class ClientErrorLogValidationTest(unittest.TestCase):
    def test_validate_method_accepts_get(self) -> None:
        self.assertEqual(_validate_method("get"), "GET")

    def test_validate_method_rejects_unknown(self) -> None:
        with self.assertRaises(ClientErrorLogError):
            _validate_method("TRACE")

    def test_validate_status_accepts_zero(self) -> None:
        self.assertEqual(_validate_status(0), 0)

    def test_validate_status_rejects_out_of_range(self) -> None:
        with self.assertRaises(ClientErrorLogError):
            _validate_status(1000)


if __name__ == "__main__":
    unittest.main()

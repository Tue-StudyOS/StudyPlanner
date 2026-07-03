from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))

from request_utils import RequestBodyError, read_json_object


class _FakeRequest:
    def __init__(self, body: str) -> None:
        self._body = body
        self._json_called = False

    async def json(self) -> object:
        self._json_called = True
        raise RuntimeError('Body already used')

    async def text(self) -> str:
        if self._json_called:
            raise RuntimeError('Body already used')
        return self._body


class ReadJsonObjectTests(unittest.IsolatedAsyncioTestCase):
    async def test_reads_json_from_text_without_touching_json(self) -> None:
        payload = await read_json_object(_FakeRequest('{"identifier":"a","password":"b"}'))
        self.assertEqual(payload, {'identifier': 'a', 'password': 'b'})

    async def test_rejects_invalid_json(self) -> None:
        with self.assertRaises(RequestBodyError):
            await read_json_object(_FakeRequest('not-json'))

    async def test_rejects_non_object_json(self) -> None:
        with self.assertRaises(RequestBodyError):
            await read_json_object(_FakeRequest('[1, 2]'))

    async def test_returns_empty_object_for_blank_body(self) -> None:
        payload = await read_json_object(_FakeRequest('   '))
        self.assertEqual(payload, {})


if __name__ == '__main__':
    unittest.main()

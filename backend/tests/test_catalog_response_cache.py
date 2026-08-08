import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from services import catalog_response_cache  # noqa: E402


class CatalogResponseCacheTest(unittest.TestCase):
    def setUp(self) -> None:
        catalog_response_cache.clear()

    def test_round_trips_the_exact_bytes(self) -> None:
        key = catalog_response_cache.build_key(1000, "all")
        body = '{"count": 1, "title": "Übung"}'.encode("utf-8")
        catalog_response_cache.put(key, body)
        self.assertEqual(catalog_response_cache.get(key), body)

    def test_distinguishes_period_and_limit(self) -> None:
        # A shared key would serve one period's catalog for another, which is a
        # wrong answer rather than a slow one.
        self.assertNotEqual(
            catalog_response_cache.build_key(1000, "all"),
            catalog_response_cache.build_key(1000, "229"),
        )
        self.assertNotEqual(
            catalog_response_cache.build_key(500, "229"),
            catalog_response_cache.build_key(1000, "229"),
        )

    def test_absent_key_is_a_miss(self) -> None:
        self.assertIsNone(catalog_response_cache.get("nothing"))

    def test_missing_period_is_stable(self) -> None:
        self.assertEqual(
            catalog_response_cache.build_key(100, None),
            catalog_response_cache.build_key(100, ""),
        )

    def test_evicts_oldest_when_full(self) -> None:
        # Entries hold whole catalog payloads, so an unbounded cache would be a
        # memory leak keyed on user-supplied query parameters.
        for index in range(catalog_response_cache._MAX_ENTRIES + 3):
            catalog_response_cache.put(f"key-{index}", b"x")
        self.assertEqual(catalog_response_cache.size(), catalog_response_cache._MAX_ENTRIES)
        self.assertIsNone(catalog_response_cache.get("key-0"))
        self.assertIsNotNone(catalog_response_cache.get("key-10"))

    def test_overwriting_an_existing_key_does_not_evict(self) -> None:
        for index in range(catalog_response_cache._MAX_ENTRIES):
            catalog_response_cache.put(f"key-{index}", b"x")
        catalog_response_cache.put("key-0", b"updated")
        self.assertEqual(catalog_response_cache.size(), catalog_response_cache._MAX_ENTRIES)
        self.assertEqual(catalog_response_cache.get("key-0"), b"updated")


if __name__ == "__main__":
    unittest.main()

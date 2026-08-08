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

    def test_search_terms_get_their_own_entry(self) -> None:
        self.assertNotEqual(
            catalog_response_cache.build_key(1000, "all", "info"),
            catalog_response_cache.build_key(1000, "all", "mathe"),
        )
        self.assertNotEqual(
            catalog_response_cache.build_key(1000, "all", "info"),
            catalog_response_cache.build_key(1000, "all", None),
        )

    def test_search_key_is_normalised(self) -> None:
        # Users type the same broad prefix with different casing and trailing
        # spaces; those should share the one expensive entry.
        self.assertEqual(
            catalog_response_cache.build_key(1000, "all", "  Info "),
            catalog_response_cache.build_key(1000, "all", "info"),
        )

    def test_evicts_oldest_when_over_entry_limit(self) -> None:
        # Entries hold whole catalog payloads, so an unbounded cache would be a
        # memory leak keyed on user-supplied query parameters.
        for index in range(catalog_response_cache._MAX_ENTRIES + 3):
            catalog_response_cache.put(f"key-{index}", b"x")
        self.assertLessEqual(catalog_response_cache.size(), catalog_response_cache._MAX_ENTRIES)
        self.assertIsNone(catalog_response_cache.get("key-0"))
        self.assertIsNotNone(catalog_response_cache.get(f"key-{catalog_response_cache._MAX_ENTRIES + 2}"))

    def test_evicts_to_stay_within_the_byte_budget(self) -> None:
        chunk = b"y" * (catalog_response_cache._MAX_BYTES // 4)
        for index in range(6):
            catalog_response_cache.put(f"big-{index}", chunk)
        self.assertLessEqual(catalog_response_cache.total_bytes(), catalog_response_cache._MAX_BYTES)
        self.assertIsNotNone(catalog_response_cache.get("big-5"))

    def test_body_larger_than_the_budget_is_not_cached(self) -> None:
        # Storing it would evict everything else to make room for something that
        # cannot be kept anyway.
        catalog_response_cache.put("small", b"keep me")
        catalog_response_cache.put("huge", b"z" * (catalog_response_cache._MAX_BYTES + 1))
        self.assertIsNone(catalog_response_cache.get("huge"))
        self.assertEqual(catalog_response_cache.get("small"), b"keep me")

    def test_overwriting_an_existing_key_keeps_byte_total_correct(self) -> None:
        catalog_response_cache.put("key", b"xxxxx")
        catalog_response_cache.put("key", b"yy")
        self.assertEqual(catalog_response_cache.size(), 1)
        self.assertEqual(catalog_response_cache.total_bytes(), 2)
        self.assertEqual(catalog_response_cache.get("key"), b"yy")


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import json
import re
from typing import Any

# These prefixes identify the PO 2021 program-specific Veranstaltung groups.
PROGRAM_PREFIXES = {
    'MScInfo-': 'MSC_INFO_2021',
    'MSc-MACH-': 'MSC_ML_2021',
    'BSc-INFM': 'BSC_INFO_2021',
    'BSc-MEINFM': 'BSC_MEDIENINFO_2021',
    'BSc-MDZINFM': 'BSC_MEDIZININFO_2021',
    'BSc-BIOINFM': 'BSC_BIOINFO_2021',
}
CREDIT_GROUP = re.compile(r'-21-VG\d+\b.*\((\d+(?:[.,]\d+)?)\s*CP\)', re.IGNORECASE)


def get_tree_credit_options(variants: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Only use the nearest credit-bearing course group, never an area total."""
    labels_by_program: dict[str, dict[float, set[str]]] = {}
    for variant in variants:
        raw = variant.get('catalogTreePathsJson') or '[]'
        paths = json.loads(raw)
        if not isinstance(paths, list):
            raise ValueError('Invalid catalog tree paths')
        for path in paths:
            if not isinstance(path, list) or not all(isinstance(label, str) for label in path):
                raise ValueError('Invalid catalog tree path')
            for label in reversed(path[:-1]):
                match = CREDIT_GROUP.search(label)
                if not match:
                    continue
                program = next((code for prefix, code in PROGRAM_PREFIXES.items() if label.startswith(prefix)), None)
                if program:
                    credits = float(match.group(1).replace(',', '.'))
                    if credits > 0:
                        labels_by_program.setdefault(program, {}).setdefault(credits, set()).add(label)
                break
    return [
        {'programCode': program, 'ects': credits, 'sourceLabels': sorted(labels)}
        for program, candidates in sorted(labels_by_program.items())
        for credits, labels in sorted(candidates.items())
    ]


def get_unambiguous_tree_credits(options: list[dict[str, Any]]) -> float | None:
    candidates = {option['ects'] for option in options}
    return next(iter(candidates)) if len(candidates) == 1 else None


CATALOG_TREE_CREDITS_CTE = """
WITH tree_paths AS (
    SELECT unit_id, period_id, json_group_array(json(path_titles_json)) AS paths_json
    FROM catalog_nodes
    WHERE kind = 'Veranstaltung' AND unit_id IS NOT NULL
    GROUP BY unit_id, period_id
)
"""

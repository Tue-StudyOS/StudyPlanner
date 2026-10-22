from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend' / 'src'))
sys.path.insert(0, str(ROOT / 'backend' / 'scripts'))
from regulation_seed_data import PROGRAM_SPECS  # noqa: E402
from services.official_regulations import get_official_regulation  # noqa: E402

BACKEND_REFERENCES = {
    'bsc_informatik_2021.json': 'BSC_INFO_2021',
    'msc_informatik_2021.json': 'MSC_INFO_2021',
    'msc_machine_learning_2021.json': 'MSC_ML_2021',
}


def sync() -> int:
    for spec in PROGRAM_SPECS:
        source = ROOT / 'einzupflegene_po' / spec.filename
        payload = json.loads(source.read_text(encoding='utf-8'))
        policy = get_official_regulation(spec.code)
        if policy is None:
            raise ValueError(f'Missing official PO data for {spec.code}')
        payload['pruefungsordnung'] = 'PO 2021'
        payload['po_datum'] = '25.03.2021 (Rektor-Zustimmung; erstmals WS 2021/22)'
        payload['gesamt_ects'] = policy['totalEcts']
        payload['quelle'] = policy['sourceUrl']
        payload['quelle_hinweis'] = 'Official statute §5, amendments, and handbook; derived JSON is not an authoritative legal source.'
        payload['module'] = [
            {
                'bereich': group['name'],
                'code': group['code'],
                'typ': group['groupType'],
                'gesamt_ects_bereich': group['requiredEcts'],
                'hinweis': group.get('notes') or '',
                'module': [
                    {
                        'id': module['code'], 'name': module['name'],
                        'ects': module['ects'], 'typ': module['kind'],
                        'aliases': module['aliases'],
                    }
                    for module in group['modules']
                ],
            }
            for group in policy['ruleGroups']
        ]
        payload['credit_policy'] = policy
        source.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{spec.filename}: {len(policy["ruleGroups"])} official rule groups')
    for filename, code in BACKEND_REFERENCES.items():
        policy = get_official_regulation(code)
        assert policy is not None
        source = ROOT / 'backend' / 'data' / 'regulations' / filename
        payload = json.loads(source.read_text(encoding='utf-8'))
        payload.pop('note', None)
        payload.update({
            'version_label': '2021', 'total_ects': policy['totalEcts'],
            'effective_from': 'WS2021/22', 'source': policy['sourceUrl'],
            'credit_policy': policy,
            'areas': [
                {'code': group['code'], 'name': group['name'],
                 'required_ects': group['requiredEcts'], 'type': group['groupType'],
                 'modules': group['modules']}
                for group in policy['ruleGroups']
            ],
        })
        source.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{filename}: {len(policy["ruleGroups"])} official rule groups')
    return 0


if __name__ == '__main__':
    raise SystemExit(sync())

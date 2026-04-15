"""Patch CAT003 sanitaryware options with images, specs, and has_upgrade."""
import pymongo, os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
uri = os.environ['MONGODB_URI']
client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=15000, tlsAllowInvalidCertificates=True)
db = client['capstone_portal']

BASE = '/static/options/CAT003'

STD_LIST = [
    {'path': f'{BASE}/std_wc.png',          'label': 'WC'},
    {'path': f'{BASE}/std_wash_basin.png',  'label': 'Wash Basin'},
]

SERIES = {
    'HAPPY D2': {
        'ids': ['OPT-BP-001', 'OPT-BP-002', 'OPT-BP-003', 'OPT-BP-004'],
        'upgrade_spec': 'Happy D2 Series',
        'upgrade_list': [
            {'path': f'{BASE}/happyd2_wc.png',          'label': 'WC'},
            {'path': f'{BASE}/happyd2_wash_basin.png',  'label': 'Wash Basin'},
            {'path': f'{BASE}/happyd2_bathtub.png',     'label': 'Bathtub'},
            {'path': f'{BASE}/happyd2_jacuzzi.jpeg',    'label': 'Jacuzzi'},
        ],
        'upgrade': f'{BASE}/happyd2_wc.png',
    },
    'QATEGO': {
        'ids': ['OPT-BP-005', 'OPT-BP-006', 'OPT-BP-007', 'OPT-BP-008'],
        'upgrade_spec': 'Qatego Series',
        'upgrade_list': [
            {'path': f'{BASE}/qatego_wc.png',           'label': 'WC'},
            {'path': f'{BASE}/qatego_wash_basin.jpeg',  'label': 'Wash Basin'},
            {'path': f'{BASE}/qatego_bathtub.png',      'label': 'Bathtub'},
        ],
        'upgrade': f'{BASE}/qatego_wc.png',
    },
    'ZENCHA': {
        'ids': ['OPT-BP-009', 'OPT-BP-010', 'OPT-BP-011', 'OPT-BP-012'],
        'upgrade_spec': 'Zencha Series',
        'upgrade_list': [
            {'path': f'{BASE}/zencha_wash_basin.png',  'label': 'Wash Basin'},
            {'path': f'{BASE}/zencha_bathtub.png',     'label': 'Bathtub'},
            {'path': f'{BASE}/zencha_jacuzzi.png',     'label': 'Jacuzzi'},
        ],
        'upgrade': f'{BASE}/zencha_wash_basin.png',
    },
}

for series_name, cfg in SERIES.items():
    for oid in cfg['ids']:
        r = db.customization_options.update_one(
            {'option_id': oid},
            {'$set': {
                'has_upgrade': True,
                'standard_spec': 'Standard Sanitaryware',
                'upgrade_spec': cfg['upgrade_spec'],
                'images': {
                    'standard': f'{BASE}/std_wc.png',
                    'standard_list': STD_LIST,
                    'upgrade': cfg['upgrade'],
                    'upgrade_list': cfg['upgrade_list'],
                },
            }}
        )
        print(f"{oid} ({series_name}): {'updated' if r.modified_count else 'no change'}")

print('\nDone.')

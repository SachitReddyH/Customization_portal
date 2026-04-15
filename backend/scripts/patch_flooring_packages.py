"""
Patch the 4 flooring packages to new names/rooms_covered/images.
Silver / Gold / Platinum / Diamond
"""
import pymongo, os, sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
uri = os.environ['MONGODB_URI']
client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=15000, tlsAllowInvalidCertificates=True)
db = client['capstone_portal']

TILES   = 'Botticino Classic Light- Tiles'
WOODEN  = 'Laminated Wooden Flooring'
MARBLE  = 'Italian Botticino Marble'

def rc(loc_id: str, std: str = TILES) -> dict:
    return {'location_id': loc_id, 'standard_spec': std, 'upgrade_spec': MARBLE, 'has_upgrade': True}

PACKAGES = [
    {
        'option_id': 'OPT-FP-001',
        'option_name': 'Silver Package',
        'description': 'Areas Covered: Master Bedroom, Family Lounge & 1st Floor Corridor/Passage, 2nd Floor Corridor/Passage',
        'rooms_covered': [
            rc('LOC010', WOODEN),   # Master Bedroom
            rc('LOC015'),            # Family Lounge
            rc('LOC016'),            # First Floor Corridor
            rc('LOC021'),            # Second Floor Corridor
        ],
        'images': {
            'standard_list': [
                {'path': '/static/flooring_images/standard_wooden.jpeg',  'label': 'Wooden Flooring (Master Bedroom)'},
                {'path': '/static/flooring_images/standard_tiles.jpeg',   'label': 'Botticino Classico Light Tiles'},
            ],
            'upgrade': '/static/flooring_images/upgrade_marble.png',
        },
    },
    {
        'option_id': 'OPT-FP-002',
        'option_name': 'Gold Package',
        'description': 'Areas Covered: All Bedrooms, Family Lounge & 1st Floor Corridor/Passage, 2nd Floor Corridor/Passage',
        'rooms_covered': [
            rc('LOC003'),            # Bedroom 1
            rc('LOC010', WOODEN),   # Master Bedroom
            rc('LOC013'),            # Bedroom 2
            rc('LOC017'),            # Bedroom 3
            rc('LOC015'),            # Family Lounge
            rc('LOC016'),            # First Floor Corridor
            rc('LOC021'),            # Second Floor Corridor
        ],
        'images': {
            'standard_list': [
                {'path': '/static/flooring_images/standard_wooden.jpeg',  'label': 'Wooden Flooring (Master Bedroom)'},
                {'path': '/static/flooring_images/standard_tiles.jpeg',   'label': 'Botticino Classico Light Tiles'},
            ],
            'upgrade': '/static/flooring_images/upgrade_marble.png',
        },
    },
    {
        'option_id': 'OPT-FP-003',
        'option_name': 'Platinum Package',
        'description': 'Areas Covered: All Bedrooms, Master Bedroom Bathroom Walls, Kitchen, Home Theatre, Family Lounge & 1st Floor Corridor/Passage, 2nd Floor Corridor/Passage',
        'rooms_covered': [
            rc('LOC002'),            # Kitchen
            rc('LOC003'),            # Bedroom 1
            rc('LOC010', WOODEN),   # Master Bedroom
            rc('LOC012'),            # Master Bedroom Toilet (Wall)
            rc('LOC013'),            # Bedroom 2
            rc('LOC015'),            # Family Lounge
            rc('LOC016'),            # First Floor Corridor
            rc('LOC017'),            # Bedroom 3
            rc('LOC020'),            # Home Theatre Room
            rc('LOC021'),            # Second Floor Corridor
        ],
        'images': {
            'standard_list': [
                {'path': '/static/flooring_images/standard_wooden.jpeg',  'label': 'Wooden Flooring (Master Bedroom)'},
                {'path': '/static/flooring_images/standard_tiles.jpeg',   'label': 'Botticino Classico Light Tiles'},
            ],
            'upgrade': '/static/flooring_images/upgrade_marble.png',
        },
    },
    {
        'option_id': 'OPT-FP-004',
        'option_name': 'Diamond Package',
        'description': 'Areas Covered: Full Villa - All Bedrooms, All Bedroom Toilet Walls, Kitchen, Home Theatre, Family Lounge & 1st Floor Corridor/Passage, 2nd Floor Corridor/Passage',
        'rooms_covered': [
            rc('LOC002'),            # Kitchen
            rc('LOC003'),            # Bedroom 1
            rc('LOC004'),            # Toilet - Bedroom 1
            rc('LOC010', WOODEN),   # Master Bedroom
            rc('LOC012'),            # Master Bedroom Toilet
            rc('LOC013'),            # Bedroom 2
            rc('LOC014'),            # Toilet - Bedroom 2
            rc('LOC015'),            # Family Lounge
            rc('LOC016'),            # First Floor Corridor
            rc('LOC017'),            # Bedroom 3
            rc('LOC019'),            # Toilet - Bedroom 3
            rc('LOC020'),            # Home Theatre Room
            rc('LOC021'),            # Second Floor Corridor
        ],
        'images': {
            'standard_list': [
                {'path': '/static/flooring_images/standard_wooden.jpeg',  'label': 'Wooden Flooring (Master Bedroom)'},
                {'path': '/static/flooring_images/standard_tiles.jpeg',   'label': 'Botticino Classico Light Tiles'},
            ],
            'upgrade': '/static/flooring_images/upgrade_marble.png',
        },
    },
]

for pkg in PACKAGES:
    oid = pkg['option_id']
    result = db.customization_options.update_one(
        {'option_id': oid},
        {'$set': {
            'option_name':   pkg['option_name'],
            'description':   pkg['description'],
            'rooms_covered': pkg['rooms_covered'],
            'images':        pkg['images'],
        }}
    )
    status = 'updated' if result.modified_count else 'no change / not found'
    print(f"{oid} ({pkg['option_name']}): {status}")

print("\nDone.")

"""
Insert missing flooring options that weren't in the original seed:
- OPT-FL-018: Lift Wall Cladding (add-on, sub_section='individual')
- OPT-FL-019: Toilet - Bedroom 1 (sub_section='bathroom')

Run from backend/:
    python scripts/seed_missing_flooring.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()
client = MongoClient(os.getenv("MONGODB_URI"), tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=10_000)
db = client[os.getenv("DATABASE_NAME", "capstone_portal")]

now = datetime.now(timezone.utc)

missing = [
    {
        "option_id": "OPT-FL-018",
        "category_id": "CAT002",
        "sub_section": "individual",
        "location_id": "LOC022",
        "floor": "All Floors",
        "space": "Lift Wall Cladding",
        "room_code": "LIFT-CLAD",
        "rooms_covered": None,
        "option_type": "Add on",
        "option_name": "Lift Wall Cladding",
        "standard_spec": "Only Lift Opening - Italian Botticino Marble",
        "upgrade_spec": "Italian Botticino Marble (Full Wall Cladding)",
        "has_upgrade": True,
        "villa_type_applicable": ["All"],
        "facing_applicable": None,
        "price_inr": None,
        "price_unit": None,
        "price_status": "tbd",
        "package_tier": None,
        "description": "Lift Wall Cladding",
        "detailed_spec": None,
        "images": {"standard": None, "upgrade": None},
        "notes": "Can be given as an add-on",
        "sort_order": 18,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    },
    {
        "option_id": "OPT-FL-019",
        "category_id": "CAT002",
        "sub_section": "bathroom",
        "location_id": "LOC004",
        "floor": "Ground Floor",
        "space": "Toilet - Bedroom 1",
        "room_code": "GF-BR1-T",
        "rooms_covered": None,
        "option_type": "room-specific",
        "option_name": "Toilet - Bedroom 1",
        "standard_spec": "Wall: Cosmic Beige / Floor: Parget Beige",
        "upgrade_spec": "Wall & Floor: Italian Botticino Marble",
        "has_upgrade": True,
        "villa_type_applicable": ["All"],
        "facing_applicable": None,
        "price_inr": None,
        "price_unit": None,
        "price_status": "tbd",
        "package_tier": None,
        "description": "Toilet - Bedroom 1",
        "detailed_spec": None,
        "images": {"standard": None, "upgrade": None},
        "notes": None,
        "sort_order": 19,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    },
]

for doc in missing:
    exists = db.customization_options.find_one({"option_id": doc["option_id"]})
    if exists:
        print(f"  {doc['option_id']}: already exists, skipping")
    else:
        db.customization_options.insert_one(doc)
        print(f"  {doc['option_id']}: inserted ({doc['option_name']})")

print("\nDone.")
client.close()

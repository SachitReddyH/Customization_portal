"""Add Lift Cladding add-on option to CAT002 (Flooring Upgrades)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
client = MongoClient(os.getenv("MONGODB_URI"), tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=10_000)
db = client[os.getenv("DATABASE_NAME", "capstone_portal")]

# Check if already exists
existing = db.customization_options.find_one({"option_id": "OPT-FP-ADDON-001"})
if existing:
    print("OPT-FP-ADDON-001 already exists — updating")
    db.customization_options.update_one(
        {"option_id": "OPT-FP-ADDON-001"},
        {"$set": {
            "option_name": "Lift Cladding",
            "description": "Elevate every ascent with premium lift interior cladding",
            "detailed_spec": "Transform your lift interior with bespoke cladding panels crafted from premium materials. A refined finishing touch that complements the luxury aesthetic of your villa — making every journey between floors a curated experience.",
            "sub_section": "addon",
            "has_upgrade": True,
            "is_active": True,
            "images": {
                "upgrade": "/static/options/CAT002/addon_lift_cladding.jpg",
                "standard": "/static/options/CAT002/addon_lift_cladding.jpg",
            },
            "sort_order": 100,
        }}
    )
    print("  updated")
else:
    db.customization_options.insert_one({
        "option_id": "OPT-FP-ADDON-001",
        "category_id": "CAT002",
        "option_name": "Lift Cladding",
        "description": "Elevate every ascent with premium lift interior cladding",
        "detailed_spec": "Transform your lift interior with bespoke cladding panels crafted from premium materials. A refined finishing touch that complements the luxury aesthetic of your villa — making every journey between floors a curated experience.",
        "sub_section": "addon",
        "has_upgrade": True,
        "is_active": True,
        "images": {
            "upgrade": "/static/options/CAT002/addon_lift_cladding.jpg",
            "standard": "/static/options/CAT002/addon_lift_cladding.jpg",
        },
        "sort_order": 100,
        "price": None,
        "standard_spec": None,
        "upgrade_spec": None,
        "floor_plan_image": None,
        "rooms_covered": [],
    })
    print("  inserted OPT-FP-ADDON-001")

print("Done.")
client.close()

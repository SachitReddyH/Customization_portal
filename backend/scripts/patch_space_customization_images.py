"""
Patch: set standard + upgrade images for Space Customization (CAT001) options.

Run from backend/ directory:
    python scripts/patch_space_customization_images.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI")
DB_NAME   = os.getenv("DATABASE_NAME", "capstone_portal")

client = MongoClient(MONGO_URI, tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=10_000)
db     = client[DB_NAME]

BASE = "/static/options/CAT001"

PATCHES = [
    # Kitchen options — side by side comparison (standard not selectable)
    {
        "option_id": "OPT-SC-001",
        "images": {
            "standard":      f"{BASE}/std_kitchen.png",
            "standard_list": [{"path": f"{BASE}/std_kitchen.png", "label": "Standard Kitchen Layout"}],
            "upgrade":       f"{BASE}/upg_gourmet_kitchen.png",
            "upgrade_list":  [{"path": f"{BASE}/upg_gourmet_kitchen.png", "label": "Gourmet Kitchen with Dry & Wet Zones"}],
        },
        "has_upgrade": True,
    },
    {
        "option_id": "OPT-SC-002",
        "images": {
            "standard":      f"{BASE}/std_kitchen.png",
            "standard_list": [{"path": f"{BASE}/std_kitchen.png", "label": "Standard Kitchen Layout"}],
            "upgrade":       f"{BASE}/upg_maids_kitchen.png",
            "upgrade_list":  [{"path": f"{BASE}/upg_maids_kitchen.png", "label": "Kitchen with Maid's Room & Private Toilet"}],
        },
        "has_upgrade": True,
    },
    # Home Theatre — single upgrade image only (no side by side)
    {
        "option_id": "OPT-SC-003",
        "images": {
            "standard":      f"{BASE}/std_home_theatre.png",
            "standard_list": [],
            "upgrade":       f"{BASE}/upg_home_theatre.png",
            "upgrade_list":  [],
        },
        "has_upgrade": True,
    },
]

for p in PATCHES:
    opt_id = p.pop("option_id")
    r = db.customization_options.update_one({"option_id": opt_id}, {"$set": p})
    print(f"  {opt_id}: {'updated' if r.modified_count else 'no change / not found'}")

print("\nDone.")
client.close()

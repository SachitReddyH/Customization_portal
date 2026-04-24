"""
Patch: move Bathtub / Jacuzzi from upgrade_list to a new addon_list field
for all CAT003 sanitaryware options.

Each addon item gets a synthetic option_id  (<parent_id>-ADN-BAT / -ADN-JAC)
that the frontend uses when recording selections.

Run from backend/:
    python scripts/patch_bathroom_addons.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

client = MongoClient(
    os.getenv("MONGODB_URI"),
    tlsAllowInvalidCertificates=True,
    serverSelectionTimeoutMS=10_000,
)
db = client[os.getenv("DATABASE_NAME", "capstone_portal")]

ADDON_LABELS = {"bathtub", "jacuzzi"}

opts = list(db.customization_options.find(
    {"category_id": "CAT003", "sub_section": "sanitaryware"},
    {"_id": 1, "option_id": 1, "option_name": 1, "space": 1, "images": 1},
))

for opt in opts:
    upgrade_list = (opt.get("images") or {}).get("upgrade_list", [])
    if not upgrade_list:
        continue

    main_items  = []
    addon_items = []

    for item in upgrade_list:
        label_lower = item.get("label", "").lower()
        if label_lower in ADDON_LABELS:
            # Build synthetic option_id for this addon
            suffix = "ADN-BAT" if label_lower == "bathtub" else "ADN-JAC"
            addon_items.append({
                "path":      item["path"],
                "label":     item["label"],
                "option_id": f"{opt['option_id']}-{suffix}",
            })
        else:
            main_items.append(item)

    if not addon_items:
        print(f"  {opt['option_id']} ({opt['option_name']} / {opt['space']}): no addons found, skipping")
        continue

    result = db.customization_options.update_one(
        {"_id": opt["_id"]},
        {"$set": {
            "images.upgrade_list": main_items,
            "images.addon_list":   addon_items,
        }},
    )
    addon_names = [a["label"] for a in addon_items]
    main_names  = [m["label"] for m in main_items]
    status = "updated" if result.modified_count else "no change"
    print(f"  {opt['option_id']} ({opt['option_name']}): {status} | main={main_names} | addons={addon_names}")

print("\nDone.")
client.close()

"""
One-off patch: mark all CAT004 / CAT005 / CAT006 options as has_upgrade=True
and populate upgrade_spec from detailed_spec so the frontend shows them correctly.

Run from backend/ directory AFTER resuming your Atlas cluster:
    python3 scripts/patch_upgrade_flags.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI")
DB_NAME   = os.getenv("DATABASE_NAME", "capstone_portal")

# Categories where every option is an upgrade (no standard alternative)
UPGRADE_ONLY_CATS = ["CAT004", "CAT005", "CAT006"]


def main():
    if not MONGO_URI:
        print("ERROR: MONGODB_URI not set in .env"); sys.exit(1)

    print(f"Connecting to {DB_NAME} …")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    col = db.customization_options

    total_updated = 0

    for cat_id in UPGRADE_ONLY_CATS:
        # Count docs before patching so we can report
        docs = list(col.find({"category_id": cat_id}))
        print(f"\n{cat_id} — found {len(docs)} option(s)")

        for doc in docs:
            opt_id   = doc["option_id"]
            detailed = doc.get("detailed_spec") or doc.get("description")

            update = {
                "$set": {
                    "has_upgrade":   True,
                    "standard_spec": None,          # no standard alternative
                    "upgrade_spec":  detailed,      # spec content shown on upgrade card
                    "images.standard": None,
                    "images.upgrade":  doc.get("images", {}).get("upgrade")
                                       or "/static/options/placeholder/upgrade.png",
                }
            }

            result = col.update_one({"option_id": opt_id}, update)
            status = "✓ updated" if result.modified_count else "– already correct"
            print(f"  {opt_id}: {status}")
            total_updated += result.modified_count

    print(f"\nDone — {total_updated} document(s) patched.")
    client.close()


if __name__ == "__main__":
    main()

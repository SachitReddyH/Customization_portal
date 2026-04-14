"""
One-off patch: sync rooms_covered[].space/floor/room_code from the locations
collection into every package option's rooms_covered array.

After this runs, the embedded space/floor/room_code fields in rooms_covered will
always match the source-of-truth locations documents.  The frontend now reads
from the locations collection at runtime (via locationMap), so this patch also
strips out the redundant embedded fields to avoid future drift.

Run from backend/ directory with Atlas cluster running:
    python3 scripts/patch_rooms_covered_denorm.py
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

# ── Step 1: build a lookup map from the locations collection ──────────────────
locations = {
    loc["location_id"]: loc
    for loc in db.locations.find({}, {"location_id": 1, "space": 1, "floor": 1, "room_code": 1})
}
print(f"Loaded {len(locations)} locations")

# ── Step 2: find all options that have a rooms_covered array ──────────────────
options_col = db.customization_options
affected = list(options_col.find({"rooms_covered": {"$exists": True, "$ne": [], "$type": "array"}}))
print(f"Found {len(affected)} options with rooms_covered")

updated = 0
for opt in affected:
    new_covered = []
    changed = False
    for r in opt.get("rooms_covered", []):
        loc_id = r.get("location_id")
        loc    = locations.get(loc_id, {})
        entry  = {
            "location_id":   loc_id,
            "standard_spec": r.get("standard_spec"),
            "upgrade_spec":  r.get("upgrade_spec"),
            "has_upgrade":   r.get("has_upgrade", True),
        }
        # Detect if the embedded space differs from the locations collection
        if r.get("space") != loc.get("space") or "space" in r:
            changed = True
        new_covered.append(entry)

    if changed:
        options_col.update_one(
            {"_id": opt["_id"]},
            {"$set": {"rooms_covered": new_covered}}
        )
        updated += 1
        print(f"  Updated option {opt.get('option_id')} ({opt.get('option_name', '')})")

print(f"\nDone — {updated} options updated.")
client.close()

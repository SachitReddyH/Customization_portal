"""
Patch: reorganise CAT002 sub_sections for the new Bathroom (Wall & Flooring) tab.

Changes:
- OPT-FL-019, 021, 022, 023  ->  sub_section = 'bathroom'  (4 toilet rooms)
- OPT-FL-020                 ->  sub_section = 'bathroom'  (Powder Room add-on)
- OPT-FL-024                 ->  sub_section = 'bathroom'  (Ledges & Countertops add-on)
- OPT-FL-018                 ->  sub_section = 'individual' (Lift Cladding, stays in Room Upgrades)

Run from backend/:
    python scripts/patch_bathroom_tab.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
client = MongoClient(os.getenv("MONGODB_URI"), tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=10_000)
db = client[os.getenv("DATABASE_NAME", "capstone_portal")]

bathroom_opts = ["OPT-FL-019", "OPT-FL-020", "OPT-FL-021", "OPT-FL-022", "OPT-FL-023", "OPT-FL-024"]
individual_opts = ["OPT-FL-018"]

for opt_id in bathroom_opts:
    r = db.customization_options.update_one(
        {"option_id": opt_id},
        {"$set": {"sub_section": "bathroom", "has_upgrade": True}}
    )
    print(f"  {opt_id} -> bathroom  ({'updated' if r.modified_count else 'not found'})")

for opt_id in individual_opts:
    r = db.customization_options.update_one(
        {"option_id": opt_id},
        {"$set": {"sub_section": "individual", "has_upgrade": True}}
    )
    print(f"  {opt_id} -> individual  ({'updated' if r.modified_count else 'not found'})")

print("\nDone.")
client.close()

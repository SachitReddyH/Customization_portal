"""
Patch: set upgrade images for Space Customization (CAT001) options.

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

images = {
    "OPT-SC-001": "/static/options/CAT001/OPT-SC-001.png",
    "OPT-SC-002": "/static/options/CAT001/OPT-SC-002.png",
    "OPT-SC-003": "/static/options/CAT001/OPT-SC-003.png",
}

for opt_id, path in images.items():
    result = db.customization_options.update_one(
        {"option_id": opt_id},
        {"$set": {"images.upgrade": path, "images.standard": path}}
    )
    print(f"  {opt_id}: {'updated' if result.modified_count else 'not found'}")

print("\nDone.")
client.close()

"""Patch Smart Home (CAT006) options with actual images."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
client = MongoClient(os.getenv("MONGODB_URI"), tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=10_000)
db = client[os.getenv("DATABASE_NAME", "capstone_portal")]

updates = [
    ("OPT-SH-001", "/static/options/CAT006/smart-home-platinum.png"),
    ("OPT-SH-002", "/static/options/CAT006/smart-home-gold.png"),
]

for option_id, img_path in updates:
    result = db.customization_options.update_one(
        {"option_id": option_id},
        {"$set": {"images.upgrade": img_path}}
    )
    print(f"{option_id}: {'updated' if result.modified_count else 'not found'}")

print("Done.")
client.close()

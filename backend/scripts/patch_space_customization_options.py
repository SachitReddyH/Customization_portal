"""Patch Space Customization (CAT001) options with sub_section, names, and descriptions."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI")
DB_NAME   = os.getenv("DATABASE_NAME", "capstone_portal")

client = MongoClient(MONGO_URI, tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=10_000)
db     = client[DB_NAME]

OPTIONS = [
    {
        "option_id": "OPT-SC-001",
        "sub_section": "kitchen",
        "option_name": "Gourmet Kitchen with Dry & Wet Zones",
        "description": "Craft Culinary Masterpieces in Your Private Gourmet Kitchen",
        "detailed_spec": (
            "Indulge in a refined culinary space designed for the discerning home chef. "
            "This layout features a dedicated wet zone for prep and cooking, seamlessly "
            "paired with a dry zone for casual dining and coffee. Premium finishes, "
            "bespoke cabinetry, and optimised workflow make this kitchen the heart of "
            "the home — equal parts beauty and function."
        ),
    },
    {
        "option_id": "OPT-SC-002",
        "sub_section": "kitchen",
        "option_name": "Kitchen with Maid's Room & Private Toilet",
        "description": "Seamless Living with a Fully Equipped Staff Suite",
        "detailed_spec": (
            "Experience elevated living with a thoughtfully integrated maid's room and "
            "private toilet adjacent to the kitchen. This layout ensures complete "
            "operational independence for household staff, preserving the privacy and "
            "comfort of residents. Ideal for families who value seamless service without "
            "compromising on the elegance of their living spaces."
        ),
    },
    {
        "option_id": "OPT-SC-003",
        "sub_section": "home_theatre",
        "option_name": "Powder Room for Home Theatre / Private Office",
        "description": "Your Own Private Escape — Right Within Your Home",
        "detailed_spec": (
            "A versatile, self-contained space that adapts to your lifestyle. Whether "
            "you envision an immersive home theatre for cinematic experiences or a "
            "focused private office for productivity, this layout provides the "
            "perfect foundation — complemented by a convenient powder room for "
            "guests and family alike."
        ),
    },
]

for opt in OPTIONS:
    opt_id = opt.pop("option_id")
    result = db.customization_options.update_one(
        {"option_id": opt_id},
        {"$set": opt}
    )
    print(f"  {opt_id}: {'updated' if result.modified_count else 'no change / not found'}")

print("\nDone.")
client.close()

"""Insert / update the VRF/VRV option for CAT007."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
client = MongoClient(os.getenv("MONGODB_URI"), tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=10_000)
db = client[os.getenv("DATABASE_NAME", "capstone_portal")]

doc = {
    "option_id":   "OPT-VRF-001",
    "category_id": "CAT007",
    "option_name": "VRF/VRV Air Conditioning System",
    "sub_section": None,
    "has_upgrade": True,
    "is_active":   True,
    "standard_spec":  None,
    "upgrade_spec":   None,
    "price":          None,
    "price_status":   "on_request",
    "rooms_covered":  [],
    # Short headline shown under the option name
    "description": "One Smart System. Perfect Temperature. Every Room. Every Time.",
    # Intro paragraph
    "detailed_spec": (
        "Imagine walking into every room of your home and it is already at exactly the temperature "
        "you like — quietly, automatically, without you doing a thing. That is what the VRF/VRV "
        "upgrade delivers. Instead of individual air conditioners in each room, one intelligent "
        "system runs through your entire villa, giving every room its own perfect climate while "
        "using dramatically less electricity. No noise. No clutter outside your home. Just "
        "seamless, effortless comfort — controlled from your phone."
    ),
    # "What Makes It Different" bullets (title — detail format)
    "vrf_benefits": [
        "Saves you money — Cut your electricity bills by up to 50% every year. That is a saving of ₹1 to ₹1.25 Lakhs annually",
        "Every room, your way — Each room can have its own temperature. No more arguments over the thermostat",
        "Cleaner home exterior — One compact outdoor unit instead of multiple boxes on your walls and balconies",
        "Whisper quiet — You will not hear it running. Inside or outside",
        "Control from anywhere — Adjust your home's temperature from your phone before you even arrive",
        "Built to last — Fewer breakdowns, lower maintenance, longer life than conventional ACs",
        "Adds to your home's value — A VRF system is a feature serious buyers look for",
    ],
    # Technical specifications as "Label: Value" strings
    "vrf_tech_specs": [
        "System Type: Variable Refrigerant Flow / Variable Refrigerant Volume (VRF/VRV)",
        "Configuration: Single outdoor condensing unit connected to multiple indoor fan coil units",
        "Technology: Inverter-driven compressor with variable speed operation",
        "Zoning: Individual room-level temperature control via dedicated indoor units",
        "Indoor Unit Types: Ceiling cassette, ducted, wall-mounted (as per room requirement)",
        "Operation: Simultaneous heating and cooling capability across zones",
        "Control: Centralized wired controller + app-based remote management",
        "Refrigerant: Eco-friendly R32 / R410A (as per system specification)",
        "Energy Efficiency: High ISEER rated system — significantly exceeds standard split AC efficiency",
        "Noise Level: Ultra-low decibel operation, both indoor and outdoor units",
        "Maintenance: Centralized servicing — single system, lower upkeep versus multiple split units",
    ],
    "images": {
        "upgrade": "/static/options/CAT007/NJjFhZigyeDP4-uzvfb5m.png",
        "upgrade_list": [
            {"path": "/static/options/CAT007/NJjFhZigyeDP4-uzvfb5m.png",  "label": "VRF System"},
            {"path": "/static/options/CAT007/VRF-VRV-difference.png",      "label": "VRF vs VRV"},
            {"path": "/static/options/CAT007/u3a03qYIv9MrCBifACj8T.png",   "label": "Installation"},
        ],
        "standard": None,
    },
    "sort_order": 1,
}

existing = db.customization_options.find_one({"option_id": "OPT-VRF-001"})
if existing:
    db.customization_options.update_one({"option_id": "OPT-VRF-001"}, {"$set": doc})
    print("OPT-VRF-001: updated")
else:
    db.customization_options.insert_one(doc)
    print("OPT-VRF-001: inserted")

print("Done.")
client.close()

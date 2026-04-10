"""
Seed MongoDB with all data from:
  MSR_Portal_Data_Structure_intial-update.xlsx

Run from the backend/ directory:
    python3 scripts/seed_db.py

Requires .env to be configured with MONGODB_URI and DATABASE_NAME.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
from pymongo import MongoClient, ASCENDING
from datetime import datetime, timezone
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DATABASE_NAME", "capstone_portal")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@capstonelife.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@1234")
EXCEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "MSR_Portal_Data_Structure_intial-update.xlsx")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def clean(val):
    """Return None for NaN/empty, else the value."""
    if val is None:
        return None
    if isinstance(val, float) and np.isnan(val):
        return None
    s = str(val).strip()
    return None if s in ("", "nan", "NaN", "NaT") else s


def parse_price(val):
    """Returns (price_inr, price_status)."""
    raw = clean(val)
    if raw is None:
        return None, "tbd"
    low = raw.lower()
    if "request" in low:
        return None, "on_request"
    if "spec" in low:
        return None, "on_request"
    try:
        return float(str(raw).replace(",", "")), "fixed"
    except (ValueError, TypeError):
        return None, "tbd"


def floor_plan_urls(villa_type: str, facing: str) -> dict:
    base = "/static/floor_plans"
    if villa_type == "Type 1" and facing == "East":
        return {
            "ground_floor": f"{base}/type1_east_gf.png",
            "first_floor":  f"{base}/type1_east_ff.png",
            "second_floor": f"{base}/type1_east_sf.png",
        }
    if villa_type == "Type 2" and facing == "West":
        return {
            "ground_floor": f"{base}/type2_west_gf.png",
            "first_floor":  f"{base}/type2_west_ff.png",
            "second_floor": f"{base}/type2_west_sf.png",
        }
    # Type 3 and unknowns — placeholder
    return {"ground_floor": None, "first_floor": None, "second_floor": None}


def facing_applicable_from_notes(notes: str) -> str | None:
    """Detect EF-only or WF-only from notes."""
    if not notes:
        return None
    low = notes.lower()
    if "ef only" in low:
        return "East"
    if "wf only" in low:
        return "West"
    return None


def seed_villas(db, xl):
    print("Seeding villas...")
    df = pd.read_excel(xl, sheet_name="0_Villa Details", header=None)
    # Row 1 is header, rows 2+ are data
    now = datetime.now(timezone.utc)
    docs = []
    for _, row in df.iloc[2:].iterrows():
        villa_name = clean(row[1])
        if not villa_name:
            continue
        villa_num = int("".join(filter(str.isdigit, villa_name)))
        villa_type = clean(row[3]) or "Unknown"
        facing = clean(row[4]) or "Unknown"
        plot_size = clean(row[5])
        if plot_size and plot_size.upper() == "ODD":
            plot_size = "Irregular"

        area_raw = clean(row[6])
        plot_area = None
        if area_raw:
            try:
                plot_area = float(area_raw)
            except ValueError:
                pass

        docs.append({
            "villa_number": villa_num,
            "villa_name": villa_name,
            "phase": 3,
            "villa_type": villa_type,
            "facing": facing,
            "plot_size": plot_size,
            "plot_area_sqft": plot_area,
            "floor_plans": floor_plan_urls(villa_type, facing),
            "master_plan_url": "/static/floor_plans/master_plan.png",
            "is_assigned": False,
            "created_at": now,
        })

    db.villas.drop()
    db.villas.create_index("villa_number", unique=True)
    if docs:
        db.villas.insert_many(docs)
    print(f"  Inserted {len(docs)} villas")


def seed_categories(db, xl):
    print("Seeding categories...")
    df = pd.read_excel(xl, sheet_name="Categories", header=0)
    df.columns = ["Category_ID", "Category_Name", "Tagline", "Sort_Order", "Notes"]

    # CAT002 (Flooring) and CAT003 (Bathroom) use room-based navigation
    room_based = {"CAT002", "CAT003"}

    docs = []
    for _, row in df.iterrows():
        cat_id = clean(row["Category_ID"])
        if not cat_id:
            continue
        docs.append({
            "category_id": cat_id,
            "name": clean(row["Category_Name"]),
            "tagline": clean(row["Tagline"]),
            "sort_order": int(row["Sort_Order"]) if pd.notna(row["Sort_Order"]) else 99,
            "notes": clean(row["Notes"]),
            "navigation_type": "room_based" if cat_id in room_based else "direct",
            "image_url": None,
            "is_active": True,
        })

    db.categories.drop()
    db.categories.create_index("category_id", unique=True)
    if docs:
        db.categories.insert_many(docs)
    print(f"  Inserted {len(docs)} categories")


def seed_locations(db, xl):
    print("Seeding locations...")
    df = pd.read_excel(xl, sheet_name="Locations", header=0)
    df.columns = ["Location_ID", "Floor", "Space", "Room_Code"]

    floor_order_map = {
        "Ground Floor": 1,
        "First Floor": 2,
        "Second Floor": 3,
        "All Floors": 4,
    }

    docs = []
    for _, row in df.iterrows():
        loc_id = clean(row["Location_ID"])
        if not loc_id:
            continue
        floor = clean(row["Floor"]) or "Ground Floor"
        docs.append({
            "location_id": loc_id,
            "floor": floor,
            "space": clean(row["Space"]),
            "room_code": clean(row["Room_Code"]),
            "floor_order": floor_order_map.get(floor, 99),
        })

    db.locations.drop()
    db.locations.create_index("location_id", unique=True)
    if docs:
        db.locations.insert_many(docs)
    print(f"  Inserted {len(docs)} locations")


def seed_space_customizations(db, xl):
    """CAT001 — Space Customizations (direct navigation)."""
    df = pd.read_excel(xl, sheet_name="1 Space-Customization", header=0)
    df.columns = ["Option_ID", "Category_ID", "Location_ID", "Floor", "Space", "Room_Code",
                  "Option_Type", "Villa_Type_Applicable", "Description"]
    now = datetime.now(timezone.utc)
    docs = []
    for i, row in df.iterrows():
        opt_id = clean(row["Option_ID"])
        if not opt_id:
            continue
        docs.append({
            "option_id": opt_id,
            "category_id": clean(row["Category_ID"]),
            "sub_section": None,
            "location_id": clean(row["Location_ID"]),
            "floor": clean(row["Floor"]),
            "space": clean(row["Space"]),
            "room_code": clean(row["Room_Code"]),
            "rooms_covered": None,
            "option_type": clean(row["Option_Type"]),
            "option_name": clean(row["Description"]),
            "standard_spec": None,
            "upgrade_spec": None,
            "has_upgrade": False,
            "villa_type_applicable": ["All"],
            "facing_applicable": None,
            "price_inr": None,
            "price_unit": None,
            "price_status": "tbd",
            "package_tier": None,
            "description": clean(row["Description"]),
            "detailed_spec": None,
            "images": {
                "standard": "/static/options/placeholder/standard.png",
                "upgrade": None,
            },
            "notes": None,
            "sort_order": i + 1,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })
    return docs


def seed_flooring_individual(db, xl):
    """CAT002 sub_section='individual' — per-room standard vs upgrade."""
    df = pd.read_excel(xl, sheet_name="2a Flooring-Standard&Upgrades", header=0)
    df.columns = ["Option_ID", "Category_ID", "Location_ID", "Floor", "Space", "Room_Code",
                  "Option_Type", "Standard_Spec", "Upgrade_Spec", "Villa_Type_Applicable", "Notes"]
    now = datetime.now(timezone.utc)
    docs = []
    for i, row in df.iterrows():
        opt_id = clean(row["Option_ID"])
        if not opt_id:
            continue
        std_spec = clean(row["Standard_Spec"])
        upg_spec = clean(row["Upgrade_Spec"])
        has_upgrade = upg_spec is not None and upg_spec.upper() != "NA"
        notes = clean(row["Notes"])
        facing = facing_applicable_from_notes(notes)

        docs.append({
            "option_id": opt_id,
            "category_id": "CAT002",
            "sub_section": "individual",
            "location_id": clean(row["Location_ID"]),
            "floor": clean(row["Floor"]),
            "space": clean(row["Space"]),
            "room_code": clean(row["Room_Code"]),
            "rooms_covered": None,
            "option_type": clean(row["Option_Type"]),
            "option_name": None,
            "standard_spec": std_spec,
            "upgrade_spec": upg_spec if has_upgrade else None,
            "has_upgrade": has_upgrade,
            "villa_type_applicable": ["All"],
            "facing_applicable": facing,
            "price_inr": None,
            "price_unit": None,
            "price_status": "tbd",
            "package_tier": None,
            "description": None,
            "detailed_spec": None,
            "images": {
                "standard": "/static/options/placeholder/standard.png",
                "upgrade": "/static/options/placeholder/upgrade.png" if has_upgrade else None,
            },
            "notes": notes,
            "sort_order": i + 1,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })
    return docs


def seed_flooring_packages(db, xl):
    """CAT002 sub_section='package' — one doc per unique package option."""
    df = pd.read_excel(xl, sheet_name="2b_Flooring-packages", header=0)
    df.columns = ["Option_ID", "Category_ID", "Location_ID", "Floor", "Space", "Room_Code",
                  "Option_Name", "Standard_Spec", "Upgrade_Spec", "Villa_Type_Applicable", "Notes"]
    now = datetime.now(timezone.utc)

    # Group by Option_ID → one doc with rooms_covered array
    grouped = {}
    for _, row in df.iterrows():
        opt_id = clean(row["Option_ID"])
        if not opt_id:
            continue
        if opt_id not in grouped:
            upg_spec = clean(row["Upgrade_Spec"])
            has_upgrade = upg_spec is not None and upg_spec.upper() != "NA"
            grouped[opt_id] = {
                "option_id": opt_id,
                "category_id": "CAT002",
                "sub_section": "package",
                "location_id": None,
                "floor": None,
                "space": None,
                "room_code": None,
                "rooms_covered": [],
                "option_type": "package",
                "option_name": clean(row["Option_Name"]),
                "standard_spec": None,
                "upgrade_spec": None,
                "has_upgrade": has_upgrade,
                "villa_type_applicable": ["All"],
                "facing_applicable": None,
                "price_inr": None,
                "price_unit": None,
                "price_status": "tbd",
                "package_tier": None,
                "description": clean(row["Option_Name"]),
                "detailed_spec": None,
                "images": {
                    "standard": "/static/options/placeholder/standard.png",
                    "upgrade": "/static/options/placeholder/upgrade.png" if has_upgrade else None,
                },
                "notes": clean(row["Notes"]),
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }

        upg = clean(row["Upgrade_Spec"])
        has_upg = upg is not None and upg.upper() != "NA"
        grouped[opt_id]["rooms_covered"].append({
            "location_id": clean(row["Location_ID"]),
            "floor": clean(row["Floor"]),
            "space": clean(row["Space"]),
            "room_code": clean(row["Room_Code"]),
            "standard_spec": clean(row["Standard_Spec"]),
            "upgrade_spec": upg if has_upg else None,
            "has_upgrade": has_upg,
        })

    docs = list(grouped.values())
    for i, d in enumerate(docs):
        d["sort_order"] = i + 1
    return docs


def seed_bathroom_sanitaryware(db, xl):
    """CAT003 sub_section='sanitaryware'."""
    df = pd.read_excel(xl, sheet_name="3a_BathroomUpgrades-Sanitarywar", header=0)
    df.columns = ["Option_ID", "Category_ID", "Location_ID", "Villa_Type", "Standard_Upgrade",
                  "Option_Name", "Package_Tier", "Price_INR", "Pricing_Unit", "Detailed_Spec"]
    now = datetime.now(timezone.utc)
    docs = []
    # Get location details
    for i, row in df.iterrows():
        opt_id = clean(row["Option_ID"])
        if not opt_id:
            continue
        price_inr, price_status = parse_price(row["Price_INR"])
        detailed = clean(row["Detailed_Spec"])
        # Clean up _x000B_ artifacts from Excel
        if detailed:
            detailed = detailed.replace("_x000B_", "\n").strip()

        docs.append({
            "option_id": opt_id,
            "category_id": "CAT003",
            "sub_section": "sanitaryware",
            "location_id": clean(row["Location_ID"]),
            "floor": None,      # enriched below
            "space": None,
            "room_code": None,
            "rooms_covered": None,
            "option_type": "room-specific",
            "option_name": clean(row["Option_Name"]),
            "standard_spec": None,
            "upgrade_spec": None,
            "has_upgrade": True,    # All bathroom options are upgrades
            "villa_type_applicable": ["All"],
            "facing_applicable": None,
            "price_inr": price_inr,
            "price_unit": clean(row["Pricing_Unit"]),
            "price_status": price_status,
            "package_tier": clean(row["Package_Tier"]),
            "description": clean(row["Option_Name"]),
            "detailed_spec": detailed,
            "images": {
                "standard": "/static/options/placeholder/standard.png",
                "upgrade": "/static/options/placeholder/upgrade.png",
            },
            "notes": None,
            "sort_order": i + 1,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })
    return docs


def seed_bathroom_cp(db, xl):
    """CAT003 sub_section='cp_fittings'."""
    df = pd.read_excel(xl, sheet_name="3b_Bathroom Upgrades-CP", header=0)
    df.columns = ["Option_ID", "Category_ID", "Location_ID", "Villa_Type", "Standard_Upgrade",
                  "Option_Name", "Package_Tier", "Price_INR", "Pricing_Unit", "Detailed_Spec"]
    now = datetime.now(timezone.utc)
    docs = []
    for i, row in df.iterrows():
        opt_id = clean(row["Option_ID"])
        if not opt_id:
            continue
        price_inr, price_status = parse_price(row["Price_INR"])
        docs.append({
            "option_id": opt_id,
            "category_id": "CAT003",
            "sub_section": "cp_fittings",
            "location_id": clean(row["Location_ID"]),
            "floor": None,
            "space": None,
            "room_code": None,
            "rooms_covered": None,
            "option_type": "room-specific",
            "option_name": clean(row["Option_Name"]),
            "standard_spec": None,
            "upgrade_spec": None,
            "has_upgrade": True,
            "villa_type_applicable": ["All"],
            "facing_applicable": None,
            "price_inr": price_inr,
            "price_unit": clean(row["Pricing_Unit"]),
            "price_status": price_status,
            "package_tier": clean(row["Package_Tier"]),
            "description": clean(row["Option_Name"]),
            "detailed_spec": clean(row["Detailed_Spec"]),
            "images": {
                "standard": "/static/options/placeholder/standard.png",
                "upgrade": "/static/options/placeholder/upgrade.png",
            },
            "notes": None,
            "sort_order": i + 1,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })
    return docs


def seed_lift_interior(db, xl):
    """CAT004 — Lift Interior (direct navigation, 3 tiers)."""
    df = pd.read_excel(xl, sheet_name="4_Lift Interior", header=0)
    df.columns = ["Option_ID", "Category_ID", "Location_ID", "Villa_Type", "Standard_Upgrade",
                  "Option_Name", "Package_Tier", "Price_INR", "Pricing_Unit", "Detailed_Spec"]
    now = datetime.now(timezone.utc)
    docs = []
    for i, row in df.iterrows():
        opt_id = clean(row["Option_ID"])
        if not opt_id:
            continue
        price_inr, price_status = parse_price(row["Price_INR"])
        detailed = clean(row["Detailed_Spec"])
        docs.append({
            "option_id": opt_id,
            "category_id": "CAT004",
            "sub_section": None,
            "location_id": clean(row["Location_ID"]),
            "floor": "All Floors",
            "space": "Lift",
            "room_code": "LIFT-CLAD",
            "rooms_covered": None,
            "option_type": None,
            "option_name": clean(row["Option_Name"]),
            "standard_spec": None,
            "upgrade_spec": detailed,          # all options are upgrades; spec goes here
            "has_upgrade": True,               # every lift interior option is an upgrade
            "villa_type_applicable": ["All"],
            "facing_applicable": None,
            "price_inr": price_inr,
            "price_unit": clean(row["Pricing_Unit"]),
            "price_status": price_status,
            "package_tier": clean(row["Option_Name"]),  # Basic/Elite/Grandeur
            "description": detailed,
            "detailed_spec": detailed,
            "images": {
                "standard": None,
                "upgrade": "/static/options/placeholder/upgrade.png",
            },
            "notes": None,
            "sort_order": i + 1,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })
    return docs


def seed_landscape(db, xl):
    """CAT005 — Landscape Packages (direct navigation)."""
    df = pd.read_excel(xl, sheet_name="5_Landscape Packages", header=0)
    df.columns = ["Option_ID", "Category_ID", "Location_ID", "Villa_Type", "Standard_Upgrade",
                  "Option_Name", "Package_Tier", "Price_INR", "Pricing_Unit", "Detailed_Spec"]
    now = datetime.now(timezone.utc)
    docs = []
    # Location details: LOC024=Setback/Ground, LOC025=Terrace/Second
    location_details = {
        "LOC024": {"floor": "Ground Floor", "space": "Setback Area", "room_code": "GF-SET"},
        "LOC025": {"floor": "Second Floor", "space": "Semi Covered Terrace Area", "room_code": "SF-TA"},
    }
    for i, row in df.iterrows():
        opt_id = clean(row["Option_ID"])
        if not opt_id:
            continue
        price_inr, price_status = parse_price(row["Price_INR"])
        loc_id = clean(row["Location_ID"])
        loc = location_details.get(loc_id, {})
        # Full name from Option_Name column
        full_name = clean(row["Option_Name"])
        # Extract short name (before em dash)
        short_name = full_name.split("–")[0].split("-")[0].strip() if full_name else None
        detailed = clean(row["Detailed_Spec"])
        docs.append({
            "option_id": opt_id,
            "category_id": "CAT005",
            "sub_section": None,
            "location_id": loc_id,
            "floor": loc.get("floor"),
            "space": loc.get("space"),
            "room_code": loc.get("room_code"),
            "rooms_covered": None,
            "option_type": None,
            "option_name": short_name,
            "standard_spec": None,
            "upgrade_spec": detailed,          # all landscape options are upgrades
            "has_upgrade": True,               # every landscape option is an upgrade
            "villa_type_applicable": ["All"],
            "facing_applicable": None,
            "price_inr": price_inr,
            "price_unit": clean(row["Pricing_Unit"]),
            "price_status": price_status,
            "package_tier": None,
            "description": full_name,
            "detailed_spec": detailed,
            "images": {
                "standard": None,
                "upgrade": "/static/options/placeholder/upgrade.png",
            },
            "notes": None,
            "sort_order": i + 1,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })
    return docs


def seed_smart_home(db, xl):
    """CAT006 — Smart Home Packages (direct navigation)."""
    df = pd.read_excel(xl, sheet_name="6_Smart Home Packages", header=0)
    df.columns = ["Option_ID", "Category_ID", "Location_ID", "Villa_Type", "Standard_Upgrade",
                  "Option_Name", "Package_Tier", "Price_INR", "Detailed_Spec"]
    now = datetime.now(timezone.utc)
    docs = []
    for i, row in df.iterrows():
        opt_id = clean(row["Option_ID"])
        if not opt_id:
            continue
        price_inr, price_status = parse_price(row["Price_INR"])
        tier = clean(row["Package_Tier"])
        detailed = clean(row["Detailed_Spec"])
        docs.append({
            "option_id": opt_id,
            "category_id": "CAT006",
            "sub_section": None,
            "location_id": None,
            "floor": "All Floors",
            "space": "Entire Villa",
            "room_code": None,
            "rooms_covered": None,
            "option_type": None,
            "option_name": f"Smart Home - {tier}" if tier else clean(row["Option_Name"]),
            "standard_spec": None,
            "upgrade_spec": detailed,          # all smart home options are upgrades
            "has_upgrade": True,               # every smart home option is an upgrade
            "villa_type_applicable": ["All"],
            "facing_applicable": None,
            "price_inr": price_inr,
            "price_unit": "per villa",
            "price_status": price_status,
            "package_tier": tier,
            "description": clean(row["Option_Name"]),
            "detailed_spec": detailed,
            "images": {
                "standard": None,
                "upgrade": "/static/options/placeholder/upgrade.png",
            },
            "notes": None,
            "sort_order": i + 1,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })
    return docs


def enrich_bathroom_floors(docs, location_lookup):
    """Fill floor/space/room_code for bathroom options from location lookup."""
    for doc in docs:
        loc_id = doc.get("location_id")
        if loc_id and loc_id in location_lookup:
            loc = location_lookup[loc_id]
            doc["floor"] = loc["floor"]
            doc["space"] = loc["space"]
            doc["room_code"] = loc["room_code"]
    return docs


def seed_admin_user(db):
    print("Seeding admin user...")
    if db.users.find_one({"email": ADMIN_EMAIL}):
        print("  Admin already exists, skipping")
        return
    now = datetime.now(timezone.utc)
    db.users.insert_one({
        "email": ADMIN_EMAIL,
        "hashed_password": pwd_context.hash(ADMIN_PASSWORD),
        "full_name": "Portal Admin",
        "phone": None,
        "role": "admin",
        "villa_id": None,
        "is_active": True,
        "customization_deadline": None,
        "created_by": None,
        "created_at": now,
        "updated_at": now,
    })
    print(f"  Admin created: {ADMIN_EMAIL}")


def main():
    if not MONGO_URI:
        print("ERROR: MONGODB_URI not set in .env")
        sys.exit(1)

    print(f"Connecting to MongoDB: {DB_NAME}")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    xl = pd.ExcelFile(EXCEL_PATH)

    # Create indexes
    db.users.create_index("email", unique=True)
    db.villas.create_index("villa_number", unique=True)
    db.customization_options.create_index("option_id", unique=True)
    db.categories.create_index("category_id", unique=True)
    db.locations.create_index("location_id", unique=True)

    # Seed reference data
    seed_villas(db, xl)
    seed_categories(db, xl)
    seed_locations(db, xl)

    # Build location lookup for enrichment
    location_lookup = {
        loc["location_id"]: loc
        for loc in db.locations.find()
    }

    # Collect all option docs
    print("Seeding customization options...")
    all_options = []
    all_options.extend(seed_space_customizations(db, xl))
    all_options.extend(seed_flooring_individual(db, xl))
    all_options.extend(seed_flooring_packages(db, xl))
    all_options.extend(seed_bathroom_sanitaryware(db, xl))
    all_options.extend(seed_bathroom_cp(db, xl))
    all_options.extend(seed_lift_interior(db, xl))
    all_options.extend(seed_landscape(db, xl))
    all_options.extend(seed_smart_home(db, xl))

    # Enrich bathroom options with floor/space/room_code
    all_options = enrich_bathroom_floors(all_options, location_lookup)

    db.customization_options.drop()
    db.customization_options.create_index("option_id", unique=True)
    if all_options:
        db.customization_options.insert_many(all_options)
    print(f"  Inserted {len(all_options)} options")

    # Breakdown
    from collections import Counter
    counts = Counter(o["category_id"] for o in all_options)
    for cat_id, count in sorted(counts.items()):
        print(f"    {cat_id}: {count} options")

    # Seed admin
    seed_admin_user(db)

    print("\nDone! Database seeded successfully.")
    print(f"\nAdmin login: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    print("Change the admin password after first login!")

    client.close()


if __name__ == "__main__":
    main()

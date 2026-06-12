"""
Handover cleanup script.
Clears all test/user data while preserving:
  - Admin user
  - Villas (resets is_assigned → False)
  - Categories, customization_options, locations  (core product data)

Run from the backend/ directory:
    python -m scripts.cleanup_for_handover
"""

import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGODB_URI   = os.environ["MONGODB_URI"]
DATABASE_NAME = os.environ.get("DATABASE_NAME", "capstone_portal")


async def main():
    client = AsyncIOMotorClient(MONGODB_URI)
    db     = client[DATABASE_NAME]

    # ── 1. Delete all non-admin users (customers + staff) ──────────────────
    r = await db.users.delete_many({"role": {"$ne": "admin"}})
    print(f"users deleted          : {r.deleted_count}")

    # ── 2. Customer selections ──────────────────────────────────────────────
    r = await db.customer_selections.delete_many({})
    print(f"customer_selections    : {r.deleted_count}")

    # ── 3. Quote requests ───────────────────────────────────────────────────
    r = await db.quote_requests.delete_many({})
    print(f"quote_requests deleted : {r.deleted_count}")

    # ── 4. Drawing register (uploaded floor plans) ──────────────────────────
    r = await db.drawing_register.delete_many({})
    print(f"drawing_register       : {r.deleted_count}")

    # ── 5. Space customisation requests ────────────────────────────────────
    r = await db.space_cust_requests.delete_many({})
    print(f"space_cust_requests    : {r.deleted_count}")

    # ── 6. Interests ────────────────────────────────────────────────────────
    r = await db.interests.delete_many({})
    print(f"interests deleted      : {r.deleted_count}")

    # ── 7. Reset all villas to unassigned ───────────────────────────────────
    r = await db.villas.update_many({}, {"$set": {"is_assigned": False}})
    print(f"villas reset           : {r.modified_count}")

    # ── Summary ─────────────────────────────────────────────────────────────
    admin_count = await db.users.count_documents({"role": "admin"})
    villa_count = await db.villas.count_documents({})
    opt_count   = await db.customization_options.count_documents({})
    cat_count   = await db.categories.count_documents({})
    loc_count   = await db.locations.count_documents({})

    print()
    print("── Preserved ───────────────────────────────")
    print(f"admin users            : {admin_count}")
    print(f"villas                 : {villa_count}")
    print(f"customization_options  : {opt_count}")
    print(f"categories             : {cat_count}")
    print(f"locations              : {loc_count}")
    print("────────────────────────────────────────────")
    print("Done. Database is clean for handover.")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())

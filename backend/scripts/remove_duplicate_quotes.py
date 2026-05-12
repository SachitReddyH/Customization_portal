"""
One-time script: for each customer, keep only the most recent quote
and delete all older duplicates.
Run once: python -m scripts.remove_duplicate_quotes
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URI   = os.environ["MONGODB_URI"]
DATABASE_NAME = os.environ.get("DATABASE_NAME", "capstone_portal")


async def main():
    client = AsyncIOMotorClient(MONGODB_URI, tls=True, tlsAllowInvalidCertificates=True)
    db     = client[DATABASE_NAME]

    # Get all unique customer_ids that have more than one quote
    pipeline = [
        {"$group": {"_id": "$customer_id", "count": {"$sum": 1}, "ids": {"$push": "$_id"}, "dates": {"$push": "$requested_at"}}},
        {"$match": {"count": {"$gt": 1}}}
    ]
    duplicates = await db.quote_requests.aggregate(pipeline).to_list(length=None)

    if not duplicates:
        print("No duplicates found.")
        client.close()
        return

    deleted_total = 0
    for group in duplicates:
        customer_id = group["_id"]

        # Fetch all quotes for this customer, sorted newest first
        quotes = await db.quote_requests.find(
            {"customer_id": customer_id}
        ).sort("requested_at", -1).to_list(length=None)

        keep    = quotes[0]   # most recent
        to_delete = quotes[1:]  # all older ones

        print(f"\nCustomer {customer_id}:")
        print(f"  Keeping : {keep['_id']}  status={keep.get('status')}  date={keep.get('requested_at')}")
        for q in to_delete:
            print(f"  Deleting: {q['_id']}  status={q.get('status')}  date={q.get('requested_at')}")
            await db.quote_requests.delete_one({"_id": q["_id"]})
            deleted_total += 1

    print(f"\nDone. Deleted {deleted_total} duplicate quote(s).")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())

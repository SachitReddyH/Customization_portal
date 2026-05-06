"""Customer interest notifications — e.g. 'Coming Soon' categories."""
from fastapi import APIRouter, Depends
from app.database import get_db
from app.core.deps import get_current_user, require_admin
from bson import ObjectId
from datetime import datetime, timezone
from typing import List

router = APIRouter(prefix="/interests", tags=["interests"])


@router.post("", status_code=201)
async def submit_interest(payload: dict, user=Depends(get_current_user)):
    """Customer taps 'Let us know' on a Coming Soon category."""
    db = get_db()
    category_id   = payload.get("category_id", "")
    category_name = payload.get("category_name", "")

    # Upsert — one record per customer + category (avoid spam)
    await db.interests.update_one(
        {"customer_id": user["_id"], "category_id": category_id},
        {"$set": {
            "customer_id":   user["_id"],
            "customer_name": user.get("full_name", ""),
            "customer_email": user.get("email", ""),
            "villa_id":      user.get("villa_id"),
            "category_id":   category_id,
            "category_name": category_name,
            "updated_at":    datetime.now(timezone.utc),
        }, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"message": "Interest recorded"}


@router.get("/admin", tags=["admin"])
async def list_interests(user=Depends(require_admin)):
    """Admin: see all customers who expressed interest in Coming Soon categories."""
    db = get_db()
    cursor = db.interests.find({}).sort("updated_at", -1)
    items  = await cursor.to_list(length=None)
    result = []
    for doc in items:
        villa_name = None
        if doc.get("villa_id"):
            villa = await db.villas.find_one({"_id": doc["villa_id"]})
            if villa:
                villa_name = villa.get("villa_name")
        result.append({
            "id":             str(doc["_id"]),
            "customer_name":  doc.get("customer_name"),
            "customer_email": doc.get("customer_email"),
            "villa_name":     villa_name,
            "category_id":    doc.get("category_id"),
            "category_name":  doc.get("category_name"),
            "created_at":     doc.get("created_at"),
            "updated_at":     doc.get("updated_at"),
        })
    return result

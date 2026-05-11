from fastapi import APIRouter, HTTPException, Depends
from app.database import get_db
from app.core.deps import get_current_user
from app.schemas.selection import (
    SelectionUpsert, SelectionRemove, CustomerSelectionsResponse
)
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter(prefix="/selections", tags=["selections"])


def _fmt(doc: dict) -> dict:
    doc["id"] = str(doc["_id"])
    doc["customer_id"] = str(doc["customer_id"])
    if doc.get("villa_id"):
        doc["villa_id"] = str(doc["villa_id"])
    return doc


async def _get_or_create_selection(db, customer_id: ObjectId, villa_id):
    doc = await db.customer_selections.find_one({"customer_id": customer_id})
    if not doc:
        now = datetime.now(timezone.utc)
        new_doc = {
            "customer_id": customer_id,
            "villa_id": villa_id,
            "status": "in_progress",
            "selections": [],
            "total_estimated_price": None,
            "admin_notes": None,
            "submitted_at": None,
            "last_updated": now,
            "created_at": now,
        }
        result = await db.customer_selections.insert_one(new_doc)
        new_doc["_id"] = result.inserted_id
        return new_doc
    return doc


@router.get("/my", response_model=CustomerSelectionsResponse)
async def get_my_selections(user=Depends(get_current_user)):
    db = get_db()
    customer_id = user["_id"]
    villa_id = ObjectId(user["villa_id"]) if user.get("villa_id") else None
    doc = await _get_or_create_selection(db, customer_id, villa_id)
    # Enrich selections with option_name for display
    for sel in doc.get("selections", []):
        if not sel.get("option_name"):
            opt = await db.customization_options.find_one({"option_id": sel["option_id"]})
            if opt:
                sel["option_name"] = opt.get("option_name") or opt.get("space") or sel["option_id"]
    return _fmt(doc)


@router.post("/upsert", response_model=CustomerSelectionsResponse)
async def upsert_selection(payload: SelectionUpsert, user=Depends(get_current_user)):
    """Add or replace a selection. Identified by option_id + location_id."""
    db = get_db()
    customer_id = user["_id"]
    villa_id = ObjectId(user["villa_id"]) if user.get("villa_id") else None
    doc = await _get_or_create_selection(db, customer_id, villa_id)

    if doc.get("status") == "submitted":
        raise HTTPException(status_code=400, detail="Selections already submitted. Contact admin to reopen.")

    now = datetime.now(timezone.utc)
    new_item = {
        "category_id": payload.category_id,
        "sub_section": payload.sub_section,
        "option_id": payload.option_id,
        "location_id": payload.location_id,
        "selection_type": payload.selection_type,
        "customer_notes": payload.customer_notes,
        "selected_at": now,
    }

    # Remove existing selection for same option+location, then add new
    existing = doc.get("selections", [])
    updated = [
        s for s in existing
        if not (s["option_id"] == payload.option_id and s.get("location_id") == payload.location_id)
    ]
    updated.append(new_item)

    result = await db.customer_selections.find_one_and_update(
        {"customer_id": customer_id},
        {"$set": {"selections": updated, "last_updated": now}},
        return_document=True,
    )
    return _fmt(result)


@router.delete("/remove", response_model=CustomerSelectionsResponse)
async def remove_selection(payload: SelectionRemove, user=Depends(get_current_user)):
    db = get_db()
    customer_id = user["_id"]
    doc = await db.customer_selections.find_one({"customer_id": customer_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No selections found")

    if doc.get("status") == "submitted":
        raise HTTPException(status_code=400, detail="Selections already submitted.")

    now = datetime.now(timezone.utc)
    updated = [
        s for s in doc.get("selections", [])
        if not (s["option_id"] == payload.option_id and s.get("location_id") == payload.location_id)
    ]
    result = await db.customer_selections.find_one_and_update(
        {"customer_id": customer_id},
        {"$set": {"selections": updated, "last_updated": now}},
        return_document=True,
    )
    return _fmt(result)


@router.delete("/clear", response_model=CustomerSelectionsResponse)
async def clear_selections(user=Depends(get_current_user)):
    """Remove all selections for the current customer."""
    db = get_db()
    customer_id = user["_id"]
    doc = await db.customer_selections.find_one({"customer_id": customer_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No selections found")

    if doc.get("status") == "submitted":
        raise HTTPException(status_code=400, detail="Selections already submitted.")

    now = datetime.now(timezone.utc)
    result = await db.customer_selections.find_one_and_update(
        {"customer_id": customer_id},
        {"$set": {"selections": [], "last_updated": now}},
        return_document=True,
    )
    return _fmt(result)


@router.post("/submit", response_model=CustomerSelectionsResponse)
async def submit_selections(user=Depends(get_current_user)):
    """Customer submits selections for quote review."""
    db = get_db()
    customer_id = user["_id"]
    doc = await db.customer_selections.find_one({"customer_id": customer_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No selections found")
    if doc.get("status") == "submitted":
        raise HTTPException(status_code=400, detail="Already submitted")
    if not doc.get("selections"):
        raise HTTPException(status_code=400, detail="No selections to submit")

    now = datetime.now(timezone.utc)
    result = await db.customer_selections.find_one_and_update(
        {"customer_id": customer_id},
        {"$set": {"status": "submitted", "submitted_at": now, "last_updated": now}},
        return_document=True,
    )

    # Auto-create a quote request
    await db.quote_requests.insert_one({
        "customer_id": customer_id,
        "villa_id": doc.get("villa_id"),
        "status": "pending",
        "customer_notes": None,
        "admin_notes": None,
        "quoted_price": None,
        "selection_snapshot": doc.get("selections", []),
        "requested_at": now,
        "reviewed_at": None,
        "reviewed_by": None,
    })

    return _fmt(result)

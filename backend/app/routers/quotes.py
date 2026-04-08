from fastapi import APIRouter, HTTPException, Depends
from app.database import get_db
from app.core.deps import get_current_user, require_admin
from app.schemas.quote import QuoteRequestCreate, QuoteRequestResponse, QuoteStatusUpdate
from bson import ObjectId
from datetime import datetime, timezone
from typing import List

router = APIRouter(prefix="/quotes", tags=["quotes"])


async def _enrich(db, quote: dict) -> dict:
    quote["id"] = str(quote["_id"])
    quote["customer_id"] = str(quote["customer_id"])
    if quote.get("villa_id"):
        quote["villa_id"] = str(quote["villa_id"])
    if quote.get("reviewed_by"):
        quote["reviewed_by"] = str(quote["reviewed_by"])

    # Enrich with customer name
    customer = await db.users.find_one({"_id": ObjectId(quote["customer_id"])})
    quote["customer_name"] = customer["full_name"] if customer else None

    # Enrich with villa name
    if quote.get("villa_id"):
        villa = await db.villas.find_one({"_id": ObjectId(quote["villa_id"])})
        quote["villa_name"] = villa["villa_name"] if villa else None
    else:
        quote["villa_name"] = None

    return quote


@router.get("/", response_model=List[QuoteRequestResponse])
async def list_quotes(user=Depends(require_admin)):
    db = get_db()
    cursor = db.quote_requests.find().sort("requested_at", -1)
    quotes = await cursor.to_list(length=None)
    return [await _enrich(db, q) for q in quotes]


@router.get("/my")
async def my_quotes(user=Depends(get_current_user)):
    """Customer views their own quote requests."""
    db = get_db()
    cursor = db.quote_requests.find({"customer_id": user["_id"]}).sort("requested_at", -1)
    quotes = await cursor.to_list(length=None)
    return [await _enrich(db, q) for q in quotes]


@router.get("/{quote_id}", response_model=QuoteRequestResponse)
async def get_quote(quote_id: str, user=Depends(get_current_user)):
    db = get_db()
    quote = await db.quote_requests.find_one({"_id": ObjectId(quote_id)})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    if user["role"] == "customer" and str(quote["customer_id"]) != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    return await _enrich(db, quote)


@router.patch("/{quote_id}", response_model=QuoteRequestResponse)
async def update_quote(quote_id: str, payload: QuoteStatusUpdate, user=Depends(require_admin)):
    db = get_db()
    now = datetime.now(timezone.utc)
    update = {
        "status": payload.status,
        "reviewed_at": now,
        "reviewed_by": user["_id"],
    }
    if payload.admin_notes is not None:
        update["admin_notes"] = payload.admin_notes
    if payload.quoted_price is not None:
        update["quoted_price"] = payload.quoted_price

    result = await db.quote_requests.find_one_and_update(
        {"_id": ObjectId(quote_id)},
        {"$set": update},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Quote not found")
    return await _enrich(db, result)

from fastapi import APIRouter, HTTPException, Depends
from app.database import get_db
from app.core.deps import get_current_user, require_admin
from app.schemas.quote import QuoteRequestCreate, QuoteRequestResponse, QuoteStatusUpdate, ItemPrice
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

    customer = await db.users.find_one({"_id": ObjectId(quote["customer_id"])})
    quote["customer_name"] = customer["full_name"] if customer else None

    if quote.get("villa_id"):
        villa = await db.villas.find_one({"_id": ObjectId(quote["villa_id"])})
        quote["villa_name"] = villa["villa_name"] if villa else None
    else:
        quote["villa_name"] = None

    return quote


import re as _re

_ADDON_LABELS = {"BAT": "Bathtub", "JAC": "Jacuzzi"}

def _decode_addon_id(option_id: str, parent_opt) -> str:
    """Return a human-readable name for synthetic addon option_ids like OPT-BP-001-ADN-BAT."""
    m = _re.match(r'^(.+)-ADN-([A-Z]+)$', option_id)
    if not m:
        return None
    label = _ADDON_LABELS.get(m.group(2), m.group(2))
    if parent_opt:
        series = (parent_opt.get("upgrade_spec") or parent_opt.get("option_name") or "")
        series = _re.sub(r'\s+[Ss]eries$', '', series).strip()
        return f"{label} — {series}" if series else label
    return label


async def _build_snapshot(db, user) -> list:
    """Fetch & enrich the customer's current selections into a snapshot list."""
    selections_doc = await db.customer_selections.find_one({"customer_id": user["_id"]})
    raw = selections_doc.get("selections", []) if selections_doc else []
    enriched = []
    for sel in raw:
        option_id = sel.get("option_id", "")
        opt = await db.customization_options.find_one({"option_id": option_id})
        cat = await db.categories.find_one({"category_id": sel.get("category_id")})

        # Resolve option name: real option → addon decode → raw id
        if opt:
            resolved_name = opt.get("option_name") or opt.get("space") or opt.get("description") or option_id
        else:
            # Try decoding synthetic addon id (e.g. OPT-BP-001-ADN-BAT)
            m = _re.match(r'^(.+)-ADN-([A-Z]+)$', option_id)
            if m:
                parent_opt = await db.customization_options.find_one({"option_id": m.group(1)})
                resolved_name = _decode_addon_id(option_id, parent_opt) or option_id
            else:
                resolved_name = option_id

        # Resolve room info from locations collection
        room_label = None
        loc_id = sel.get("location_id")
        if loc_id:
            loc = await db.locations.find_one({"location_id": loc_id})
            if loc:
                space     = loc.get("space") or ""
                room_code = loc.get("room_code") or ""
                room_label = f"{space} — {room_code}".strip(" —") if space or room_code else loc_id

        enriched.append({
            **sel,
            "option_name":   resolved_name,
            "category_name": cat.get("name") if cat else sel.get("category_id"),
            "room_label":    room_label,
            "price_inr":     opt.get("price_inr") if opt else None,
            "price_unit":    opt.get("price_unit") if opt else None,
        })
    return enriched


@router.post("/", response_model=QuoteRequestResponse)
async def create_or_update_quote(payload: QuoteRequestCreate, user=Depends(get_current_user)):
    """
    Customer submits / re-submits a quote request.
    - First time  → creates a new quote with notification_type='new'
    - Re-submit   → updates the existing pending quote's snapshot,
                    sets notification_type='updated'  (no new row for admin)
    """
    if user["role"] != "customer":
        raise HTTPException(status_code=403, detail="Only customers can request quotes")

    db = get_db()
    now = datetime.now(timezone.utc)
    snapshot = await _build_snapshot(db, user)

    # Find most recent quote regardless of status — always update rather than duplicate
    existing = await db.quote_requests.find_one(
        {"customer_id": user["_id"]},
        sort=[("requested_at", -1)]
    )

    if existing:
        # ── UPDATE existing pending quote ──────────────────────────
        update_fields = {
            "selection_snapshot": snapshot,
            "notification_type":  "updated",
            "updated_at":         now,
        }
        # Keep customer_notes if a new one is provided
        if payload.customer_notes is not None:
            update_fields["customer_notes"] = payload.customer_notes

        result = await db.quote_requests.find_one_and_update(
            {"_id": existing["_id"]},
            {"$set": update_fields},
            return_document=True,
        )
        return await _enrich(db, result)

    # ── CREATE new quote ───────────────────────────────────────────
    doc = {
        "customer_id":        user["_id"],
        "villa_id":           user.get("villa_id"),
        "status":             "pending",
        "notification_type":  "new",
        "customer_notes":     payload.customer_notes,
        "admin_notes":        None,
        "quoted_price":       None,
        "selection_snapshot": snapshot,
        "requested_at":       now,
        "updated_at":         None,
        "reviewed_at":        None,
        "reviewed_by":        None,
    }
    result  = await db.quote_requests.insert_one(doc)
    created = await db.quote_requests.find_one({"_id": result.inserted_id})
    return await _enrich(db, created)


@router.get("/my")
async def my_quotes(user=Depends(get_current_user)):
    """Customer views their own quote requests."""
    db = get_db()
    cursor = db.quote_requests.find({"customer_id": user["_id"]}).sort("requested_at", -1)
    quotes = await cursor.to_list(length=None)
    return [await _enrich(db, q) for q in quotes]


@router.get("/", response_model=List[QuoteRequestResponse])
async def list_quotes(user=Depends(require_admin)):
    db = get_db()
    # Sort: new/updated first, then by requested_at desc
    cursor = db.quote_requests.find().sort([
        ("notification_type", -1),   # 'updated'/'new' (non-null) sort first
        ("updated_at", -1),
        ("requested_at", -1),
    ])
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


@router.post("/{quote_id}/read", response_model=QuoteRequestResponse)
async def mark_quote_read(quote_id: str, user=Depends(require_admin)):
    """Admin marks a quote as seen — clears the new/updated notification."""
    db = get_db()
    result = await db.quote_requests.find_one_and_update(
        {"_id": ObjectId(quote_id)},
        {"$set": {"notification_type": None}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Quote not found")
    return await _enrich(db, result)


@router.patch("/{quote_id}", response_model=QuoteRequestResponse)
async def update_quote(quote_id: str, payload: QuoteStatusUpdate, user=Depends(require_admin)):
    """Admin updates status / price / notes — also clears notification so it moves to 'seen'."""
    db = get_db()
    now = datetime.now(timezone.utc)
    update = {
        "status":            payload.status,
        "notification_type": None,      # admin has acted → clear notification
        "reviewed_at":       now,
        "reviewed_by":       user["_id"],
    }
    if payload.admin_notes is not None:
        update["admin_notes"] = payload.admin_notes
    if payload.item_prices is not None:
        # Save individual line-item prices and auto-compute total
        update["item_prices"] = [ip.model_dump() for ip in payload.item_prices]
        update["quoted_price"] = sum(ip.price for ip in payload.item_prices)
    elif payload.quoted_price is not None:
        update["quoted_price"] = payload.quoted_price

    result = await db.quote_requests.find_one_and_update(
        {"_id": ObjectId(quote_id)},
        {"$set": update},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Quote not found")
    return await _enrich(db, result)

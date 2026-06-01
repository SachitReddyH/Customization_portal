"""Space Customisation Quote workflow — CAT001 specific quote flow."""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from app.database import get_db
from app.core.deps import get_current_user, require_admin, require_any_admin, require_space_cust_access
from bson import ObjectId, Binary
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
import os
import re as _re


class SpaceCustSubmitBody(BaseModel):
    customer_notes: Optional[str] = None

router = APIRouter(prefix="/space-cust", tags=["space-cust"])

ADDON_LABELS = {"BAT": "Bathtub", "JAC": "Jacuzzi"}


def _decode_addon_id(option_id: str, parent_opt) -> Optional[str]:
    """Return a human-readable name for synthetic addon option_ids like OPT-BP-001-ADN-BAT."""
    m = _re.match(r'^(.+)-ADN-([A-Z]+)$', option_id)
    if not m:
        return None
    label = ADDON_LABELS.get(m.group(2), m.group(2))
    if parent_opt:
        series = (parent_opt.get("upgrade_spec") or parent_opt.get("option_name") or "")
        series = _re.sub(r'\s+[Ss]eries$', '', series).strip()
        return f"{label} — {series}" if series else label
    return label


async def _build_cat001_snapshot(db, user) -> list:
    """Fetch & enrich the customer's CAT001 selections into a snapshot list."""
    selections_doc = await db.customer_selections.find_one({"customer_id": user["_id"]})
    raw = selections_doc.get("selections", []) if selections_doc else []
    # Filter CAT001 only
    cat001_sels = [s for s in raw if s.get("category_id") == "CAT001"]
    enriched = []
    for sel in cat001_sels:
        option_id = sel.get("option_id", "")
        opt = await db.customization_options.find_one({"option_id": option_id})

        # Resolve option name
        if opt:
            resolved_name = opt.get("option_name") or opt.get("space") or opt.get("description") or option_id
        else:
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
                space = loc.get("space") or ""
                room_label = space if space else loc_id

        enriched.append({
            **sel,
            "option_name": resolved_name,
            "category_name": "Space Customisations",
            "room_label": room_label,
            "price_inr": opt.get("price_inr") if opt else None,
            "price_unit": opt.get("price_unit") if opt else None,
        })
    return enriched


def _enrich_request(req: dict) -> dict:
    """Convert _id → id and stringify ObjectIds."""
    req["id"] = str(req["_id"])
    del req["_id"]
    if req.get("customer_id"):
        req["customer_id"] = str(req["customer_id"])
    if req.get("villa_id"):
        req["villa_id"] = str(req["villa_id"])
    if req.get("reviewed_by"):
        req["reviewed_by"] = str(req["reviewed_by"])
    return req


# ── Customer endpoints ─────────────────────────────────────────────────────────

@router.post("/request")
async def submit_space_cust_request(body: SpaceCustSubmitBody = SpaceCustSubmitBody(), user=Depends(get_current_user)):
    """Customer submits (or re-submits) a space customisation quote request."""
    if user["role"] != "customer":
        raise HTTPException(status_code=403, detail="Only customers can submit space customisation requests")

    db = get_db()
    now = datetime.now(timezone.utc)
    snapshot = await _build_cat001_snapshot(db, user)
    customer_notes = (body.customer_notes or "").strip() or None

    existing = await db.space_cust_requests.find_one({"customer_id": user["_id"]})

    if existing:
        result = await db.space_cust_requests.find_one_and_update(
            {"_id": existing["_id"]},
            {"$set": {
                "selection_snapshot":  snapshot,
                "customer_notes":      customer_notes,
                "status":              "pending",
                "customer_notification": None,
                "admin_notification":  None,
                "updated_at":          now,
            }},
            return_document=True,
        )
        return _enrich_request(result)

    doc = {
        "customer_id":        user["_id"],
        "villa_id":           user.get("villa_id"),
        "status":             "pending",
        "selection_snapshot": snapshot,
        "customer_notes":     customer_notes,
        "quoted_price":       None,
        "customer_notification": None,
        "admin_notification": None,
        "requested_at":       now,
        "updated_at":         None,
        "responded_at":       None,
        "reviewed_by":        None,
    }
    result = await db.space_cust_requests.insert_one(doc)
    created = await db.space_cust_requests.find_one({"_id": result.inserted_id})
    return _enrich_request(created)


@router.get("/my")
async def get_my_space_cust_request(user=Depends(get_current_user)):
    """Returns the customer's space cust request, or null if none exists."""
    db = get_db()
    req = await db.space_cust_requests.find_one({"customer_id": user["_id"]})
    if not req:
        return None
    return _enrich_request(req)


@router.post("/my/accept")
async def accept_space_cust_quote(user=Depends(get_current_user)):
    """Customer accepts the space cust quotation."""
    if user["role"] != "customer":
        raise HTTPException(status_code=403, detail="Only customers can accept quotes")
    db = get_db()
    req = await db.space_cust_requests.find_one({"customer_id": user["_id"]})
    if not req:
        raise HTTPException(status_code=404, detail="No space customisation request found")
    now = datetime.now(timezone.utc)
    await db.space_cust_requests.update_one(
        {"_id": req["_id"]},
        {"$set": {
            "status": "accepted",
            "customer_notification": None,
            "updated_at": now,
        }},
    )
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "space_customisation_skipped": True,
            "space_customisation_skipped_at": now,
        }},
    )
    return {"accepted": True}


@router.post("/my/negotiate")
async def negotiate_space_cust_quote(user=Depends(get_current_user)):
    """Customer requests negotiation on the space cust quotation."""
    if user["role"] != "customer":
        raise HTTPException(status_code=403, detail="Only customers can negotiate quotes")
    db = get_db()
    req = await db.space_cust_requests.find_one({"customer_id": user["_id"]})
    if not req:
        raise HTTPException(status_code=404, detail="No space customisation request found")
    now = datetime.now(timezone.utc)
    await db.space_cust_requests.update_one(
        {"_id": req["_id"]},
        {"$set": {
            "status": "negotiating",
            "admin_notification": "negotiation_requested",
            "customer_notification": None,
            "updated_at": now,
        }},
    )
    return {"negotiating": True}


@router.post("/my/deny")
async def deny_space_cust_quote(user=Depends(get_current_user)):
    """Customer denies the space cust quotation and continues with standard plan."""
    if user["role"] != "customer":
        raise HTTPException(status_code=403, detail="Only customers can deny quotes")
    db = get_db()
    req = await db.space_cust_requests.find_one({"customer_id": user["_id"]})
    if not req:
        raise HTTPException(status_code=404, detail="No space customisation request found")
    now = datetime.now(timezone.utc)
    await db.space_cust_requests.update_one(
        {"_id": req["_id"]},
        {"$set": {
            "status": "denied",
            "customer_notification": None,
            "updated_at": now,
        }},
    )
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "space_customisation_skipped": True,
            "space_customisation_skipped_at": now,
        }},
    )
    return {"denied": True}


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.get("/admin/all")
async def list_all_space_cust_requests(user=Depends(require_space_cust_access)):
    """Admin: list all space cust requests sorted by requested_at desc."""
    db = get_db()
    cursor = db.space_cust_requests.find().sort("requested_at", -1)
    requests = await cursor.to_list(length=None)
    enriched = []
    for req in requests:
        r = _enrich_request(req)
        # Enrich with customer info
        try:
            customer = await db.users.find_one({"_id": ObjectId(r["customer_id"])})
            r["customer_name"]  = customer.get("full_name") if customer else None
            r["customer_email"] = customer.get("email") if customer else None
        except Exception:
            r["customer_name"]  = None
            r["customer_email"] = None
        # Enrich with villa info
        if r.get("villa_id"):
            try:
                villa = await db.villas.find_one({"_id": ObjectId(r["villa_id"])})
                r["villa_number"] = villa.get("villa_number") if villa else None
                r["villa_name"]   = villa.get("villa_name") if villa else None
            except Exception:
                r["villa_number"] = None
                r["villa_name"]   = None
        else:
            r["villa_number"] = None
            r["villa_name"]   = None
        enriched.append(r)
    return enriched


@router.post("/admin/{request_id}/respond")
async def respond_to_space_cust_request(
    request_id: str,
    quoted_price: Optional[float] = Form(None),
    floor_plan: Optional[UploadFile] = File(None),
    user=Depends(require_space_cust_access),
):
    """Admin/Design responds with a quoted price, optional notes, and optional floor plan."""
    db = get_db()
    req = await db.space_cust_requests.find_one({"_id": ObjectId(request_id)})
    if not req:
        raise HTTPException(status_code=404, detail="Space cust request not found")

    now = datetime.now(timezone.utc)

    # Handle optional floor plan upload — store in drawing_register.updated_plan
    if floor_plan and floor_plan.filename:
        ext = os.path.splitext(floor_plan.filename or '')[1].lower()
        allowed_exts = {'.jpg', '.jpeg', '.png', '.webp', '.pdf'}
        if ext not in allowed_exts:
            raise HTTPException(status_code=400, detail="Only jpg, jpeg, png, webp, pdf allowed")

        contents = await floor_plan.read()
        is_pdf = ext == ".pdf"

        plan_data = {
            "url":         "db",
            "is_pdf":      is_pdf,
            "data":        Binary(contents),
            "uploaded_at": now,
            "uploaded_by": user["_id"],
        }

        # Upsert into drawing_register for this customer's villa
        customer_villa_id = req.get("villa_id")
        if customer_villa_id:
            villa_oid = customer_villa_id if isinstance(customer_villa_id, ObjectId) else ObjectId(customer_villa_id)
            existing_reg = await db.drawing_register.find_one({"villa_id": villa_oid})
            if existing_reg:
                await db.drawing_register.update_one(
                    {"villa_id": villa_oid},
                    {"$set": {"updated_plan": plan_data, "updated_at": now}},
                )
            else:
                await db.drawing_register.insert_one({
                    "villa_id":      villa_oid,
                    "standard_plan": None,
                    "updated_plan":  plan_data,
                    "updated_at":    now,
                })

    # Update the request
    is_design = user.get("role") == "design_admin"

    update_fields: dict = {
        "customer_notification": "quote_ready",
        "admin_notification":    None,
        "responded_at":          now,
        "reviewed_by":           user["_id"],
        "updated_at":            now,
    }
    # Design admin only uploads floor plan — don't overwrite price/status set by admin
    if not is_design:
        update_fields["status"]       = "quoted"
        update_fields["quoted_price"] = quoted_price
    else:
        # Only mark as quoted if not already quoted/accepted/denied
        current_status = req.get("status", "pending")
        if current_status in ("pending", "negotiating"):
            update_fields["status"] = "quoted"

    result = await db.space_cust_requests.find_one_and_update(
        {"_id": ObjectId(request_id)},
        {"$set": update_fields},
        return_document=True,
    )

    r = _enrich_request(result)
    try:
        customer = await db.users.find_one({"_id": ObjectId(r["customer_id"])})
        r["customer_name"]  = customer.get("full_name") if customer else None
        r["customer_email"] = customer.get("email") if customer else None
    except Exception:
        r["customer_name"]  = None
        r["customer_email"] = None
    if r.get("villa_id"):
        try:
            villa = await db.villas.find_one({"_id": ObjectId(r["villa_id"])})
            r["villa_number"] = villa.get("villa_number") if villa else None
            r["villa_name"]   = villa.get("villa_name") if villa else None
        except Exception:
            r["villa_number"] = None
            r["villa_name"]   = None
    return r


@router.post("/admin/{request_id}/reopen")
async def reopen_space_cust_request(request_id: str, user=Depends(require_space_cust_access)):
    """Admin reopens (resets) a space cust request back to pending."""
    db = get_db()
    req = await db.space_cust_requests.find_one({"_id": ObjectId(request_id)})
    if not req:
        raise HTTPException(status_code=404, detail="Space cust request not found")

    now = datetime.now(timezone.utc)
    await db.space_cust_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "status":                "pending",
            "quoted_price":          None,
            "customer_notification": None,
            "admin_notification":    None,
            "responded_at":          None,
            "updated_at":            now,
        }},
    )

    # Reset space_customisation_skipped on the customer
    customer_id = req.get("customer_id")
    if customer_id:
        cust_oid = customer_id if isinstance(customer_id, ObjectId) else ObjectId(str(customer_id))
        await db.users.update_one(
            {"_id": cust_oid},
            {"$set": {
                "space_customisation_skipped":    False,
                "space_customisation_skipped_at": None,
            }},
        )

    return {"reopened": True}

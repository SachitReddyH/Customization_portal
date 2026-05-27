"""Admin-only routes: manage customers, options, and view all selections."""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from app.database import get_db
from app.core.deps import require_admin, require_any_admin, require_read_access
from app.core.security import hash_password
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.schemas.option import OptionCreate, OptionUpdate, OptionResponse
from app.schemas.category import CategoryUpdate, CategoryResponse
from bson import ObjectId
from datetime import datetime, timezone
from typing import List
import os, uuid, re as _re
from app.core.cloudinary_upload import upload_image_to_cloudinary

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Customer Management ────────────────────────────────────────────────────

@router.get("/customers", response_model=List[UserResponse])
async def list_customers(user=Depends(require_read_access)):
    db = get_db()
    cursor = db.users.find({"role": "customer"}).sort("created_at", -1)
    customers = await cursor.to_list(length=None)
    result = []
    for c in customers:
        c["id"] = str(c["_id"])
        if c.get("villa_id"):
            c["villa_id"] = str(c["villa_id"])
        result.append(UserResponse(**c))
    return result


@router.post("/customers", response_model=UserResponse, status_code=201)
async def create_customer(payload: UserCreate, user=Depends(require_any_admin)):
    db = get_db()
    if await db.users.find_one({"email": payload.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    villa_obj_id = None
    if payload.villa_id:
        villa = await db.villas.find_one({"_id": ObjectId(payload.villa_id)})
        if not villa:
            raise HTTPException(status_code=404, detail="Villa not found")
        # Mark villa as assigned
        await db.villas.update_one({"_id": ObjectId(payload.villa_id)}, {"$set": {"is_assigned": True}})
        villa_obj_id = ObjectId(payload.villa_id)

    now = datetime.now(timezone.utc)
    doc = {
        "email": payload.email,
        "hashed_password": hash_password(payload.password),
        "full_name": payload.full_name,
        "phone": payload.phone,
        "role": "customer",
        "villa_id": villa_obj_id,
        "is_active": True,
        "customization_deadline": payload.customization_deadline,
        "created_by": user["_id"],
        "created_at": now,
        "updated_at": now,
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    doc["id"] = str(result.inserted_id)
    if doc.get("villa_id"):
        doc["villa_id"] = str(doc["villa_id"])
    return UserResponse(**doc)


@router.patch("/customers/{customer_id}", response_model=UserResponse)
async def update_customer(customer_id: str, payload: UserUpdate, user=Depends(require_admin)):
    db = get_db()
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "villa_id" in update_data:
        update_data["villa_id"] = ObjectId(update_data["villa_id"])
    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await db.users.find_one_and_update(
        {"_id": ObjectId(customer_id), "role": "customer"},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Customer not found")
    result["id"] = str(result["_id"])
    if result.get("villa_id"):
        result["villa_id"] = str(result["villa_id"])
    return UserResponse(**result)


@router.delete("/customers/{customer_id}", status_code=204)
async def delete_customer(customer_id: str, user=Depends(require_admin)):
    db = get_db()
    customer = await db.users.find_one({"_id": ObjectId(customer_id), "role": "customer"})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Unassign villa
    if customer.get("villa_id"):
        await db.villas.update_one(
            {"_id": customer["villa_id"]}, {"$set": {"is_assigned": False}}
        )

    await db.users.delete_one({"_id": ObjectId(customer_id)})
    await db.customer_selections.delete_one({"customer_id": ObjectId(customer_id)})


@router.get("/customers/{customer_id}/selections")
async def get_customer_selections(customer_id: str, user=Depends(require_read_access)):
    db = get_db()
    customer = await db.users.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Always return a consistent customer object
    customer_info = {
        "id": str(customer["_id"]),
        "full_name": customer["full_name"],
        "email": customer["email"],
        "phone": customer.get("phone"),
        "villa_id": str(customer["villa_id"]) if customer.get("villa_id") else None,
    }

    selections_doc = await db.customer_selections.find_one({"customer_id": ObjectId(customer_id)})
    if not selections_doc:
        return {
            "customer": customer_info,
            "selections": [],
            "status": "not_started",
        }

    raw = selections_doc.get("selections", [])

    # Batch-resolve option names and location names
    option_ids  = list({s.get("option_id", "") for s in raw if s.get("option_id")})
    location_ids = list({s.get("location_id") for s in raw if s.get("location_id")})

    opts  = await db.customization_options.find({"option_id": {"$in": option_ids}}).to_list(length=None)
    locs  = await db.locations.find({"location_id": {"$in": location_ids}}).to_list(length=None)

    opt_map = {o["option_id"]: o for o in opts}
    loc_map = {l["location_id"]: l for l in locs}

    enriched = []
    for sel in raw:
        oid  = sel.get("option_id", "")
        opt  = opt_map.get(oid)

        if opt:
            option_name = opt.get("option_name") or opt.get("space") or opt.get("description") or oid
        else:
            # Handle synthetic addon IDs like OPT-SC-003-ADN-BAT
            m = _re.match(r'^(.+)-ADN-([A-Z]+)$', oid)
            if m:
                parent = opt_map.get(m.group(1))
                addon_label = {"BAT": "Bathtub", "JAC": "Jacuzzi"}.get(m.group(2), m.group(2))
                series = (parent.get("upgrade_spec") or parent.get("option_name") or "") if parent else ""
                series = _re.sub(r'\s+[Ss]eries$', '', series).strip()
                option_name = f"{addon_label} — {series}" if series else addon_label
            else:
                option_name = oid

        loc     = loc_map.get(sel.get("location_id", ""))
        room_label = (loc.get("space") or loc.get("floor") or sel.get("location_id")) if loc else sel.get("location_id")

        enriched.append({**sel, "option_name": option_name, "room_label": room_label})

    return {
        "customer": customer_info,
        "selections": enriched,
        "status": selections_doc.get("status", "in_progress"),
    }


# ── Options Management ─────────────────────────────────────────────────────

@router.get("/options/{category_id}", response_model=List[OptionResponse])
async def list_options_admin(category_id: str, user=Depends(require_admin)):
    """Returns ALL options for a category (including inactive) for admin management."""
    db = get_db()
    cursor = db.customization_options.find({"category_id": category_id}).sort("sort_order", 1)
    opts = await cursor.to_list(length=None)
    for o in opts:
        o["id"] = str(o["_id"])
    return [OptionResponse(**o) for o in opts]


@router.post("/options", response_model=OptionResponse, status_code=201)
async def create_option(payload: OptionCreate, user=Depends(require_admin)):
    db = get_db()
    if await db.customization_options.find_one({"option_id": payload.option_id}):
        raise HTTPException(status_code=400, detail="Option ID already exists")

    now = datetime.now(timezone.utc)
    doc = payload.model_dump()
    doc["created_at"] = now
    doc["updated_at"] = now
    result = await db.customization_options.insert_one(doc)
    doc["_id"] = result.inserted_id
    doc["id"] = str(result.inserted_id)
    return OptionResponse(**doc)


@router.patch("/options/{option_id}", response_model=OptionResponse)
async def update_option(option_id: str, payload: OptionUpdate, user=Depends(require_admin)):
    db = get_db()
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await db.customization_options.find_one_and_update(
        {"option_id": option_id},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Option not found")
    result["id"] = str(result["_id"])
    return OptionResponse(**result)


@router.delete("/options/{option_id}", status_code=204)
async def delete_option(option_id: str, user=Depends(require_admin)):
    db = get_db()
    result = await db.customization_options.delete_one({"option_id": option_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Option not found")


# ── Image Upload ──────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    category_id: str = Form(...),
    user=Depends(require_admin),
):
    public_id = f"{category_id}_{uuid.uuid4().hex}"
    url = await upload_image_to_cloudinary(file, folder=f"options/{category_id}", public_id=public_id)
    return {"path": url}


# ── Category Management ────────────────────────────────────────────────────

@router.patch("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: str, payload: CategoryUpdate, user=Depends(require_admin)):
    db = get_db()
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    result = await db.categories.find_one_and_update(
        {"category_id": category_id},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Category not found")
    result["id"] = str(result["_id"])
    return CategoryResponse(**result)


# ── Dashboard Summary ──────────────────────────────────────────────────────

@router.post("/customers/{customer_id}/reactivate-space-cust")
async def reactivate_space_cust(customer_id: str, user=Depends(require_admin)):
    """Admin reactivates space customisation for a customer (resets skip/lock)."""
    db = get_db()
    result = await db.users.find_one_and_update(
        {"_id": ObjectId(customer_id), "role": "customer"},
        {"$set": {"space_customisation_skipped": False, "space_customisation_skipped_at": None}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Customer not found")
    # Also reset their space_cust_request if any
    await db.space_cust_requests.update_one(
        {"customer_id": ObjectId(customer_id)},
        {"$set": {"status": "pending", "customer_notification": None,
                  "admin_notification": None, "quoted_price": None,
                  "admin_notes": None, "responded_at": None}},
    )
    return {"reactivated": True}


# ── Staff Management (design_admin / crm_admin) ───────────────────────────

@router.get("/staff")
async def list_staff(user=Depends(require_admin)):
    db = get_db()
    cursor = db.users.find({"role": {"$in": ["design_admin", "crm_admin", "guest_admin"]}}).sort("created_at", -1)
    staff = await cursor.to_list(length=None)
    result = []
    for s in staff:
        result.append({
            "id":         str(s["_id"]),
            "email":      s["email"],
            "full_name":  s["full_name"],
            "role":       s["role"],
            "is_active":  s.get("is_active", True),
            "created_at": s.get("created_at"),
        })
    return result


@router.post("/staff", status_code=201)
async def create_staff(payload: UserCreate, user=Depends(require_admin)):
    if payload.role not in ("design_admin", "crm_admin", "guest_admin"):
        raise HTTPException(status_code=400, detail="Role must be design_admin, crm_admin, or guest_admin")
    db = get_db()
    if await db.users.find_one({"email": payload.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    now = datetime.now(timezone.utc)
    doc = {
        "email":           payload.email,
        "hashed_password": hash_password(payload.password),
        "full_name":       payload.full_name,
        "phone":           payload.phone,
        "role":            payload.role,
        "is_active":       True,
        "created_by":      user["_id"],
        "created_at":      now,
        "updated_at":      now,
    }
    result = await db.users.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc


@router.delete("/staff/{staff_id}", status_code=204)
async def delete_staff(staff_id: str, user=Depends(require_admin)):
    db = get_db()
    result = await db.users.delete_one(
        {"_id": ObjectId(staff_id), "role": {"$in": ["design_admin", "crm_admin", "guest_admin"]}}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Staff user not found")


@router.get("/dashboard")
async def dashboard(user=Depends(require_any_admin)):
    db = get_db()
    total_villas    = await db.villas.count_documents({})
    pending_quotes  = await db.quote_requests.count_documents({"status": "pending"})
    quoted_quotes   = await db.quote_requests.count_documents({"status": "quoted"})
    accepted_quotes = await db.quote_requests.count_documents({"status": "accepted"})

    return {
        "total_villas":    total_villas,
        "pending_quotes":  pending_quotes,
        "quoted_quotes":   quoted_quotes,
        "accepted_quotes": accepted_quotes,
    }

"""Admin-only routes: manage customers, options, and view all selections."""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from app.database import get_db
from app.core.deps import require_admin
from app.core.security import hash_password
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.schemas.option import OptionCreate, OptionUpdate, OptionResponse
from app.schemas.category import CategoryUpdate, CategoryResponse
from bson import ObjectId
from datetime import datetime, timezone
from typing import List
import os, shutil, uuid

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Customer Management ────────────────────────────────────────────────────

@router.get("/customers", response_model=List[UserResponse])
async def list_customers(user=Depends(require_admin)):
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
async def create_customer(payload: UserCreate, user=Depends(require_admin)):
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
async def get_customer_selections(customer_id: str, user=Depends(require_admin)):
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

    return {
        "customer": customer_info,
        "selections": selections_doc.get("selections", []),
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

ALLOWED_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
STATIC_ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'static')

@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    category_id: str = Form(...),
    user=Depends(require_admin),
):
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail="Only jpg, jpeg, png, webp, gif allowed")
    safe_name = f"{uuid.uuid4().hex}{ext}"
    folder = os.path.join(STATIC_ROOT, 'options', category_id)
    os.makedirs(folder, exist_ok=True)
    dest = os.path.join(folder, safe_name)
    with open(dest, 'wb') as f:
        shutil.copyfileobj(file.file, f)
    return {"path": f"/static/options/{category_id}/{safe_name}"}


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

@router.get("/dashboard")
async def dashboard(user=Depends(require_admin)):
    db = get_db()
    total_customers = await db.users.count_documents({"role": "customer"})
    total_villas = await db.villas.count_documents({})
    assigned_villas = await db.villas.count_documents({"is_assigned": True})
    pending_quotes = await db.quote_requests.count_documents({"status": "pending"})
    submitted_selections = await db.customer_selections.count_documents({"status": "submitted"})

    return {
        "total_customers": total_customers,
        "total_villas": total_villas,
        "assigned_villas": assigned_villas,
        "pending_quotes": pending_quotes,
        "submitted_selections": submitted_selections,
    }

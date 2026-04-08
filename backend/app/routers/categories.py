from fastapi import APIRouter, Depends
from app.database import get_db
from app.core.deps import get_current_user
from app.schemas.category import CategoryResponse
from typing import List

router = APIRouter(prefix="/categories", tags=["categories"])


def _fmt(cat: dict) -> dict:
    cat["id"] = str(cat["_id"])
    return cat


@router.get("/", response_model=List[CategoryResponse])
async def list_categories(user=Depends(get_current_user)):
    db = get_db()
    cursor = db.categories.find({"is_active": True}).sort("sort_order", 1)
    cats = await cursor.to_list(length=None)
    return [_fmt(c) for c in cats]


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(category_id: str, user=Depends(get_current_user)):
    from fastapi import HTTPException
    db = get_db()
    cat = await db.categories.find_one({"category_id": category_id})
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return _fmt(cat)

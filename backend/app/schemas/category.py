from pydantic import BaseModel
from typing import Optional, Literal


class CategoryBase(BaseModel):
    category_id: str
    name: str
    tagline: Optional[str] = None
    sort_order: int
    notes: Optional[str] = None
    # "room_based" = floor->room->options (Flooring, Bathroom)
    # "direct" = options shown directly under category
    navigation_type: Literal["room_based", "direct"] = "direct"
    image_url: Optional[str] = None
    is_active: bool = True


class CategoryResponse(CategoryBase):
    id: str

    class Config:
        populate_by_name = True


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    tagline: Optional[str] = None
    is_active: Optional[bool] = None
    image_url: Optional[str] = None

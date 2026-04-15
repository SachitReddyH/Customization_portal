from pydantic import BaseModel
from typing import Optional, List, Literal


class StandardImage(BaseModel):
    path: str
    label: str


class OptionImages(BaseModel):
    standard: Optional[str] = "/static/options/placeholder/standard.png"
    standard_list: Optional[List[StandardImage]] = None
    upgrade: Optional[str] = "/static/options/placeholder/upgrade.png"
    upgrade_list: Optional[List[StandardImage]] = None


class RoomCovered(BaseModel):
    """Used for flooring packages that span multiple rooms."""
    location_id: str
    floor: Optional[str] = None
    space: Optional[str] = None
    room_code: Optional[str] = None
    standard_spec: Optional[str] = None
    upgrade_spec: Optional[str] = None
    has_upgrade: bool = False


class OptionBase(BaseModel):
    option_id: str
    category_id: str

    # For flooring: "individual" | "package"
    # For bathroom: "sanitaryware" | "cp_fittings"
    # For others: None
    sub_section: Optional[str] = None

    # Single-location options
    location_id: Optional[str] = None
    floor: Optional[str] = None
    space: Optional[str] = None
    room_code: Optional[str] = None

    # Multi-location (flooring packages)
    rooms_covered: Optional[List[RoomCovered]] = None

    option_type: Optional[str] = None   # "room-specific", "Add on", None
    option_name: Optional[str] = None   # package/series name

    standard_spec: Optional[str] = None
    upgrade_spec: Optional[str] = None
    has_upgrade: bool = False

    villa_type_applicable: List[str] = ["All"]
    # For EF/WF specific rooms (East Facing / West Facing)
    facing_applicable: Optional[str] = None   # "East", "West", None = both

    # Pricing
    price_inr: Optional[float] = None
    price_unit: Optional[str] = None
    # "fixed" | "on_request" | "tbd"
    price_status: Literal["fixed", "on_request", "tbd"] = "tbd"

    package_tier: Optional[str] = None
    description: Optional[str] = None
    detailed_spec: Optional[str] = None

    images: OptionImages = OptionImages()
    floor_plan_image: Optional[str] = None
    notes: Optional[str] = None
    sort_order: int = 1
    is_active: bool = True


class OptionResponse(OptionBase):
    id: str

    class Config:
        populate_by_name = True


class OptionCreate(OptionBase):
    pass


class OptionUpdate(BaseModel):
    option_name: Optional[str] = None
    standard_spec: Optional[str] = None
    upgrade_spec: Optional[str] = None
    has_upgrade: Optional[bool] = None
    price_inr: Optional[float] = None
    price_unit: Optional[str] = None
    price_status: Optional[str] = None
    package_tier: Optional[str] = None
    description: Optional[str] = None
    detailed_spec: Optional[str] = None
    images: Optional[OptionImages] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    villa_type_applicable: Optional[List[str]] = None

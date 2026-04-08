from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class FloorPlans(BaseModel):
    ground_floor: Optional[str] = None
    first_floor: Optional[str] = None
    second_floor: Optional[str] = None


class VillaBase(BaseModel):
    villa_number: int
    villa_name: str
    phase: int = 3
    villa_type: str           # "Type 1", "Type 2", "Type 3"
    facing: str               # "East", "West"
    plot_size: Optional[str] = None
    plot_area_sqft: Optional[float] = None
    floor_plans: FloorPlans = Field(default_factory=FloorPlans)
    master_plan_url: str = "/static/floor_plans/master_plan.png"


class VillaInDB(VillaBase):
    id: str = Field(alias="_id")
    is_assigned: bool = False
    created_at: datetime

    class Config:
        populate_by_name = True


class VillaResponse(VillaBase):
    id: str
    is_assigned: bool

    class Config:
        populate_by_name = True


class VillaUpdate(BaseModel):
    villa_type: Optional[str] = None
    facing: Optional[str] = None
    plot_size: Optional[str] = None
    plot_area_sqft: Optional[float] = None
    floor_plans: Optional[FloorPlans] = None

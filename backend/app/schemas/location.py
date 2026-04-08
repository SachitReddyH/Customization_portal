from pydantic import BaseModel
from typing import Optional


FLOOR_ORDER = {
    "Ground Floor": 1,
    "First Floor": 2,
    "Second Floor": 3,
    "All Floors": 4,
}


class LocationBase(BaseModel):
    location_id: str
    floor: str
    space: str
    room_code: str
    floor_order: int = 1


class LocationResponse(LocationBase):
    id: str

    class Config:
        populate_by_name = True

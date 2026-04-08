from fastapi import APIRouter, HTTPException, status, Depends
from app.database import get_db
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.core.deps import get_current_user
from app.schemas.user import LoginRequest, TokenResponse, RefreshRequest, UserResponse
from bson import ObjectId

router = APIRouter(prefix="/auth", tags=["auth"])


def _serialize_user(user: dict) -> dict:
    user["id"] = str(user["_id"])
    return user


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    db = get_db()
    user = await db.users.find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.get("is_active"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    token_data = {"sub": user["email"]}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        role=user["role"],
        user_id=str(user["_id"]),
        full_name=user["full_name"],
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest):
    data = decode_token(payload.refresh_token)
    if not data or data.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    db = get_db()
    user = await db.users.find_one({"email": data["sub"]})
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    token_data = {"sub": user["email"]}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        role=user["role"],
        user_id=str(user["_id"]),
        full_name=user["full_name"],
    )


@router.get("/me", response_model=UserResponse)
async def me(user=Depends(get_current_user)):
    user["id"] = str(user["_id"])
    return UserResponse(**user)

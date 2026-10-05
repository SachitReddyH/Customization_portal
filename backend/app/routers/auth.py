import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from app.database import get_db
from app.core.security import verify_password, hash_password, create_access_token, create_refresh_token, decode_token
from app.core.deps import get_current_user
from app.schemas.user import LoginRequest, TokenResponse, RefreshRequest, UserResponse, ForgotPasswordRequest, ResetPasswordRequest
from bson import ObjectId

ADMIN_ROLES = {"admin", "crm_admin", "design_admin", "guest_admin"}
RESET_TOKEN_EXPIRE_MINUTES = 15

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


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    db = get_db()
    user = await db.users.find_one({"email": payload.email})

    # Only admin roles can self-reset; don't reveal whether email exists
    if not user or user.get("role") not in ADMIN_ROLES:
        return {"reset_token": None}

    # Invalidate any existing unused tokens for this email
    await db.password_reset_tokens.update_many(
        {"email": payload.email, "used": False},
        {"$set": {"used": True}}
    )

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    await db.password_reset_tokens.insert_one({
        "email": payload.email,
        "token": token,
        "expires_at": expires_at,
        "used": False,
    })

    return {"reset_token": token, "expires_in_minutes": RESET_TOKEN_EXPIRE_MINUTES}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    db = get_db()
    record = await db.password_reset_tokens.find_one({"token": payload.token, "used": False})

    if not record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    expires_at = record["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token has expired")

    await db.users.update_one(
        {"email": record["email"]},
        {"$set": {"hashed_password": hash_password(payload.new_password), "updated_at": datetime.now(timezone.utc)}}
    )
    await db.password_reset_tokens.update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True}}
    )

    return {"message": "Password reset successfully"}

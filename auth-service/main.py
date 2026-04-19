import os
import traceback
import base64
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import psycopg2
import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from psycopg2.extras import RealDictCursor
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv()

app = FastAPI(title="FairGig Auth Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required (set in .env)")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


@app.exception_handler(Exception)
def unhandled_exception_handler(request, exc):
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"detail": str(exc)})


def hash_password(plain_password: str) -> str:
    try:
        return pwd_context.hash(plain_password)
    except Exception:
        # Fallback for environments where passlib backend detection fails.
        return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(plain_password, password_hash)
    except Exception:
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
        except Exception:
            return False


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    city_zone: Optional[str] = None
    category: Optional[str] = None
    cnic_name: Optional[str] = None
    cnic_number: Optional[str] = None
    cnic_address: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    city_zone: Optional[str] = None
    category: Optional[str] = None
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    cnic_name: Optional[str] = None
    cnic_number: Optional[str] = None
    cnic_address: Optional[str] = None
    created_at: Optional[datetime] = None


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserPublic


def get_conn():
    if not DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL is not configured")
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def create_token(user_id: str, role: str, expires_hours: int = 8) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=expires_hours),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def create_refresh_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def to_data_url(file_bytes: bytes, mime_type: str) -> str:
    encoded = base64.b64encode(file_bytes).decode("utf-8")
    mime = mime_type or "image/jpeg"
    return f"data:{mime};base64,{encoded}"


def normalize_cnic(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    raw = str(value).strip()
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 13:
        return f"{digits[:5]}-{digits[5:12]}-{digits[12:]}"
    return raw or None


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, name, email, role, city_zone, category, created_at,
                           avatar_url, phone, bio, cnic_name, cnic_number, cnic_address
                    FROM auth.users
                    WHERE id = %s
                    """,
                    (user_id,),
                )
                user = cur.fetchone()
                if not user:
                    raise HTTPException(status_code=401, detail="User not found")
                return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@app.post("/auth/register")
def register(payload: RegisterRequest):
    if payload.role not in {"worker", "verifier", "advocate"}:
        raise HTTPException(status_code=400, detail="Invalid role")

    password_hash = hash_password(payload.password)

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO auth.users (
                        name, email, password_hash, role, city_zone, category,
                                                cnic_name, cnic_number, cnic_address,
                        cnic_extracted_at
                    )
                    VALUES (
                        %s, %s, %s, %s,
                        NULLIF(%s, '')::auth.city_zone,
                        NULLIF(%s, '')::auth.worker_category,
                        NULLIF(%s, ''),
                                                NULLIF(%s, ''),
                        NULLIF(%s, ''),
                        CASE
                            WHEN NULLIF(%s, '') IS NOT NULL
                                                            OR NULLIF(%s, '') IS NOT NULL
                              OR NULLIF(%s, '') IS NOT NULL
                            THEN NOW()
                            ELSE NULL
                        END
                    )
                    RETURNING id, name, email, role, city_zone, category, created_at,
                              avatar_url, phone, bio, cnic_name, cnic_number, cnic_address
                    """,
                    (
                        payload.name,
                        payload.email,
                        password_hash,
                        payload.role,
                        payload.city_zone,
                        payload.category,
                        payload.cnic_name,
                        normalize_cnic(payload.cnic_number),
                        payload.cnic_address,
                        payload.cnic_name,
                        payload.cnic_number,
                        payload.cnic_address,
                    ),
                )
                user = cur.fetchone()
                conn.commit()
                return user
    except psycopg2.Error as ex:
        if "duplicate key" in str(ex).lower() or "unique" in str(ex).lower():
            raise HTTPException(status_code=409, detail="Email already exists")
        if "cnic_" in str(ex).lower() and "column" in str(ex).lower():
            raise HTTPException(
                status_code=500,
                detail="CNIC columns are missing. Run add_auth_profile_cnic_columns.sql in Neon and restart auth service.",
            )
        raise HTTPException(status_code=500, detail="Could not register user")


@app.get("/health")
def health():
    return {"status": "ok", "service": "auth-service", "port": 8001}


@app.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, email, role, password_hash, city_zone, category, created_at,
                       avatar_url, phone, bio, cnic_name, cnic_number, cnic_address
                FROM auth.users
                WHERE email = %s
                """,
                (payload.email,),
            )
            user = cur.fetchone()

    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = create_token(str(user["id"]), user["role"])
    refresh_token = create_refresh_token(str(user["id"]), user["role"])
    public = UserPublic(
        id=str(user["id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
        city_zone=user.get("city_zone"),
        category=user.get("category"),
        avatar_url=user.get("avatar_url"),
        phone=user.get("phone"),
        bio=user.get("bio"),
        cnic_name=user.get("cnic_name"),
        cnic_number=user.get("cnic_number"),
        cnic_address=user.get("cnic_address"),
        created_at=user.get("created_at"),
    )
    return LoginResponse(access_token=access_token, refresh_token=refresh_token, user=public)


@app.post("/auth/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest):
    try:
        decoded = jwt.decode(payload.refresh_token, JWT_SECRET, algorithms=[ALGORITHM])
        if decoded.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        user_id = decoded.get("sub")
        role = decoded.get("role")
        access_token = create_token(user_id, role)
        refresh_token = create_refresh_token(user_id, role)
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@app.get("/auth/me")
def me(user=Depends(get_current_user)):
    return user


@app.put("/auth/me")
async def update_me(
    user=Depends(get_current_user),
    avatar_file: Optional[UploadFile] = File(default=None),
    name: Optional[str] = Form(default=None),
    phone: Optional[str] = Form(default=None),
    city_zone: Optional[str] = Form(default=None),
    category: Optional[str] = Form(default=None),
    bio: Optional[str] = Form(default=None),
    cnic_name: Optional[str] = Form(default=None),
    cnic_number: Optional[str] = Form(default=None),
    cnic_address: Optional[str] = Form(default=None),
):
    avatar_url = None
    if avatar_file:
        data = await avatar_file.read()
        if data:
            avatar_url = to_data_url(data, avatar_file.content_type or "image/jpeg")

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE auth.users
                    SET name = COALESCE(NULLIF(%s, ''), name),
                        phone = COALESCE(NULLIF(%s, ''), phone),
                        city_zone = COALESCE(NULLIF(%s, '')::auth.city_zone, city_zone),
                        category = COALESCE(NULLIF(%s, '')::auth.worker_category, category),
                        bio = COALESCE(NULLIF(%s, ''), bio),
                        cnic_name = COALESCE(NULLIF(%s, ''), cnic_name),
                        cnic_number = COALESCE(NULLIF(%s, ''), cnic_number),
                        cnic_address = COALESCE(NULLIF(%s, ''), cnic_address),
                        cnic_extracted_at = CASE
                            WHEN NULLIF(%s, '') IS NOT NULL OR NULLIF(%s, '') IS NOT NULL OR NULLIF(%s, '') IS NOT NULL
                            THEN NOW()
                            ELSE cnic_extracted_at
                        END,
                        avatar_url = COALESCE(%s, avatar_url),
                        updated_at = NOW()
                    WHERE id = %s
                    RETURNING id, name, email, role, city_zone, category, created_at,
                              avatar_url, phone, bio, cnic_name, cnic_number, cnic_address
                    """,
                    (
                        name,
                        phone,
                        city_zone,
                        category,
                        bio,
                        cnic_name,
                        normalize_cnic(cnic_number),
                        cnic_address,
                        cnic_name,
                        cnic_number,
                        cnic_address,
                        avatar_url,
                        str(user["id"]),
                    ),
                )
                updated = cur.fetchone()
                conn.commit()

                if not updated:
                    raise HTTPException(status_code=404, detail="User not found")

                return updated
    except psycopg2.Error as ex:
        if "cnic_" in str(ex).lower() and "column" in str(ex).lower():
            raise HTTPException(
                status_code=500,
                detail="CNIC columns are missing. Run add_auth_profile_cnic_columns.sql in Neon and restart auth service.",
            )
        raise HTTPException(status_code=500, detail="Could not update profile")

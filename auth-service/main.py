import os
import traceback
from datetime import datetime, timedelta, timezone
from typing import Optional

import psycopg2
import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
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
                    SELECT id, name, email, role, city_zone, category, created_at
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
                    INSERT INTO auth.users (name, email, password_hash, role, city_zone, category)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, name, email, role, city_zone, category, created_at
                    """,
                    (
                        payload.name,
                        payload.email,
                        password_hash,
                        payload.role,
                        payload.city_zone,
                        payload.category,
                    ),
                )
                user = cur.fetchone()
                conn.commit()
                return user
    except psycopg2.Error as ex:
        if "duplicate key" in str(ex).lower() or "unique" in str(ex).lower():
            raise HTTPException(status_code=409, detail="Email already exists")
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
                SELECT id, name, email, role, password_hash, city_zone, category, created_at
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

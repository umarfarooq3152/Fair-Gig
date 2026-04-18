# Auth Service

JWT auth and role management for worker, verifier, and advocate accounts.

Install command:
`pip install fastapi uvicorn python-jose[cryptography] passlib[bcrypt] psycopg2-binary python-dotenv`

Start command:
`uvicorn main:app --port 8001 --reload`

Environment variables:
- `DATABASE_URL`
- `JWT_SECRET`

Endpoints:
- `POST /auth/register` — Register worker/verifier/advocate
- `POST /auth/login` — Returns access and refresh tokens
- `POST /auth/refresh` — Refresh JWT pair
- `GET /auth/me` — Return current user profile from Bearer token

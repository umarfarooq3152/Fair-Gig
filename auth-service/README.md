# Auth Service

JWT auth and role management for worker, verifier, and advocate accounts.

Install command:
`pip install fastapi uvicorn python-jose[cryptography] passlib[bcrypt] psycopg2-binary python-dotenv`

Start command:
`uvicorn main:app --port 8001 --reload`

Environment variables:
- `DATABASE_URL`
- `JWT_SECRET` (required — no default; must match earnings + grievance services)

Endpoints:
- `GET /health` — Liveness
- `POST /auth/register` — Register worker/verifier/advocate
- `POST /auth/login` — Returns `{ access_token, refresh_token, token_type, user }`
- `POST /auth/refresh` — Refresh JWT pair
- `GET /auth/me` — Return current user profile from Bearer token

Sample login:
```bash
curl -s -X POST http://localhost:8001/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"worker1@fairgig.demo\",\"password\":\"password\"}"
```

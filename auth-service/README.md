# Auth Service (Port 8001)

The Auth Service manages user registrations, login sessions, and Role-Based Access Control (RBAC) via JWTs for all internal systems (Worker, Verifier, Advocate).

## Tech Stack
Available in both **Node.js (Express)** AND **Python (FastAPI)**.

## How to run (FastAPI Version - Competition Default)
```bash
# From this directory
python -m venv venv
venv\Scripts\activate  # Windows
# or: source venv/bin/activate # Mac/Linux

pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
```

## How to run (Node.js Version)
```bash
# From this directory
npm install
npm run dev
```

## API Contracts
See the root `/API_CONTRACTS.md` for full parameter definitions.
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `GET /health`

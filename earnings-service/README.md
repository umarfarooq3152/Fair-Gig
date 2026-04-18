# Earnings Service

Node.js service for shift logging, CSV import, screenshot upload reference, and verification decisions.

Install command (from repo root, or `npm install` inside this folder if using local `package.json`):
`npm install express pg multer csv-parser cors dotenv jose`

Start command (from **repo root** so shared `node_modules` resolves):
`node earnings-service/index.js`

Environment variables:
- `DATABASE_URL`
- `JWT_SECRET` (required — same as auth-service; Bearer token on all routes)

Endpoints:
- `GET /health`
- `POST /shifts` — Create shift log (worker JWT; `worker_id` must match token)
- `GET /shifts` — List shifts (worker JWT; optional `worker_id` query, defaults to token subject)
- `PUT /shifts/:id` — Update shift
- `DELETE /shifts/:id` — Delete shift
- `POST /shifts/import-csv` — Bulk import shifts from CSV upload
- `POST /shifts/:id/screenshot` — Upload screenshot and store relative URL
- `GET /verifier/queue` — Pending shifts with screenshot (verifier JWT)
- `PUT /verifier/:id/decision` — Set `verified|flagged|unverifiable` (verifier JWT; `verifier_id` taken from token)
- Screenshot upload: JPEG/PNG only, max 5MB

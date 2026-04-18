# Earnings Service

Node.js service for shift logging, CSV import, screenshot upload reference, and verification decisions.

Install command:
`npm install express pg multer csv-parser cors dotenv`

Start command:
`node index.js`

Environment variables:
- `DATABASE_URL`

Endpoints:
- `POST /shifts` — Create shift log
- `GET /shifts` — List worker shifts with optional filters
- `PUT /shifts/:id` — Update shift
- `DELETE /shifts/:id` — Delete shift
- `POST /shifts/import-csv` — Bulk import shifts from CSV upload
- `POST /shifts/:id/screenshot` — Upload screenshot and store relative URL
- `GET /verifier/queue` — Pending shifts with screenshot for manual review
- `PUT /verifier/:id/decision` — Set `verified|flagged|unverifiable` status

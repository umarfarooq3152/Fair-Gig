# Grievance Service

Node.js + TypeScript service for complaint posting, tagging, clustering, and advocate moderation.

Install command:
`npm install express pg cors dotenv jose` (+ `tsx` / `typescript` for TypeScript)

Start command (from **repo root**):
`npx tsx grievance-service/index.ts`

Environment variables:
- `DATABASE_URL`
- `JWT_SECRET` (required — same as auth-service)

Primary endpoints (details in `API_CONTRACTS.md`):
- `GET /health`
- `GET /api/complaints/public` — Public grievance board
- `POST /api/complaints` — Worker creates complaint (Bearer required)
- `GET /api/complaints/advocate/feed` — Advocate moderation queue (cursor pagination)
- `PUT /api/complaints/:id/moderate` — Advocate updates tags / category / notes
- `GET /api/complaints/:id` — Single complaint
- `GET /api/complaints/board/tag-clusters` — GROUP BY tag + platform with `complaint_ids` arrays

Legacy aliases:
- `GET /complaints` → public feed
- `POST /complaints` → `POST /api/complaints`
- `GET /complaints/clusters` → `{ clusters: [...] }`

# Grievance Service (Port 8004)

The Grievance Service powers the public issue reporting and the advocate tracking pipelines.

## Tech Stack
**Node.js (Express) + TypeScript**. Employs PostgreSQL robust array operations and semantic grouping to bucket complaints.

## How to run
```bash
# From this directory
npm install
npm run dev
```

## API Contracts
See the root `/API_CONTRACTS.md` for full parameter definitions.
- `GET /api/complaints/public`
- `POST /api/complaints`
- `GET /api/complaints/advocate/feed`
- `PUT /api/complaints/:id/moderate`
- `GET /api/complaints/board/tag-clusters`
- `GET /health`

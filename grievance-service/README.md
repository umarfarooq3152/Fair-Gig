# Grievance Service

Node.js service for complaint posting, tagging, clustering, and escalation workflow.

Install command:
`npm install express pg cors dotenv`

Start command:
`node index.js`

Environment variables:
- `DATABASE_URL`

Endpoints:
- `POST /complaints` — Worker creates complaint
- `GET /complaints` — List complaints with filters
- `PUT /complaints/:id/tags` — Add/update tags array
- `PUT /complaints/:id/status` — Set status to `open|escalated|resolved`
- `GET /complaints/clusters` — Grouped complaint clusters by primary tag and platform

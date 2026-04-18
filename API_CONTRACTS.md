# FairGig REST API contracts

All services use JSON over HTTP. Authenticated calls send `Authorization: Bearer <access_token>` from `POST /auth/login` on the auth service (port 8001). **Set the same `JWT_SECRET` in every service that verifies tokens.**

| Port | Service | Base URL |
|------|---------|----------|
| 8001 | Auth | `http://localhost:8001` |
| 8002 | Earnings | `http://localhost:8002` |
| 8003 | Anomaly | `http://localhost:8003` |
| 8004 | Grievance | `http://localhost:8004` |
| 8005 | Analytics | `http://localhost:8005` |

## Auth (8001)

- `POST /auth/register` — body: `name`, `email`, `password`, `role`, optional `city_zone`, `category`
- `POST /auth/login` — body: `email`, `password` → `{ access_token, refresh_token, token_type, user }`
- `POST /auth/refresh` — body: `{ refresh_token }`
- `GET /auth/me` — Bearer required
- `GET /health`

## Earnings (8002)

All shift routes require Bearer JWT.

- **Worker** `role=worker`: `GET /shifts?worker_id=&platform=&from=&to=` (`worker_id` optional; defaults to JWT `sub`; must not differ from `sub`)
- **Worker**: `POST /shifts`, `PUT /shifts/:id`, `DELETE /shifts/:id`, `POST /shifts/import-csv` (multipart `file` + `worker_id`), `POST /shifts/:id/screenshot` (multipart `file`, JPEG/PNG, max 5MB)
- **Verifier** `role=verifier`: `GET /verifier/queue`, `PUT /verifier/:id/decision` body `{ status }` (verifier id taken from token)
- `GET /health`

## Anomaly (8003)

- `POST /analyze` — body: `{ worker_id, earnings: [...] }`
- `GET /health`, `GET /docs`, `GET /openapi.json`

## Grievance (8004)

- `GET /health`
- `GET /api/complaints/public` — public list
- `POST /api/complaints` — worker JWT; body: `platform`, `category`, `description`, optional `is_anonymous`, `tags`
- Advocate/moderation: `GET /api/complaints/advocate/feed`, `PUT /api/complaints/:id/moderate`, bulk/cluster routes — **advocate** JWT
- `GET /api/complaints/:id` — single complaint
- `GET /api/complaints/board/tag-clusters` — grouped counts + `complaint_ids` arrays
- Legacy: `GET /complaints` → public feed; `GET /complaints/clusters` → `{ clusters: [...] }`

## Analytics (8005)

- `GET /health`
- `GET /analytics/commission-trends`
- `GET /analytics/income-distribution?zone=` → `{ zones: [...], histogram: [{ zone, bucket_range, worker_count }] }`
- `GET /analytics/vulnerability-flags`
- `GET /analytics/median/{category}/{zone}`
- `GET /analytics/top-complaints`

## Frontend env

Prefix `NEXT_PUBLIC_*` in `frontend/.env` — see `frontend/.env.example`.

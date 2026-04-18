# FairGig API Contracts

| Service | Method | Route | Description |
|---|---|---|---|
| Auth | POST | `/auth/register` | Register worker/verifier/advocate |
| Auth | POST | `/auth/login` | Issue access and refresh tokens |
| Auth | POST | `/auth/refresh` | Refresh JWT tokens |
| Auth | GET | `/auth/me` | Get current user profile |
| Earnings | POST | `/shifts` | Create shift log |
| Earnings | GET | `/shifts` | List shifts with worker/platform/date filters |
| Earnings | PUT | `/shifts/:id` | Update shift |
| Earnings | DELETE | `/shifts/:id` | Delete shift |
| Earnings | POST | `/shifts/import-csv` | Bulk import CSV |
| Earnings | POST | `/shifts/:id/screenshot` | Upload screenshot file reference |
| Earnings | GET | `/verifier/queue` | Pending queue with screenshots |
| Earnings | PUT | `/verifier/:id/decision` | Set verification decision |
| Anomaly | POST | `/analyze` | Detect deduction spike/income drop/hourly drop |
| Grievance | POST | `/complaints` | Create complaint |
| Grievance | GET | `/complaints` | List complaints with filters |
| Grievance | PUT | `/complaints/:id/tags` | Update tags array |
| Grievance | PUT | `/complaints/:id/status` | Update complaint status |
| Grievance | GET | `/complaints/clusters` | SQL grouped complaint clusters |
| Analytics | GET | `/analytics/commission-trends` | Monthly platform commission trends |
| Analytics | GET | `/analytics/income-distribution` | Zone income buckets |
| Analytics | GET | `/analytics/vulnerability-flags` | Workers with >20% MoM drop |
| Analytics | GET | `/analytics/median/:category/:zone` | City median hourly rate |
| Analytics | GET | `/analytics/top-complaints` | Top complaint categories (7 days) |
| Certificate | GET | `/certificate` | Render HTML certificate for print |
| Certificate | GET | `/verify/:id` | Render digitally verified proof of certificate |

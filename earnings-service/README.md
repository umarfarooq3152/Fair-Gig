# Earnings Service (Port 8002)

The Earnings Service acts as the core ledger. It processes gig worker shift inputs, manages multi-platform CSV imports, stores cryptographic proofs (screenshots) in Supabase, and serves verifier validation queues.

## Tech Stack
**Node.js (Express) + TypeScript**. Connects securely via PostgreSQL (Neon).

## How to run
```bash
# From this directory
npm install
npm run dev
```

## API Contracts
See the root `/API_CONTRACTS.md` for full parameter definitions.
- `GET /shifts`
- `POST /shifts`
- `POST /shifts/import-csv`
- `POST /shifts/:id/screenshot`
- `GET /verifier/queue`
- `PUT /verifier/:id/decision`
- `GET /health`

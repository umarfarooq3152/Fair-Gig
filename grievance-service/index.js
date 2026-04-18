/**
 * The real server is `index.ts` (JWT, /api/* routes, advocate tools).
 * Start via repo root: `npx tsx grievance-service/index.ts` or `npm run dev` (orchestrator).
 */
console.error(
  'grievance-service: run `npx tsx index.ts` from repo root, or use `npm run dev` — not `node index.js`.',
);
process.exit(1);

# Certificate Renderer Service (Port 8006)

The Certificate Renderer Service generates legally sound, print-friendly Income Validation Certificates, displaying a secure verification QR code that third parties (banks/landlords) can scan.

## Tech Stack
**Node.js (Express) + EJS Templates**.

## How to run
```bash
# From this directory
npm install
npm run dev
```

## API Contracts
- `GET /certificate?worker_id={id}&from_date={date}&to_date={date}`
- `GET /verify/:id`
- `GET /health`

# Anomaly Service (Port 8003)

The Anomaly Service executes the intelligent data models to detect malicious activities and extreme wage drops across platforms. It identifies `deduction_spike`, `income_drop`, and `hourly_rate_drop` anomalies.

## Tech Stack
**Python (FastAPI)** + **NumPy**. Utilizes Pydantic to ensure 100% robust boundary protection against adversarial data inputs.

## How to run
```bash
# From this directory
python -m venv venv
venv\Scripts\activate  # Windows
# or: source venv/bin/activate # Mac/Linux

pip install -r requirements.txt
uvicorn main:app --port 8003 --reload
```

## Special Note on Swagger
FastAPI automatically generates an OpenAPI spec. Judges can access the interactive documentation directly via:
- **Swagger Docs:** `http://localhost:8003/docs`
- **OpenAPI Schema:** `http://localhost:8003/openapi.json`

## API Contracts
See the root `/API_CONTRACTS.md` for full parameter definitions.
- `POST /analyze`
- `GET /health`

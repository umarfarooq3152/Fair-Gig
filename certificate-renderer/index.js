import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import qrcode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.CERT_PORT || 8006;
const EARNINGS_SERVICE_URL = process.env.EARNINGS_SERVICE_URL || 'http://localhost:8002';

app.use(cors());
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Core Endpoint: Renders the Certificate
app.get('/certificate', async (req, res) => {
    const { worker_id, from_date, to_date } = req.query;

    if (!worker_id || !from_date || !to_date) {
        return res.status(400).send('worker_id, from_date, and to_date are required');
    }

    try {
        // 1. Fetch Verified Data from Earnings Service
        const earningsRes = await fetch(`${EARNINGS_SERVICE_URL}/shifts/income-certificate?worker_id=${worker_id}&from_date=${from_date}&to_date=${to_date}`);

        if (!earningsRes.ok) {
            const errText = await earningsRes.text();
            return res.status(earningsRes.status).send(`Failed to fetch earnings: ${errText}`);
        }

        const data = await earningsRes.json();

        // 2. Aggregate Totals
        let grandTotalNet = 0;
        let grandTotalGross = 0;
        let grandTotalDeductions = 0;
        let totalShifts = 0;

        const platforms = data.platforms || [];
        platforms.forEach(p => {
            grandTotalNet += Number(p.net_received || 0);
            grandTotalGross += Number(p.gross_earned || 0);
            grandTotalDeductions += Number(p.deductions || 0);
            totalShifts += Number(p.total_shifts || 0);
        });

        // 3. Generate QR Code
        const verificationId = `CERT-${worker_id.substring(0, 8).toUpperCase()}-${Date.now()}`;
        const verifyUrl = `${req.protocol}://${req.get('host')}/verify/${verificationId}`;
        const qrImageBase64 = await qrcode.toDataURL(verifyUrl, { width: 150 });

        // 4. Render EJS Template
        res.render('certificate', {
            worker_id,
            from_date,
            to_date,
            issue_date: new Date().toISOString().split('T')[0],
            verificationId,
            verifyUrl,
            qrImageBase64,
            platforms,
            grandTotalNet,
            grandTotalGross,
            grandTotalDeductions,
            totalShifts
        });

    } catch (err) {
        console.error('Renderer Error:', err);
        res.status(500).send('Internal Server Error generating certificate');
    }
});

// Verification Endpoint
app.get('/verify/:id', (req, res) => {
    const { id } = req.params;
    res.send(`
    <html>
      <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h1 style="color: green;">✅ Digitally Verified</h1>
        <p>This certificate ID <strong>${id}</strong> was issued by the FairGig Platform.</p>
        <p>The printed earnings represent verified truth corroborated by gig platform data.</p>
      </body>
    </html>
  `);
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'certificate-renderer' }));

app.listen(PORT, () => {
    console.log(`Certificate Renderer Service is running on http://localhost:${PORT}`);
});

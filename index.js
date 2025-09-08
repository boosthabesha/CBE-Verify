// index.js
console.log("🚀 Starting CBE Verifier API...");

const express = require('express');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();

// -----------------------
// Middleware
// -----------------------
app.use(cors());
app.use(bodyParser.json());

// -----------------------
// Serve frontend files
// -----------------------
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------
// Verify CBE transaction
// -----------------------
app.post('/api/verify', async (req, res) => {
  const { transaction, last8 } = req.body;

  if (!transaction || !last8 || last8.length !== 8) {
    return res.status(400).json({ ok: false, message: 'Transaction and last 8 digits required' });
  }

  const target = `https://apps.cbe.com.et:100/BranchReceipt/${encodeURIComponent(transaction)}&${encodeURIComponent(last8)}`;

  try {
    const response = await axios.get(target, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/pdf',
        'Referer': 'https://apps.cbe.com.et/'
      },
      timeout: 15000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const buffer = Buffer.from(response.data);

    if (!buffer || buffer.length === 0) {
      return res.json({ ok: false, message: 'Transaction Failed', reason: 'Receipt PDF is empty' });
    }

    const data = await pdfParse(buffer);

    // Flexible success check
    const textLower = data.text.trim().toLowerCase();
    const successKeywords = ['successful', 'paid', 'completed', 'receipt', 'ተከፈለ']; // English + Amharic
    const success = successKeywords.some(keyword => textLower.includes(keyword));

    // Save JSON for record
    fs.writeFileSync(`receipt-${transaction}.json`, JSON.stringify({ text: data.text }, null, 2));

    if (success) {
      res.json({ ok: true, message: 'Transaction Successful' });
    } else {
      res.json({
        ok: false,
        message: 'Transaction Failed',
        reason: 'Transaction not recognized as successful',
        snippet: data.text.slice(0, 500) // first 500 chars for debugging
      });
    }

  } catch (err) {
    res.json({
      ok: false,
      message: 'Transaction Failed',
      reason: 'Verification service unavailable: ' + err.message
    });
  }
});

// -----------------------
// SPA fallback
// -----------------------
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    next();
  }
});

// -----------------------
// Start server
// -----------------------
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

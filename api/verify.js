// api/verify.js
import axios from 'axios';
import pdfParse from 'pdf-parse';
import https from 'https';

export default async function handler(req, res) {
  if (req.method !== 'POST') 
    return res.status(405).json({ ok: false, message: 'Method not allowed' });

  const { transaction, last8 } = req.body;

  if (!transaction || !last8 || last8.length !== 8) {
    return res.status(400).json({ ok: false, message: 'Transaction and last 8 digits required' });
  }

  const target = `https://apps.cbe.com.et:100/BranchReceipt/${encodeURIComponent(transaction)}&${encodeURIComponent(last8)}`;

  try {
    const response = await axios.get(target, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/pdf',
        'Referer': 'https://apps.cbe.com.et/'
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const buffer = Buffer.from(response.data || []);
    if (!buffer.length) {
      return res.status(200).json({ ok: false, message: 'Transaction Failed', reason: 'Empty PDF received' });
    }

    const data = await pdfParse(buffer);
    const textLower = data.text.trim().toLowerCase();

    // Keywords for success (English + Amharic)
    const successKeywords = ['successful', 'paid', 'completed', 'receipt', 'ተከፈለ'];
    const success = successKeywords.some(keyword => textLower.includes(keyword));

    return res.status(200).json({
      ok: success,
      message: success ? 'Transaction Successful' : 'Transaction Failed'
    });

  } catch (err) {
    return res.status(200).json({
      ok: false,
      message: 'Verification Failed',
      reason: err.message
    });
  }
}

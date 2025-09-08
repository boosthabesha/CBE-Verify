// /api/verify.js
import axios from 'axios';
import pdf from 'pdf-parse-lite';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const { transaction, last8 } = req.body;

  if (!transaction || !last8 || last8.length !== 8) {
    return res.status(400).json({ ok: false, message: 'Transaction and last 8 digits required' });
  }

  const target = `https://apps.cbe.com.et:100/BranchReceipt/${encodeURIComponent(transaction)}&${encodeURIComponent(last8)}`;

  try {
    // Fetch PDF as arraybuffer
    const response = await axios.get(target, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/pdf',
        'Referer': 'https://apps.cbe.com.et/'
      }
    });

    const buffer = Buffer.from(response.data || []);

    if (!buffer.length) {
      return res.status(200).json({
        ok: false,
        message: 'Transaction Failed',
        reason: 'Empty PDF received'
      });
    }

    // Parse PDF text
    let text;
    try {
      text = await pdf(buffer);
      text = text.toLowerCase();
    } catch (err) {
      return res.status(200).json({
        ok: false,
        message: 'Transaction Failed',
        reason: 'Failed to parse PDF: ' + err.message
      });
    }

    // Check success keywords (English + Amharic)
    const successKeywords = ['successful', 'paid', 'completed', 'receipt', 'ተከፈለ'];
    const success = successKeywords.some(k => text.includes(k));

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

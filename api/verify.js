// api/verify.js
import axios from 'axios';
import pdfParse from 'pdf-parse';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed' });

  const { transaction, last8 } = req.body;

  if (!transaction || !last8) {
    return res.status(400).json({ ok: false, message: 'Transaction and last 8 digits required' });
  }

  const target = `https://apps.cbe.com.et:100/BranchReceipt/${encodeURIComponent(transaction)}&${encodeURIComponent(last8)}`;

  try {
    const response = await axios.get(target, { responseType: 'arraybuffer', timeout: 10000 });

    if (!response || !response.data) throw new Error('Empty response');

    const buffer = Buffer.from(response.data);
    const data = await pdfParse(buffer);
    const text = data.text.toLowerCase();
    const success = text.includes('successful') || text.includes('receipt');

    res.status(200).json({ ok: success, message: success ? 'Transaction Successful' : 'Transaction Failed' });
  } catch (err) {
    res.status(502).json({ ok: false, message: 'Verification Failed', reason: err.message });
  }
}

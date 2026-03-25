import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import FormData from 'form-data';
import multer from 'multer';
import { YoutubeTranscript } from 'youtube-transcript'; 

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'Online', project: 'Toolyfi' }));

// 1. GOLD RATES
app.get('/api/gold-rates', async (req, res) => {
  try {
    const apiKey = process.env.ALPHA_KEY || 'RCFGMFP9WZI5OLHF';
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: { function: 'CURRENCY_EXCHANGE_RATE', from_currency: 'XAU', to_currency: 'USD', apikey: apiKey }
    });
    const data = response.data['Realtime Currency Exchange Rate'];
    if (!data) return res.status(500).json({ error: 'Data not found' });
    
    const goldUSD = parseFloat(data['5. Exchange Rate']);
    const goldPKR = goldUSD * 280; 
    res.json({ success: true, rates: { perOunceUSD: goldUSD, perTolaPKR: (goldPKR / 31.103 * 11.66).toFixed(0) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. BACKGROUND REMOVER
app.post('/api/remove-bg', upload.single('image'), async (req, res) => {
  try {
    const apiKey = process.env.CLIPDROP_KEY;
    const form = new FormData();
    form.append('image_file', req.file.buffer, { filename: 'upload.png' });
    const response = await axios.post('https://clipdrop-api.co/remove-background/v1', form, {
      headers: { 'x-api-key': apiKey, ...form.getHeaders() },
      responseType: 'arraybuffer'
    });
    res.set('Content-Type', 'image/png');
    res.send(response.data);
  } catch (e) { res.status(500).json({ error: 'BG removal failed' }); }
});

// 3. YOUTUBE TRANSCRIPT (Fixed Logic)
app.get('/api/transcript', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL missing' });
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    res.json({ success: true, text: transcript.map(t => t.text).join(' ') });
  } catch (e) { res.status(500).json({ error: 'Transcript failed' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));

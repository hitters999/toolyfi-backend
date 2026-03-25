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

// ==========================================
// HOME ROUTE
// ==========================================
app.get('/', (req, res) => {
  res.json({
    message: 'Toolyfi Backend Running!',
    status: 'Active',
    author: 'Toolyfi Team'
  });
});

// ==========================================
// 1. GOLD RATES API
// ==========================================
app.get('/api/gold-rates', async (req, res) => {
  try {
    // Railway Variables se key uthayega, warna default backup use karega
    const apiKey = process.env.ALPHA_KEY || 'RCFGMFP9WZI5OLHF';

    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'CURRENCY_EXCHANGE_RATE',
        from_currency: 'XAU',
        to_currency: 'USD',
        apikey: apiKey
      }
    });

    const data = response.data['Realtime Currency Exchange Rate'];

    if (!data) {
      return res.status(500).json({ error: 'Gold rate data not found' });
    }

    const goldUSD = parseFloat(data['5. Exchange Rate']);
    const usdPkr = 280; // Isko aap dynamic bhi kar sakte hain baad mein
    const goldPKR = goldUSD * usdPkr;
    const goldPerTola = (goldPKR / 31.103) * 11.66; // Standard Tola Calculation

    res.json({
      success: true,
      lastUpdated: data['6. Last Refreshed'],
      rates: {
        perOunceUSD: goldUSD.toFixed(2),
        perTolaPKR: Math.round(goldPerTola).toLocaleString(),
        perGramPKR: (goldPKR / 31.103).toFixed(2)
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Server error', detail: error.message });
  }
});

// ==========================================
// 2. BACKGROUND REMOVER API
// ==========================================
app.post('/api/remove-bg', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an image' });
    }

    // Railway Variables mein 'CLIPDROP_KEY' ke naam se key lazmi dalein
    const apiKey = process.env.CLIPDROP_KEY;

    const form = new FormData();
    form.append('image_file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const response = await axios.post(
      'https://clipdrop-api.co/remove-background/v1',
      form,
      {
        headers: {
          'x-api-key': apiKey,
          ...form.getHeaders()
        },
        responseType: 'arraybuffer'
      }
    );

    res.set('Content-Type', 'image/png');
    res.send(response.data);

  } catch (error) {
    res.status(500).json({
      error: 'Background removal failed',
      detail: error.message
    });
  }
});

// ==========================================
// 3. YOUTUBE TRANSCRIPT API
// ==========================================
app.get('/api/transcript', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];

    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    const fullText = transcript.map(item => item.text).join(' ');

    res.json({
      success: true,
      videoId,
      transcript: fullText
    });

  } catch (error) {
    res.status(500).json({
      error: 'Transcript fetch failed',
      detail: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const { YoutubeTranscript } = require('youtube-transcript');

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
    routes: {
      goldRates: '/api/gold-rates',
      removeBg: '/api/remove-bg',
      transcript: '/api/transcript'
    }
  });
});

// ==========================================
// 1. GOLD RATES API (Alpha Vantage)
// ==========================================
app.get('/api/gold-rates', async (req, res) => {
  try {
    const apiKey = process.env.ALPHAVANTAGE_KEY;

    // Gold price in USD (XAU/USD)
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
      return res.status(500).json({ error: 'Gold rate nahi mila' });
    }

    const goldUSD = parseFloat(data['5. Exchange Rate']);

    // PKR conversion (1 USD = 278 PKR approx)
    const usdPkr = 278;
    const goldPKR = goldUSD * usdPkr;

    // Per tola calculation (1 troy oz = 2.43 tola)
    const goldPerTola = goldPKR / 2.43;

    res.json({
      success: true,
      lastUpdated: data['6. Last Refreshed'],
      rates: {
        perOunceUSD: goldUSD.toFixed(2),
        perOuncePKR: goldPKR.toFixed(2),
        perTolaPKR: goldPerTola.toFixed(2),
        perGramPKR: (goldPKR / 31.1).toFixed(2)
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Server error', detail: error.message });
  }
});

// ==========================================
// 2. BACKGROUND REMOVER API (Clipdrop)
// ==========================================
app.post('/api/remove-bg', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image upload karo' });
    }

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
    res.status(500).json({ error: 'Background remove nahi hua', detail: error.message });
  }
});

// ==========================================
// 3. YOUTUBE TRANSCRIPT API
// ==========================================
app.get('/api/transcript', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'YouTube URL do ?url=...' });
    }

    // Video ID extract karna
    const videoId = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/
    )?.[1];

    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    const fullText = transcript.map(item => item.text).join(' ');

    res.json({
      success: true,
      videoId,
      transcript: fullText,
      segments: transcript
    });

  } catch (error) {
    res.status(500).json({ error: 'Transcript nahi mila', detail: error.message });
  }
});

// ==========================================
// SERVER START
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Toolyfi Backend running on port ${PORT}`);
});

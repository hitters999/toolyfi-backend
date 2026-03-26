import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import FormData from 'form-data';
import multer from 'multer';

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
    status: 'Online',
    project: 'Toolyfi',
    routes: {
      goldRates: '/api/gold-rates',
      removeBg: '/api/remove-bg'
    }
  });
});

// ==========================================
// 1. GOLD RATES API (Alpha Vantage)
// ==========================================
app.get('/api/gold-rates', async (req, res) => {
  try {
    const apiKey = process.env.ALPHAVANTAGE_KEY || 'RCFGMFP9WZI5OLHF';

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
    const usdPkr = 280;
    const goldPKR = goldUSD * usdPkr;
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
// SERVER START
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Toolyfi Backend running on port ${PORT}`);
});

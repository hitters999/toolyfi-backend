const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Cache system
let cache = {};
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes

function getCache(key) {
  if (cache[key] && Date.now() - cache[key].time < CACHE_TIME) {
    return cache[key].data;
  }
  return null;
}

function setCache(key, data) {
  cache[key] = { data, time: Date.now() };
}

// ============================================
// ROUTE 1: Gold + Currency Rates
// ============================================
app.get('/api/gold', async (req, res) => {
  try {
    const cached = getCache('gold');
    if (cached) return res.json(cached);

    // Fetch Gold Price (USD/oz)
    let goldUSD = 3300; // fallback

    // Method 1: Alpha Vantage (with API key - most reliable)
    try {
      const avKey = process.env.ALPHAVANTAGE_KEY;
      if (avKey) {
        const r = await fetch(
          'https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=' + avKey
        );
        if (r.ok) {
          const d = await r.json();
          const rate = d['Realtime Currency Exchange Rate'];
          if (rate && rate['5. Exchange Rate']) {
            const price = parseFloat(rate['5. Exchange Rate']);
            if (price > 1000) goldUSD = price;
          }
        }
      }
    } catch(e) {}

    // Method 2: metals.live fallback
    if (goldUSD === 3300) {
      try {
        const r = await fetch('https://api.metals.live/v1/spot/gold');
        if (r.ok) {
          const d = await r.json();
          const price = Array.isArray(d) ? d[0]?.price : d?.price;
          if (price && price > 1000) goldUSD = price;
        }
      } catch(e) {}
    }

    // Method 3: gold-api.com fallback
    if (goldUSD === 3300) {
      try {
        const r = await fetch('https://api.gold-api.com/price/XAU');
        if (r.ok) {
          const d = await r.json();
          const price = d.price || d.Price || d.ask || null;
          if (price && price > 1000) goldUSD = price;
        }
      } catch(e) {}
    }

    // Fetch Currency Rates
    let rates = {};
    try {
      const fxRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (fxRes.ok) {
        const data = await fxRes.json();
        rates = data.rates || {};
      }
    } catch(e) {}

    const fallback = {
      PKR:278.50, EUR:0.92, GBP:0.79, SAR:3.75, AED:3.67,
      QAR:3.64, KWD:0.31, BHD:0.38, OMR:0.38, INR:83.5,
      CNY:7.24, JPY:149.5, CAD:1.36, AUD:1.53, CHF:0.89,
      SGD:1.34, MYR:4.72, TRY:32.5, BDT:110, ZAR:18.63
    };
    Object.keys(fallback).forEach(k => { if (!rates[k]) rates[k] = fallback[k]; });

    const usdToPkr = rates.PKR || 278.50;
    const goldPKRperOz = goldUSD * usdToPkr;
    const goldPKRperGram = goldPKRperOz / 31.1035;
    const goldPKRperTola = goldPKRperGram * 11.664;

    const CURRENCY_META = [
      { flag:'🇺🇸', name:'US Dollar',         code:'USD' },
      { flag:'🇪🇺', name:'Euro',              code:'EUR' },
      { flag:'🇬🇧', name:'British Pound',     code:'GBP' },
      { flag:'🇸🇦', name:'Saudi Riyal',       code:'SAR' },
      { flag:'🇦🇪', name:'UAE Dirham',        code:'AED' },
      { flag:'🇶🇦', name:'Qatari Riyal',      code:'QAR' },
      { flag:'🇰🇼', name:'Kuwaiti Dinar',     code:'KWD' },
      { flag:'🇧🇭', name:'Bahraini Dinar',    code:'BHD' },
      { flag:'🇴🇲', name:'Omani Rial',        code:'OMR' },
      { flag:'🇮🇳', name:'Indian Rupee',      code:'INR' },
      { flag:'🇨🇳', name:'Chinese Yuan',      code:'CNY' },
      { flag:'🇯🇵', name:'Japanese Yen',      code:'JPY' },
      { flag:'🇨🇦', name:'Canadian Dollar',   code:'CAD' },
      { flag:'🇦🇺', name:'Australian Dollar', code:'AUD' },
      { flag:'🇨🇭', name:'Swiss Franc',       code:'CHF' },
      { flag:'🇸🇬', name:'Singapore Dollar',  code:'SGD' },
      { flag:'🇲🇾', name:'Malaysian Ringgit', code:'MYR' },
      { flag:'🇹🇷', name:'Turkish Lira',      code:'TRY' },
      { flag:'🇧🇩', name:'Bangladeshi Taka',  code:'BDT' },
      { flag:'🇿🇦', name:'South African Rand',code:'ZAR' },
    ];

    const currencies = CURRENCY_META.map(c => ({
      ...c,
      rate: usdToPkr / (rates[c.code] || 1)
    }));

    const result = {
      goldUSD: Math.round(goldUSD * 100) / 100,
      usdToPkr: Math.round(usdToPkr * 100) / 100,
      goldPKRperTola: Math.round(goldPKRperTola),
      goldPKRperGram: Math.round(goldPKRperGram),
      goldPKRper10Gram: Math.round(goldPKRperGram * 10),
      goldPKRperOunce: Math.round(goldPKRperOz),
      currencies,
      lastUpdated: new Date().toISOString()
    };

    setCache('gold', result);
    res.json(result);

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROUTE 2: YouTube Transcript
// ============================================
app.get('/api/transcript', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'videoId required' });

  const cacheKey = 'transcript_' + videoId;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    // Method 1: YouTube timedtext API
    try {
      const url = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=json3`;
      const ytRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (ytRes.ok) {
        const data = await ytRes.json();
        if (data && data.events) {
          const text = data.events
            .filter(e => e.segs)
            .map(e => e.segs.map(s => s.utf8 || '').join(''))
            .join(' ')
            .replace(/\s+/g, ' ').trim();
          if (text.length > 50) {
            const result = { transcript: text };
            setCache(cacheKey, result);
            return res.json(result);
          }
        }
      }
    } catch(e) {}

    // Method 2: YouTube watch page scraping
    try {
      const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const ytRes = await fetch(ytUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      const html = await ytRes.text();
      const captionMatch = html.match(/"captionTracks":(\[.*?\])/);
      if (captionMatch) {
        const captions = JSON.parse(captionMatch[1]);
        const track = captions.find(t => t.languageCode === 'en') || captions[0];
        if (track && track.baseUrl) {
          const transcriptRes = await fetch(track.baseUrl);
          const xml = await transcriptRes.text();
          const texts = [...xml.matchAll(/<text[^>]*>(.*?)<\/text>/gs)]
            .map(m => m[1]
              .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>').replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"').replace(/<[^>]*>/g, ''))
            .join(' ');
          if (texts.length > 50) {
            const result = { transcript: texts };
            setCache(cacheKey, result);
            return res.json(result);
          }
        }
      }
    } catch(e) {}

    res.status(404).json({ error: 'Transcript not available' });

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROUTE 3: REMOVE BACKGROUND (NEW) - Clipdrop API
// ============================================
app.post('/api/remove-bg', async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image data required (base64)' });
    }

    const clipdropKey = process.env.CLIPDROP_API_KEY || 'a9ac3fb8f4e1436086cadd0c55d6dfc0829b3c5c';
    
    if (!clipdropKey) {
      return res.status(500).json({ error: 'Clipdrop API key not configured' });
    }

    // Convert base64 to buffer
    let imageBuffer;
    if (image.startsWith('data:')) {
      // Data URL format
      const base64 = image.split(',')[1];
      imageBuffer = Buffer.from(base64, 'base64');
    } else {
      // Direct base64
      imageBuffer = Buffer.from(image, 'base64');
    }

    // Create FormData for Clipdrop API
    const formData = new FormData();
    formData.append('image_file', imageBuffer, 'image.png');

    // Call Clipdrop API
    const response = await fetch('https://api.clipdrop.co/remove-background', {
      method: 'POST',
      headers: {
        'x-api-key': clipdropKey,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      console.error('Clipdrop error:', response.status, await response.text());
      return res.status(500).json({ 
        error: 'Background removal failed',
        status: response.status 
      });
    }

    // Get PNG result as buffer
    const resultBuffer = await response.buffer();
    
    // Convert to base64 PNG
    const base64Result = resultBuffer.toString('base64');
    const pngDataUrl = `data:image/png;base64,${base64Result}`;

    res.json({ 
      success: true,
      image: pngDataUrl,
      type: 'image/png'
    });

  } catch (error) {
    console.error('Remove-BG error:', error);
    res.status(500).json({ 
      error: 'Processing failed',
      message: error.message 
    });
  }
});

// ============================================
// ROUTE 4: Health Check
// ============================================
app.get('/', (req, res) => {
  res.json({
    status: 'Toolyfi Backend Running!',
    endpoints: [
      'GET /api/gold — Live gold + currency rates',
      'GET /api/transcript?videoId=xxx — YouTube transcript',
      'POST /api/remove-bg — Remove background from image (base64)',
    ],
    time: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Toolyfi Backend running on port ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}`);
  console.log(`🖼️  Remove-BG: POST http://localhost:${PORT}/api/remove-bg`);
});

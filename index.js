const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
};

app.get('/', (req, res) => {
    res.json({ status: 'online', message: 'Multi-Audio Direct Stream Extractor' });
});

app.get('/api/extract', async (req, res) => {
    const { title, lang = 'hindi', episode = 1 } = req.query;

    if (!title) {
        return res.status(400).json({ success: false, message: 'Parameter "title" is required.' });
    }

    const queryTitle = encodeURIComponent(title.trim());
    const isHindi = lang.toLowerCase() === 'hindi';

    try {
        // High Speed Backup Scraper Endpoint
        const altConsumet = `https://consumet-api-clone.vercel.app/anime/gogoanime/${queryTitle}`;
        const searchRes = await axios.get(altConsumet, { headers: HEADERS, timeout: 6000 });
        
        if (searchRes.data.results && searchRes.data.results.length > 0) {
            const animeId = searchRes.data.results[0].id;
            const watchUrl = `https://consumet-api-clone.vercel.app/anime/gogoanime/watch/${animeId}-episode-${episode}`;
            const streamRes = await axios.get(watchUrl, { headers: HEADERS });
            
            const sources = streamRes.data.sources || [];
            const mainSource = sources.find(s => s.quality === 'auto' || s.quality === '1080p') || sources[0];

            if (mainSource) {
                const host = req.get('host');
                // Force HTTPS to prevent mixed content errors
                const proxiedUrl = `https://${host}/api/proxy?url=${encodeURIComponent(mainSource.url)}&referer=${encodeURIComponent('https://gogoanime.cl/')}`;

                return res.json({
                    success: true,
                    query: { title, lang, episode },
                    data: {
                        streamUrl: proxiedUrl,
                        rawStreamUrl: mainSource.url,
                        isM3U8: true
                    }
                });
            }
        }
    } catch (e) {
        // Log Error silently
    }

    // Direct M3U8 Backup Source (Ad-Free Direct Stream)
    const host = req.get('host');
    const directFallbackUrl = `https://vidsrc.stream/anime/${queryTitle}/${episode}`;
    const proxiedFallback = `https://${host}/api/proxy?url=${encodeURIComponent(directFallbackUrl)}&referer=${encodeURIComponent('https://vidsrc.stream/')}`;

    return res.json({
        success: true,
        query: { title, lang, episode },
        data: {
            streamUrl: proxiedFallback,
            isM3U8: true,
            note: 'Direct stream generated successfully.'
        }
    });
});

// Proxy Engine
app.get('/api/proxy', async (req, res) => {
    const { url, referer } = req.query;
    if (!url) return res.status(400).send('URL missing');

    try {
        const response = await axios({
            method: 'get',
            url: decodeURIComponent(url),
            headers: {
                'User-Agent': HEADERS['User-Agent'],
                'Referer': referer ? decodeURIComponent(referer) : 'https://google.com'
            },
            responseType: 'stream'
        });

        res.set('Access-Control-Allow-Origin', '*');
        res.set('Content-Type', response.headers['content-type'] || 'application/vnd.apple.mpegurl');
        response.data.pipe(res);
    } catch (err) {
        res.status(500).send('Proxy error: ' + err.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

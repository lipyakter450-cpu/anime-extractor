const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// CORS Bypass for your own player
app.use(cors({ origin: '*' }));
app.use(express.json());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9'
};

app.get('/', (req, res) => {
    res.json({ status: 'online', message: 'Direct HLS Multi-Audio Stream & Proxy API' });
});

// 1. Stream Link Extractor Endpoint
app.get('/api/extract', async (req, res) => {
    const { title, lang = 'hindi', episode = 1 } = req.query;

    if (!title) {
        return res.status(400).json({ success: false, message: 'Parameter "title" is required.' });
    }

    try {
        const queryTitle = encodeURIComponent(title.trim());
        const isHindi = lang.toLowerCase() === 'hindi';

        // Extracting stream using Consumet Open Scraper Core
        const searchUrl = isHindi
            ? `https://api.consumet.org/anime/zoro/${queryTitle}`
            : `https://api.consumet.org/anime/gogoanime/${queryTitle}`;

        const searchRes = await axios.get(searchUrl, { headers: HEADERS });
        const results = searchRes.data.results || [];

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Media not found.' });
        }

        const selected = results[0];
        const watchUrl = isHindi
            ? `https://api.consumet.org/anime/zoro/watch?episodeId=${selected.id}$ep=${episode}`
            : `https://api.consumet.org/anime/gogoanime/watch/${selected.id}-episode-${episode}`;

        const streamRes = await axios.get(watchUrl, { headers: HEADERS });
        const sources = streamRes.data.sources || [];
        const mainSource = sources.find(s => s.quality === 'auto' || s.quality === '1080p') || sources[0];

        if (!mainSource) {
            return res.status(404).json({ success: false, message: 'Stream source unavailable.' });
        }

        // Return proxied stream URL to bypass 403 Forbidden & CORS
        const host = req.get('host');
        const protocol = req.protocol;
        const targetReferer = isHindi ? 'https://hianime.to/' : 'https://gogoanime.cl/';
        const proxiedStreamUrl = `${protocol}://${host}/api/proxy?url=${encodeURIComponent(mainSource.url)}&referer=${encodeURIComponent(targetReferer)}`;

        return res.json({
            success: true,
            query: { title, lang, episode },
            data: {
                title: selected.title,
                language: isHindi ? 'Hindi Dubbed / Multi' : 'English Sub/Dub',
                streamUrl: proxiedStreamUrl, // Direct M3U8 link via your proxy
                rawStreamUrl: mainSource.url,
                subtitles: streamRes.data.subtitles || []
            }
        });

    } catch (err) {
        return res.status(500).json({ success: false, message: 'Extraction failed.', error: err.message });
    }
});

// 2. Video Proxy Endpoint (Bypasses 403 & Domain Lock)
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

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
};

app.get('/', (req, res) => {
    res.json({ status: 'online', message: 'Hindi & English Ad-Free Direct Stream Extractor API' });
});

app.get('/api/extract', async (req, res) => {
    const { title, lang = 'hindi', episode = 1 } = req.query;

    if (!title) {
        return res.status(400).json({ success: false, message: 'Parameter "title" is required.' });
    }

    try {
        const queryTitle = encodeURIComponent(title.trim());
        const isHindi = lang.toLowerCase() === 'hindi';

        // Provider API Endpoint Selection
        let searchUrl = isHindi
            ? `https://api.consumet.org/anime/zoro/${queryTitle}`
            : `https://api.consumet.org/anime/gogoanime/${queryTitle}`;

        const searchRes = await axios.get(searchUrl, { headers: HEADERS });
        const results = searchRes.data.results || [];

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: `Anime not found for language: ${lang}` });
        }

        let selectedAnime = results[0];
        const animeId = selectedAnime.id;

        // Fetch Episode Stream Sources
        let watchUrl = isHindi
            ? `https://api.consumet.org/anime/zoro/watch?episodeId=${animeId}$ep=${episode}`
            : `https://api.consumet.org/anime/gogoanime/watch/${animeId}-episode-${episode}`;

        const streamRes = await axios.get(watchUrl, { headers: HEADERS });
        const sources = streamRes.data.sources || [];

        const directStream = sources.find(s => s.quality === 'auto' || s.quality === '1080p' || s.quality === '720p') || sources[0];

        if (!directStream) {
            return res.status(404).json({ success: false, message: 'No direct .m3u8 stream link found.' });
        }

        return res.json({
            success: true,
            query: { title, lang, episode },
            data: {
                title: selectedAnime.title,
                language: isHindi ? 'Hindi / Dubbed' : 'English / Sub',
                streamUrl: directStream.url, // Direct .m3u8 Ad-Free Link
                quality: directStream.quality,
                headers: {
                    Referer: isHindi ? 'https://hianime.to/' : 'https://gogoanime.cl/'
                },
                allSources: sources
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to extract direct stream.',
            error: err.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

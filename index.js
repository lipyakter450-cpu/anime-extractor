const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ status: 'online', message: 'Anime & Movie Stream API is running.' });
});

app.get('/api/extract', async (req, res) => {
    const { title, type = 'movie', season = 1, episode = 1 } = req.query;

    if (!title) {
        return res.status(400).json({ success: false, message: 'Parameter "title" is required.' });
    }

    try {
        const cleanTitle = encodeURIComponent(title.trim());
        let embedUrl = `https://vidsrc.to/embed/${type === 'anime' ? 'anime' : type}/${cleanTitle}`;
        
        if (type === 'tv' || type === 'series') {
            embedUrl = `https://vidsrc.to/embed/tv/${cleanTitle}/${season}/${episode}`;
        }

        return res.json({
            success: true,
            query: { title, type, season, episode },
            data: {
                source: 'VidSrc Provider',
                embedUrl: embedUrl,
                streamUrl: embedUrl,
                format: 'embed_iframe'
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

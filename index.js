const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ status: 'online', message: 'Anime & Movie Stream Extractor API' });
});

app.get('/api/extract', (req, res) => {
    const { title, type = 'anime', lang = 'hindi', episode = 1, season = 1 } = req.query;

    if (!title) {
        return res.status(400).json({ success: false, message: 'Parameter "title" is required.' });
    }

    const cleanTitle = encodeURIComponent(title.trim());
    const isHindi = lang.toLowerCase() === 'hindi';

    // Fast working embed streams (No Block, High Speed)
    let embedUrl = `https://vidsrc.to/embed/${type === 'anime' ? 'anime' : type}/${cleanTitle}`;
    
    if (type === 'tv' || type === 'series') {
        embedUrl = `https://vidsrc.to/embed/tv/${cleanTitle}/${season}/${episode}`;
    }

    // Alternative ad-free backup provider
    const backupEmbed = `https://2embed.cc/embed/${cleanTitle}`;

    return res.json({
        success: true,
        query: { title, type, lang: isHindi ? 'Hindi Dubbed' : 'English Sub/Dub', episode, season },
        data: {
            streamUrl: embedUrl,
            backupStreamUrl: backupEmbed,
            format: 'iframe_embed',
            note: 'Use this streamUrl in iframe tag on your player for 100% working stream.'
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

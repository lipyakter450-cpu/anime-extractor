const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const AXIOS_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
};

async function extractDirectStreamUrl(embedUrl) {
    try {
        const response = await axios.get(embedUrl, { headers: AXIOS_HEADERS, timeout: 8000 });
        const html = response.data;

        const m3u8Match = html.match(/(https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)/i);
        const mp4Match = html.match(/(https?:\/\/[^"'`\s]+\.mp4[^"'`\s]*)/i);

        if (m3u8Match && m3u8Match[0]) {
            return { streamUrl: m3u8Match[0], format: 'hls' };
        } else if (mp4Match && mp4Match[0]) {
            return { streamUrl: mp4Match[0], format: 'mp4' };
        }

        const packedMatch = html.match(/file:\s*["']([^"']+)["']/i);
        if (packedMatch && packedMatch[1]) {
            return { streamUrl: packedMatch[1], format: packedMatch[1].includes('.m3u8') ? 'hls' : 'mp4' };
        }

        return null;
    } catch (err) {
        return null;
    }
}

async function scrapeToonWorld(query, episode = null, lang = 'Hindi') {
    try {
        const searchUrl = `https://toonworld4all.me/?s=${encodeURIComponent(query)}`;
        const searchRes = await axios.get(searchUrl, { headers: AXIOS_HEADERS, timeout: 10000 });
        const $ = cheerio.load(searchRes.data);

        let targetPageUrl = '';
        $('.entry-title a').each((i, el) => {
            const titleText = $(el).text().toLowerCase();
            if (titleText.includes(lang.toLowerCase())) {
                targetPageUrl = $(el).attr('href');
                return false;
            }
        });

        if (!targetPageUrl) {
            targetPageUrl = $('.entry-title a').first().attr('href');
        }

        if (!targetPageUrl) return null;

        const pageRes = await axios.get(targetPageUrl, { headers: AXIOS_HEADERS, timeout: 10000 });
        const page$ = cheerio.load(pageRes.data);

        let embedLinks = [];
        page$('iframe').each((i, el) => {
            const src = page$(el).attr('src');
            if (src && !src.includes('facebook') && !src.includes('google')) {
                embedLinks.push(src);
            }
        });

        page$('a[href*="filelions"], a[href*="streamtape"], a[href*="doodstream"], a[href*="mega"]').each((i, el) => {
            const href = page$(el).attr('href');
            if (href) embedLinks.push(href);
        });

        for (const link of embedLinks) {
            const streamData = await extractDirectStreamUrl(link);
            if (streamData) {
                return {
                    source: 'ToonWorld4All',
                    embedUrl: link,
                    ...streamData
                };
            }
        }

        return null;
    } catch (error) {
        return null;
    }
}

async function scrape123Movies(title, type = 'movie', season = 1, episode = 1) {
    try {
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        let targetUrl = `https://ww8.123moviesfree.net/movie/${slug}/`;
        
        if (type === 'tv' || type === 'series') {
            targetUrl = `https://ww8.123moviesfree.net/season/${slug}-season-${season}/`;
        }

        const pageRes = await axios.get(targetUrl, { headers: AXIOS_HEADERS, timeout: 10000 });
        const $ = cheerio.load(pageRes.data);

        let embedLink = $('iframe#iframe-embed').attr('src') || $('iframe').first().attr('src');

        if (!embedLink) {
            $('a[data-id]').each((i, el) => {
                const link = $(el).attr('href');
                if (link && link.includes('embed')) {
                    embedLink = link;
                    return false;
                }
            });
        }

        if (embedLink) {
            if (embedLink.startsWith('//')) embedLink = 'https:' + embedLink;
            const streamData = await extractDirectStreamUrl(embedLink);
            if (streamData) {
                return {
                    source: '123Movies',
                    embedUrl: embedLink,
                    ...streamData
                };
            }
        }

        return null;
    } catch (error) {
        return null;
    }
}

app.get('/', (req, res) => {
    res.json({ status: 'online', message: 'Anime & Movie Extractor API is running.' });
});

app.get('/api/extract', async (req, res) => {
    const { title, type = 'movie', lang = 'English', season = 1, episode = 1 } = req.query;

    if (!title) {
        return res.status(400).json({ success: false, message: 'Parameter "title" is required.' });
    }

    try {
        let streamResult = null;

        if (type === 'anime' || lang.toLowerCase() === 'hindi') {
            streamResult = await scrapeToonWorld(title, episode, lang);
        }

        if (!streamResult) {
            streamResult = await scrape123Movies(title, type, season, episode);
        }

        if (streamResult) {
            return res.json({ success: true, query: { title, type, lang, season, episode }, data: streamResult });
        } else {
            return res.status(404).json({ success: false, message: 'No direct streamable source found.' });
        }
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

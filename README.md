# Morning Brief

Live news / weather / gaming / industry dashboard.

- `public/index.html` – the whole front end (no build step)
- `api/feed.js` – serverless function that fetches RSS feeds (edit the FEEDS list at the top)
- Weather comes straight from Open-Meteo in the browser (no API key)

## Deploy (Vercel, free)
1. Put this folder in a GitHub repo (or run `npx vercel` inside it).
2. On vercel.com: Add New > Project > import the repo > Deploy. No settings needed.
3. Open the URL it gives you. Allow location when asked.

Local test: `npx vercel dev`

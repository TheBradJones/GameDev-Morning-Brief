// GET /api/feed?section=news|gaming|industry
// Pulls RSS/Atom feeds server-side (no CORS issues), merges, sorts, caches at the edge.
const { XMLParser } = require("fast-xml-parser");

// ---- EDIT THESE to change your sources ----
const FEEDS = {
  news: [
    ["BBC News", "https://feeds.bbci.co.uk/news/rss.xml"],
    ["The Guardian", "https://www.theguardian.com/uk/rss"],
    ["NPR", "https://feeds.npr.org/1001/rss.xml"],
    ["BBC Tech", "https://feeds.bbci.co.uk/news/technology/rss.xml"],
    ["Hacker News", "https://hnrss.org/frontpage"],
  ],
  gaming: [
    ["Eurogamer", "https://www.eurogamer.net/feed"],
    ["PC Gamer", "https://www.pcgamer.com/rss/"],
    ["Rock Paper Shotgun", "https://www.rockpapershotgun.com/feed"],
    ["Polygon", "https://www.polygon.com/rss/index.xml"],
    ["Steam News", "https://store.steampowered.com/feeds/news.xml"],
  ],
  industry: [
    ["Game Developer", "https://www.gamedeveloper.com/rss.xml"],
    ["GamesIndustry.biz", "https://www.gamesindustry.biz/feed"],
    ["Game File", "https://www.gamefile.news/feed"],
    ["Naavik", "https://naavik.co/feed"],
    ["Godot", "https://godotengine.org/rss.xml"],
  ],
};
// -------------------------------------------

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const text = (x) => (x == null ? "" : typeof x === "object" ? text(x["#text"] ?? "") : String(x));
const strip = (h) => text(h).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;/g, "’").replace(/\s+/g, " ").trim();

function linkOf(i) {
  if (i.link && typeof i.link === "string") return i.link;
  const l = arr(i.link);
  const alt = l.find((x) => x && x["@_rel"] !== "self") || l[0];
  return (alt && (alt["@_href"] || text(alt))) || text(i.guid);
}

async function pull([source, url]) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "MorningBrief/1.0 (+personal dashboard)" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = parser.parse(await r.text());
    const raw = arr(j?.rss?.channel?.item).concat(arr(j?.feed?.entry), arr(j?.["rdf:RDF"]?.item));
    return raw.slice(0, 15).map((i) => {
      const d = new Date(text(i.pubDate || i.published || i.updated || i["dc:date"]));
      return {
        title: strip(i.title),
        link: linkOf(i),
        source,
        date: isNaN(d) ? null : d.toISOString(),
        summary: strip(i.description || i.summary || i["content:encoded"] || "").slice(0, 200),
      };
    }).filter((i) => i.title && /^https?:\/\//.test(i.link));
  } catch (e) {
    return { failed: source };
  } finally {
    clearTimeout(t);
  }
}

module.exports = async (req, res) => {
  const section = String(req.query.section || "news");
  const list = FEEDS[section];
  if (!list) return res.status(400).json({ error: "unknown section" });
  const results = await Promise.all(list.map(pull));
  const failed = results.filter((r) => r.failed).map((r) => r.failed);
  const seen = new Set();
  const items = results
    .filter((r) => Array.isArray(r))
    .flat()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .filter((i) => (seen.has(i.link) ? false : seen.add(i.link)))
    .slice(0, 40);
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
  res.status(200).json({ updated: new Date().toISOString(), items, failed });
};

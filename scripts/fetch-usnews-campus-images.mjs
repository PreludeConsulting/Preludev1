/**
 * Fetches US News profile hero images for schools mapped in USNEWS_SLUGS.
 * Prefer scripts/fetch-college-campus-images.mjs for campus-only aerial/landmark photos.
 * See scripts/campusImagePolicy.mjs for image requirements.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "media", "campuses");

/** Prelude campus id -> US News best-colleges profile slug */
const USNEWS_SLUGS = {
  stanford: "stanford-university-1305",
  princeton: "princeton-university-2627",
  caltech: "california-institute-of-technology-1131",
  columbia: "columbia-university-2707",
  ucla: "ucla-1320",
  uchicago: "university-of-chicago-1774",
  upenn: "university-of-pennsylvania-3378",
  cornell: "cornell-university-2711",
  duke: "duke-university-2920",
  michigan: "university-of-michigan-ann-arbor-9092",
  nyu: "nyu-2785",
  cmu: "carnegie-mellon-university-3244",
  uw: "university-of-washington-3798",
  ucsd: "university-of-california-san-diego-1317",
  "georgia-tech": "georgia-institute-of-technology-1598",
  "ut-austin": "university-of-texas-austin-3658",
  uiuc: "university-of-illinois-urbana-champaign-1775",
  mit: "massachusetts-institute-of-technology-2178",
  harvard: "harvard-university-2155",
  "uc-berkeley": "university-of-california-berkeley-1312",
  yale: "yale-university-1426",
  "johns-hopkins": "johns-hopkins-university-2077",
  northwestern: "northwestern-university-1739",
  wisconsin: "university-of-wisconsin-madison-3895",
  unc: "university-of-north-carolina-chapel-hill-2974",
  bu: "boston-university-2130",
  usc: "university-of-southern-california-1328",
  "uc-davis": "university-of-california-davis-1313",
  uci: "university-of-california-irvine-1314",
  purdue: "purdue-university-west-lafayette-1825",
  rice: "rice-university-3604",
  vanderbilt: "vanderbilt-university-3535",
  brown: "brown-university-3401",
  dartmouth: "dartmouth-college-2573",
  georgetown: "georgetown-university-1445",
  uva: "university-of-virginia-3720",
  uf: "university-of-florida-1536",
  "ohio-state": "ohio-state-university-columbus-6883",
  "penn-state": "pennsylvania-state-university-6965",
  umd: "university-of-maryland-college-park-2103",
  asu: "arizona-state-university-1081",
  msu: "michigan-state-university-2243",
  indiana: "indiana-university-bloomington-1809",
  minnesota: "university-of-minnesota-twin-cities-3969",
  tamu: "texas-a-and-m-university-college-station-10366",
  pitt: "university-of-pittsburgh-3379",
  rutgers: "rutgers-university-new-brunswick-6964",
  colorado: "university-of-colorado-boulder-1370",
  arizona: "university-of-arizona-1083"
};

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  Referer: "https://www.usnews.com/"
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, attempts = 4) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    lastError = new Error(`${res.status}`);
    await sleep(1500 * (i + 1));
  }
  throw lastError;
}

function pickHeroImageUrl(html) {
  const matches = [
    ...html.matchAll(
      /https:\/\/www\.usnews\.com\/dims4\/USNEWS\/[^"'\s]+resize\/800x540[^"'\s]*/g
    )
  ].map((m) => m[0]);

  const dimsUrl = [...new Set(matches)][0];
  if (!dimsUrl) return null;

  const cmsMatch = dimsUrl.match(/url=([^&]+)/);
  if (!cmsMatch) return dimsUrl;
  return decodeURIComponent(cmsMatch[1]);
}

async function fetchProfileHeroImage(slug) {
  const profileUrl = `https://www.usnews.com/best-colleges/${slug}`;
  const res = await fetch(profileUrl, { headers: UA });
  if (!res.ok) throw new Error(`profile ${res.status}`);
  const html = await res.text();
  const imageUrl = pickHeroImageUrl(html);
  if (!imageUrl?.startsWith("https://")) throw new Error("no image found");
  return imageUrl;
}

fs.mkdirSync(outDir, { recursive: true });

const requestedIds = process.argv.slice(2);
const entries = Object.entries(USNEWS_SLUGS).filter(
  ([id]) => !requestedIds.length || requestedIds.includes(id)
);
let ok = 0;

for (const [id, slug] of entries) {
  const dest = path.join(outDir, `${id}.jpg`);
  try {
    const imageUrl = await fetchProfileHeroImage(slug);
    await sleep(1200);
    const res = await fetchWithRetry(imageUrl, { headers: UA });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 10000) throw new Error("image too small");
    fs.writeFileSync(dest, buf);
    ok++;
    console.log("ok", id, slug);
  } catch (error) {
    console.log("fail", id, error.message);
  }
  await sleep(1500);
}

console.log("finished", ok, "/", entries.length);

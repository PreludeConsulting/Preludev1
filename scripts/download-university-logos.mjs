import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/media/universities");

const FILES = {
  stanford: ["Stanford Cardinal logo.svg"],
  harvard: ["Harvard University logo.svg"],
  mit: ["MIT logo 2003-2023.svg"],
  upenn: ["Penn Quakers logo.svg"],
  princeton: ["Princeton Tigers logo.svg"],
  yale: ["Yale Bulldogs logo.svg", "Yale University Shield 1.svg"],
  columbia: ["Columbia Lions logo.svg"],
  duke: ["Duke Blue Devils logo.svg"],
  northwestern: ["Northwestern Wildcats logo.svg"],
  "johns-hopkins": ["Johns Hopkins University logo.svg"],
  brown: ["Brown Bears logo.svg"],
  cornell: ["Cornell Big Red logo.svg", "Cornell University seal.svg"],
  dartmouth: ["Dartmouth Big Green logo.svg"],
  ucla: ["UCLA Bruins script.svg", "UCLA Bruins logo.svg"],
  "uc-berkeley": ["California Golden Bears logo.svg"],
  uchicago: ["Chicago Maroons logo.svg"],
  vanderbilt: ["Vanderbilt Commodores logo.svg"],
  rice: ["Rice Owls logo.svg"],
  "notre-dame": ["Notre Dame Fighting Irish logo.svg"],
  georgetown: ["Georgetown Hoyas logo.svg"],
  cmu: ["Carnegie Mellon University seal.svg"],
  nyu: ["NYU logo.svg"],
  usc: ["USC Trojans logo.svg"],
  michigan: ["Michigan Wolverines logo.svg"],
  unc: ["North Carolina Tar Heels logo.svg"]
};

const USER_AGENT = "PreludeLanding/1.0 (educational; university logo setup)";

async function fetchAllSources() {
  const allTitles = [...new Set(Object.values(FILES).flat())];
  const chunks = [];
  for (let i = 0; i < allTitles.length; i += 18) {
    chunks.push(allTitles.slice(i, i + 18));
  }

  const byTitle = {};
  for (const chunk of chunks) {
    const titles = chunk.map((t) => encodeURIComponent(`File:${t}`)).join("|");
    const apiUrl =
      `https://en.wikipedia.org/w/api.php?action=query&titles=${titles}` +
      "&prop=imageinfo&iiprop=url&format=json";

    const response = await fetch(apiUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) {
      throw new Error(`API ${response.status}`);
    }

    const data = await response.json();
    for (const page of Object.values(data.query?.pages ?? {})) {
      if (page.title && page.imageinfo?.[0]?.url) {
        byTitle[page.title.replace(/^File:/, "")] = page.imageinfo[0].url;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  return byTitle;
}

await mkdir(outDir, { recursive: true });
const sources = await fetchAllSources();

for (const [id, candidates] of Object.entries(FILES)) {
  const sourceUrl = candidates.map((name) => sources[name]).find(Boolean);
  if (!sourceUrl) {
    throw new Error(`No source URL for ${id} (${candidates.join(", ")})`);
  }

  const imageResponse = await fetch(sourceUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!imageResponse.ok) {
    throw new Error(`Download ${id}: ${imageResponse.status}`);
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  if (buffer.length < 120) {
    throw new Error(`File too small for ${id} (${buffer.length} bytes)`);
  }

  await writeFile(path.join(outDir, `${id}.svg`), buffer);
  console.log(`saved ${id}.svg (${buffer.length} bytes)`);
}

console.log("Done.");

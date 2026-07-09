import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildCampusSearchQueries,
  CAMPUS_IMAGE_POLICY,
  getSchoolTitleTokens,
  pickBestCampusSearchHit
} from "./campusImagePolicy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "media", "campuses");

const schools = [
  ["mit", "Massachusetts Institute of Technology"],
  ["stanford", "Stanford University"],
  ["princeton", "Princeton University"],
  ["harvard", "Harvard University"],
  ["caltech", "California Institute of Technology"],
  ["uc-berkeley", "University of California Berkeley"],
  ["yale", "Yale University"],
  ["columbia", "Columbia University"],
  ["ucla", "University of California Los Angeles"],
  ["uchicago", "University of Chicago"],
  ["upenn", "University of Pennsylvania"],
  ["johns-hopkins", "Johns Hopkins University"],
  ["cornell", "Cornell University"],
  ["duke", "Duke University"],
  ["northwestern", "Northwestern University"],
  ["michigan", "University of Michigan"],
  ["cmu", "Carnegie Mellon University"],
  ["nyu", "New York University"],
  ["uw", "University of Washington Seattle"],
  ["ucsd", "University of California San Diego"],
  ["georgia-tech", "Georgia Institute of Technology"],
  ["ut-austin", "University of Texas at Austin"],
  ["wisconsin", "University of Wisconsin Madison"],
  ["uiuc", "University of Illinois Urbana-Champaign"],
  ["unc", "University of North Carolina Chapel Hill"],
  ["bu", "Boston University"],
  ["usc", "University of Southern California"],
  ["uc-davis", "University of California Davis"],
  ["uci", "University of California Irvine"],
  ["purdue", "Purdue University"],
  ["rice", "Rice University"],
  ["vanderbilt", "Vanderbilt University"],
  ["brown", "Brown University"],
  ["dartmouth", "Dartmouth College"],
  ["georgetown", "Georgetown University"],
  ["uva", "University of Virginia"],
  ["uf", "University of Florida"],
  ["ohio-state", "Ohio State University"],
  ["penn-state", "Pennsylvania State University"],
  ["umd", "University of Maryland College Park"],
  ["asu", "Arizona State University Tempe"],
  ["msu", "Michigan State University"],
  ["indiana", "Indiana University Bloomington"],
  ["minnesota", "University of Minnesota"],
  ["tamu", "Texas A&M University"],
  ["pitt", "University of Pittsburgh"],
  ["rutgers", "Rutgers University"],
  ["colorado", "University of Colorado Boulder"],
  ["arizona", "University of Arizona"],
  ["fsu", "Florida State University"],
  ["iowa", "University of Iowa"],
  ["virginia-tech", "Virginia Tech"],
  ["nc-state", "North Carolina State University"],
  ["miami", "University of Miami"],
  ["uconn", "University of Connecticut"],
  ["oregon", "University of Oregon"],
  ["kansas", "University of Kansas"],
  ["tennessee", "University of Tennessee"],
  ["auburn", "Auburn University"],
  ["clemson", "Clemson University"],
  ["rochester", "University of Rochester"],
  ["brandeis", "Brandeis University"],
  ["wake-forest", "Wake Forest University"],
  ["case-western", "Case Western Reserve University"],
  ["tufts", "Tufts University"],
  ["boston-college", "Boston College"],
  ["tulane", "Tulane University"],
  ["rpi", "Rensselaer Polytechnic Institute"],
  ["lehigh", "Lehigh University"],
  ["pepperdine", "Pepperdine University"],
  ["syracuse", "Syracuse University"],
  ["drexel", "Drexel University"],
  ["temple", "Temple University"],
  ["gwu", "George Washington University"],
  ["american", "American University Washington"],
  ["fiu", "Florida International University"],
  ["sdsu", "San Diego State University"],
  ["utah", "University of Utah"],
  ["oregon-state", "Oregon State University"],
  ["kansas-state", "Kansas State University"],
  ["missouri", "University of Missouri"],
  ["louisville", "University of Louisville"],
  ["nebraska", "University of Nebraska Lincoln"],
  ["oklahoma", "University of Oklahoma"],
  ["georgia-state", "Georgia State University Atlanta"]
];

const UA = { "User-Agent": "PreludeCollegeDemo/1.0 (campus-image-fetch; contact@prelude.app)" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const force = process.argv.includes("--force");
const onlyIds = process.argv.filter((arg) => arg !== "--force");

async function searchCommons(query) {
  const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json&srlimit=12`;
  await sleep(2500);
  const res = await fetch(searchUrl, { headers: UA });
  const text = await res.text();
  if (!text.startsWith("{")) throw new Error(text.slice(0, 120));
  const data = JSON.parse(text);
  return data.query?.search || [];
}

async function resolveCommonsImage(title) {
  const imgUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${title}`)}&prop=imageinfo&iiprop=url&iiurlwidth=960&format=json`;
  await sleep(1500);
  const res = await fetch(imgUrl, { headers: UA });
  const text = await res.text();
  if (!text.startsWith("{")) return null;
  const data = JSON.parse(text);
  const page = Object.values(data.query?.pages || {})[0];
  const info = page?.imageinfo?.[0];
  return info?.thumburl || info?.url || null;
}

async function searchCampusImage(schoolId, schoolLabel) {
  const tokens = getSchoolTitleTokens(schoolId, schoolLabel);
  const queries = buildCampusSearchQueries(schoolLabel);
  let best = null;

  for (const query of queries) {
    const results = await searchCommons(query);
    const candidate = pickBestCampusSearchHit(results, tokens);
    if (!candidate) continue;
    if (!best || candidate.score > best.score) {
      best = { ...candidate, query };
    }
    if (candidate.score >= 8) break;
  }

  if (!best || best.score < 3) return null;

  const url = await resolveCommonsImage(best.title);
  if (!url) return null;
  return { ...best, url };
}

console.log(CAMPUS_IMAGE_POLICY.trim());
fs.mkdirSync(outDir, { recursive: true });

let ok = 0;
for (const [id, schoolLabel] of schools) {
  if (onlyIds.length && !onlyIds.includes(id)) continue;

  const dest = path.join(outDir, `${id}.jpg`);
  if (!force && fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
    console.log("skip", id);
    ok++;
    continue;
  }

  try {
    const image = await searchCampusImage(id, schoolLabel);
    if (!image) {
      console.log("missing", id);
      continue;
    }
    await sleep(1000);
    const res = await fetch(image.url, { headers: UA });
    if (!res.ok) throw new Error(`download ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 10000) throw new Error("image too small");
    fs.writeFileSync(dest, buf);
    ok++;
    console.log("ok", id, `score=${image.score}`, image.title);
  } catch (error) {
    console.log("fail", id, error.message);
  }
}

console.log("finished", ok, "/", schools.length);

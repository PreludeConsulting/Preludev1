import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "media", "campuses");

const schools = [
  ["mit", "Massachusetts Institute of Technology campus"],
  ["stanford", "Stanford University campus"],
  ["princeton", "Princeton University campus"],
  ["harvard", "Harvard University campus"],
  ["caltech", "California Institute of Technology campus"],
  ["uc-berkeley", "University of California Berkeley campus"],
  ["yale", "Yale University campus"],
  ["columbia", "Columbia University campus"],
  ["ucla", "University of California Los Angeles campus"],
  ["uchicago", "University of Chicago campus"],
  ["upenn", "University of Pennsylvania campus"],
  ["johns-hopkins", "Johns Hopkins University campus"],
  ["cornell", "Cornell University campus"],
  ["duke", "Duke University campus"],
  ["northwestern", "Northwestern University campus"],
  ["michigan", "University of Michigan campus"],
  ["cmu", "Carnegie Mellon University campus"],
  ["nyu", "New York University campus"],
  ["uw", "University of Washington Seattle campus"],
  ["ucsd", "University of California San Diego campus"],
  ["georgia-tech", "Georgia Institute of Technology campus"],
  ["ut-austin", "University of Texas at Austin campus"],
  ["wisconsin", "University of Wisconsin Madison campus"],
  ["uiuc", "University of Illinois Urbana-Champaign campus"],
  ["unc", "University of North Carolina Chapel Hill campus"],
  ["bu", "Boston University campus"],
  ["usc", "University of Southern California campus"],
  ["uc-davis", "University of California Davis campus"],
  ["uci", "University of California Irvine campus"],
  ["purdue", "Purdue University campus"],
  ["rice", "Rice University campus"],
  ["vanderbilt", "Vanderbilt University campus"],
  ["brown", "Brown University campus"],
  ["dartmouth", "Dartmouth College campus"],
  ["georgetown", "Georgetown University campus"],
  ["uva", "University of Virginia campus"],
  ["uf", "University of Florida campus"],
  ["ohio-state", "Ohio State University campus"],
  ["penn-state", "Pennsylvania State University campus"],
  ["umd", "University of Maryland College Park campus"],
  ["asu", "Arizona State University Tempe campus"],
  ["msu", "Michigan State University campus"],
  ["indiana", "Indiana University Bloomington campus"],
  ["minnesota", "University of Minnesota campus"],
  ["tamu", "Texas A&M University campus"],
  ["pitt", "University of Pittsburgh campus"],
  ["rutgers", "Rutgers University campus"],
  ["colorado", "University of Colorado Boulder campus"],
  ["arizona", "University of Arizona campus"],
  ["fsu", "Florida State University campus"],
  ["iowa", "University of Iowa campus"],
  ["virginia-tech", "Virginia Tech campus"],
  ["nc-state", "North Carolina State University campus"],
  ["miami", "University of Miami campus"],
  ["uconn", "University of Connecticut campus"],
  ["oregon", "University of Oregon campus"],
  ["kansas", "University of Kansas campus"],
  ["tennessee", "University of Tennessee campus"],
  ["auburn", "Auburn University campus"],
  ["clemson", "Clemson University campus"],
  ["rochester", "University of Rochester campus"],
  ["brandeis", "Brandeis University campus"],
  ["wake-forest", "Wake Forest University campus"],
  ["case-western", "Case Western Reserve University campus"],
  ["tufts", "Tufts University campus"],
  ["boston-college", "Boston College campus"],
  ["tulane", "Tulane University campus"],
  ["rpi", "Rensselaer Polytechnic Institute campus"],
  ["lehigh", "Lehigh University campus"],
  ["pepperdine", "Pepperdine University campus"],
  ["syracuse", "Syracuse University campus"],
  ["drexel", "Drexel University campus"],
  ["temple", "Temple University campus"],
  ["gwu", "George Washington University campus"],
  ["american", "American University Washington campus"],
  ["fiu", "Florida International University campus"],
  ["sdsu", "San Diego State University campus"],
  ["utah", "University of Utah campus"],
  ["oregon-state", "Oregon State University campus"],
  ["kansas-state", "Kansas State University campus"],
  ["missouri", "University of Missouri campus"],
  ["louisville", "University of Louisville campus"],
  ["nebraska", "University of Nebraska Lincoln campus"],
  ["oklahoma", "University of Oklahoma campus"],
  ["georgia-state", "Georgia State University Atlanta campus"]
];

const UA = { "User-Agent": "PreludeCollegeDemo/1.0 (campus-image-fetch; contact@prelude.app)" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchCampusImage(query) {
  const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json&srlimit=8`;
  await sleep(4000);
  const res = await fetch(searchUrl, { headers: UA });
  const text = await res.text();
  if (!text.startsWith("{")) throw new Error(text.slice(0, 120));
  const data = JSON.parse(text);
  const results = data.query?.search || [];
  for (const hit of results) {
    const title = hit.title.replace(/^File:/, "");
    if (/logo|seal|emblem|map\.svg|coat of arms/i.test(title)) continue;
    const imgUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${title}`)}&prop=imageinfo&iiprop=url&iiurlwidth=960&format=json`;
    await sleep(2500);
    const res2 = await fetch(imgUrl, { headers: UA });
    const text2 = await res2.text();
    if (!text2.startsWith("{")) continue;
    const data2 = JSON.parse(text2);
    const page = Object.values(data2.query?.pages || {})[0];
    const info = page?.imageinfo?.[0];
    const url = info?.thumburl || info?.url;
    if (url) return { title, url };
  }
  return null;
}

fs.mkdirSync(outDir, { recursive: true });

let ok = 0;
for (const [id, query] of schools) {
  const dest = path.join(outDir, `${id}.jpg`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
    console.log("skip", id);
    ok++;
    continue;
  }
  try {
    const image = await searchCampusImage(query);
    if (!image) {
      console.log("missing", id);
      continue;
    }
    await sleep(1000);
    const res = await fetch(image.url, { headers: UA });
    if (!res.ok) throw new Error(`download ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    ok++;
    console.log("ok", id, image.title);
  } catch (error) {
    console.log("fail", id, error.message);
  }
}

console.log("finished", ok, "/", schools.length);

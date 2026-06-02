/**
 * Search U.S. colleges via the project SQLite-backed API.
 * Falls back to a small local list when the API is unavailable.
 */

const FALLBACK_COLLEGES = [
  { id: "139755", name: "Georgia Institute of Technology", city: "Atlanta", state: "GA" },
  { id: "110662", name: "University of California, Los Angeles", city: "Los Angeles", state: "CA" },
  { id: "243744", name: "Stanford University", city: "Stanford", state: "CA" },
  { id: "166027", name: "Harvard University", city: "Cambridge", state: "MA" },
  { id: "130794", name: "Yale University", city: "New Haven", state: "CT" },
  { id: "190150", name: "Columbia University in the City of New York", city: "New York", state: "NY" },
  { id: "186131", name: "Princeton University", city: "Princeton", state: "NJ" },
  { id: "170976", name: "University of Michigan-Ann Arbor", city: "Ann Arbor", state: "MI" },
  { id: "123961", name: "University of Southern California", city: "Los Angeles", state: "CA" },
  { id: "228778", name: "University of Texas at Austin", city: "Austin", state: "TX" },
  { id: "134130", name: "University of Florida", city: "Gainesville", state: "FL" },
  { id: "110635", name: "University of California, Berkeley", city: "Berkeley", state: "CA" },
  { id: "198419", name: "Duke University", city: "Durham", state: "NC" },
  { id: "215062", name: "University of Pennsylvania", city: "Philadelphia", state: "PA" },
  { id: "131496", name: "Georgetown University", city: "Washington", state: "DC" }
];

function normalizeCollege(row) {
  return {
    id: String(row.unitid ?? row.id ?? ""),
    name: row.name ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    type: row.type ?? undefined
  };
}

function searchFallback(query, limit) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return FALLBACK_COLLEGES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q) ||
      c.state.toLowerCase().includes(q)
  )
    .slice(0, limit)
    .map(normalizeCollege);
}

export async function searchColleges(query, { limit = 20, offset = 0, signal } = {}) {
  const q = query.trim();
  if (q.length < 2) return [];

  const base = `${import.meta.env.BASE_URL}api/colleges/search`.replace(/\/+/g, "/");
  const url = `${base}?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`search failed: ${res.status}`);
    const data = await res.json();
    return (data.results ?? []).map(normalizeCollege);
  } catch {
    return searchFallback(q, limit);
  }
}

export function formatCollegeLocation(college) {
  if (college.city && college.state) return `${college.city}, ${college.state}`;
  return college.state || college.city || "";
}

export function collegeKey(college) {
  return college.id || college.name;
}

export function isCollegeSelected(selected, college) {
  const key = collegeKey(college);
  return selected.some((item) => {
    if (typeof item === "string") return item === college.name || item === key;
    return collegeKey(item) === key || item.name === college.name;
  });
}

import { DatabaseNotFoundError } from "./db/sqlite.js";
import { searchCareers } from "./datasets/careers.js";
import { compareCollegesFromQuery } from "./datasets/compareColleges.js";
import { getCollegeByUnitId, searchColleges } from "./datasets/colleges.js";
import { searchHighSchools } from "./datasets/highSchools.js";
import { searchPrograms } from "./datasets/programs.js";
import { getRequestUrl, sendJson } from "./http.js";

function mapDatasetError(error, res) {
  if (error.code === "DATABASE_NOT_FOUND") {
    sendJson(res, 503, { error: "database_not_found", message: error.message });
    return true;
  }
  if (error.code === "INVALID_LIMIT") {
    sendJson(res, 400, { error: "invalid_limit", message: error.message });
    return true;
  }
  if (error.code === "INVALID_MAX_NET_PRICE") {
    sendJson(res, 400, { error: "invalid_max_net_price", message: error.message });
    return true;
  }
  return false;
}

function handleCollegeSearch(url, res) {
  const { results, count, limit } = searchColleges({
    q: url.searchParams.get("q") ?? "",
    state: url.searchParams.get("state") ?? "",
    maxNetPrice: url.searchParams.get("maxNetPrice") ?? "",
    major: url.searchParams.get("major") ?? "",
    limit: url.searchParams.get("limit") ?? 10
  });
  sendJson(res, 200, { results, count, limit });
}

function handleCollegeCompare(url, res) {
  const comparison = compareCollegesFromQuery({
    schools: url.searchParams.get("schools") ?? "",
    major: url.searchParams.get("major") ?? ""
  });
  sendJson(res, 200, comparison);
}

function handleCollegeLookup(unitid, res) {
  const college = getCollegeByUnitId(unitid);
  if (!college) {
    sendJson(res, 404, { error: "not_found", message: "College not found." });
    return;
  }
  sendJson(res, 200, college);
}

function handleProgramSearch(url, res) {
  const { results, count, limit } = searchPrograms({
    q: url.searchParams.get("q") ?? "",
    state: url.searchParams.get("state") ?? "",
    limit: url.searchParams.get("limit") ?? 10
  });
  sendJson(res, 200, { results, count, limit });
}

function handleCareerSearch(url, res) {
  const { results, count, limit } = searchCareers({
    q: url.searchParams.get("q") ?? "",
    limit: url.searchParams.get("limit") ?? 10
  });
  sendJson(res, 200, { results, count, limit });
}

function handleHighSchoolSearch(url, res) {
  const { results, count, limit, source } = searchHighSchools({
    q: url.searchParams.get("q") ?? "",
    state: url.searchParams.get("state") ?? "",
    city: url.searchParams.get("city") ?? "",
    limit: url.searchParams.get("limit") ?? 10
  });
  sendJson(res, 200, { results, count, limit, source });
}

export function createDatasetsApiMiddleware() {
  return function datasetsApiMiddleware(req, res, next) {
    const url = getRequestUrl(req);
    const { pathname } = url;

    const isCollegeSearch = pathname === "/api/colleges/search";
    const isCollegeCompare = pathname === "/api/colleges/compare";
    const collegeMatch = pathname.match(/^\/api\/colleges\/([^/]+)$/);
    const isProgramSearch = pathname === "/api/programs/search";
    const isCareerSearch = pathname === "/api/careers/search";
    const isHighSchoolSearch = pathname === "/api/high-schools/search";

    if (!isCollegeSearch && !isCollegeCompare && !collegeMatch && !isProgramSearch && !isCareerSearch && !isHighSchoolSearch) {
      next();
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }

    try {
      if (isCollegeSearch) {
        handleCollegeSearch(url, res);
        return;
      }
      if (isCollegeCompare) {
        handleCollegeCompare(url, res);
        return;
      }
      if (isProgramSearch) {
        handleProgramSearch(url, res);
        return;
      }
      if (isCareerSearch) {
        handleCareerSearch(url, res);
        return;
      }
      if (isHighSchoolSearch) {
        handleHighSchoolSearch(url, res);
        return;
      }
      if (collegeMatch) {
        const unitid = decodeURIComponent(collegeMatch[1]);
        if (unitid === "search" || unitid === "compare") {
          sendJson(res, 404, { error: "not_found" });
          return;
        }
        handleCollegeLookup(unitid, res);
      }
    } catch (error) {
      if (error instanceof DatabaseNotFoundError || mapDatasetError(error, res)) {
        if (!(error instanceof DatabaseNotFoundError)) return;
      }
      console.error("[prelude-datasets-api]", error);
      sendJson(res, 500, { error: "server_error", message: "Dataset request failed." });
    }
  };
}

export async function handleDatasetsApiRequest(req, res) {
  return new Promise((resolve) => {
    createDatasetsApiMiddleware()(req, res, () => {
      if (!res.writableEnded) {
        sendJson(res, 404, { error: "not_found" });
      }
      resolve();
    });
  });
}

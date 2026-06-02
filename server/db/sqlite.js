import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultDbPath = path.join(
  repoRoot,
  "prelude_dataset_kit/data/db/prelude_public_data.sqlite"
);

let database = null;
let databasePath = null;

export function getDatabasePath() {
  return process.env.PRELUDE_DATA_DB_PATH?.trim() || defaultDbPath;
}

export class DatabaseNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "DatabaseNotFoundError";
    this.code = "DATABASE_NOT_FOUND";
  }
}

export function getDatabase() {
  const dbPath = getDatabasePath();
  if (database && databasePath === dbPath) {
    return database;
  }

  if (!fs.existsSync(dbPath)) {
    throw new DatabaseNotFoundError(
      "Prelude public dataset database was not found. Run prelude_dataset_kit/scripts/setup_datasets.sh to generate it."
    );
  }

  database = new DatabaseSync(dbPath, { readOnly: true });
  database.exec("PRAGMA query_only = ON;");
  databasePath = dbPath;
  return database;
}

export function closeDatabase() {
  if (database) {
    database.close();
    database = null;
    databasePath = null;
  }
}

#!/usr/bin/env node

import { databaseUrl, dockerCompose, waitForPostgres } from "./db-utils.mjs";

console.log("Starting local PostgreSQL (Docker)…");
dockerCompose("up -d");
process.env.DATABASE_URL = databaseUrl();
waitForPostgres();
console.log("PostgreSQL is ready.");
console.log(`DATABASE_URL=${databaseUrl()}`);

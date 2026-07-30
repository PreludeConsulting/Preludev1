/**
 * Review-credit ledger helpers.
 * Balance = SUM(amount). Purchases add; activity assignment subtracts 1; cancel restores +1 when eligible.
 */

import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { isDatabaseUnavailableError } from "./dbErrors.js";
import { assertDurableStoreAvailable } from "./durableStorePolicy.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sumEssayPackageRemaining } from "../../src/lib/planFeatures.js";
import {
  consumeEssayReviewCredit as consumeEssayPackageCredit,
  creditSessionPackagePurchase,
  listSessionPackagesForStudent,
  releasePackageSession
} from "./mentorAccess.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEDGER_FILE = join(__dirname, "../data/review-credit-ledger.json");

const TX = {
  PURCHASE: "PURCHASE",
  ACTIVITY_ASSIGNED: "ACTIVITY_ASSIGNED",
  ACTIVITY_CANCELLED: "ACTIVITY_CANCELLED",
  REFUND: "REFUND",
  ADMIN_ADJUSTMENT: "ADMIN_ADJUSTMENT"
};

function prismaClient() {
  if (!globalThis.__preludePrisma) globalThis.__preludePrisma = new PrismaClient();
  return globalThis.__preludePrisma;
}

function canUsePrisma() {
  return Boolean(process.env.DATABASE_URL);
}

function ensureLedgerStore() {
  const dir = dirname(LEDGER_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(LEDGER_FILE)) writeFileSync(LEDGER_FILE, JSON.stringify({ entries: [] }, null, 2));
}

function readLedgerStore() {
  ensureLedgerStore();
  return JSON.parse(readFileSync(LEDGER_FILE, "utf8"));
}

function writeLedgerStore(data) {
  ensureLedgerStore();
  writeFileSync(LEDGER_FILE, JSON.stringify(data, null, 2));
}

export function summarizeReviewCredits(entries = [], packages = []) {
  let purchased = 0;
  let assigned = 0;
  let restored = 0;
  for (const entry of entries) {
    const amount = Number(entry.amount) || 0;
    const type = String(entry.transactionType || entry.transaction_type || "");
    if (type === TX.PURCHASE || type === TX.ADMIN_ADJUSTMENT) {
      if (amount > 0) purchased += amount;
    }
    if (type === TX.ACTIVITY_ASSIGNED && amount < 0) assigned += Math.abs(amount);
    if (type === TX.ACTIVITY_CANCELLED && amount > 0) restored += amount;
    if (type === TX.REFUND && amount < 0) purchased = Math.max(0, purchased + amount);
  }
  const remainingFromLedger = entries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const remainingFromPackages = sumEssayPackageRemaining(packages);
  const remaining = Math.max(0, Math.max(remainingFromLedger, remainingFromPackages));
  return {
    purchased: Math.max(purchased, remaining + assigned - restored),
    assigned: Math.max(0, assigned - restored),
    remaining
  };
}

async function appendLedgerEntry(entry) {
  const record = {
    id: entry.id || randomUUID(),
    studentUserId: entry.studentUserId,
    amount: Number(entry.amount),
    transactionType: entry.transactionType,
    packageKey: entry.packageKey || null,
    stripeCheckoutSessionId: entry.stripeCheckoutSessionId || null,
    stripePaymentIntentId: entry.stripePaymentIntentId || null,
    activityId: entry.activityId || null,
    packagePurchaseId: entry.packagePurchaseId || null,
    idempotencyKey: entry.idempotencyKey,
    reason: entry.reason || null,
    createdByUserId: entry.createdByUserId || null,
    createdAt: entry.createdAt || new Date().toISOString()
  };

  if (canUsePrisma()) {
    try {
      // Prefer raw SQL so missing Prisma model still works against migrated DB.
      const inserted = await prismaClient().$executeRawUnsafe(
        `INSERT INTO review_credit_ledger
          (id, student_user_id, amount, transaction_type, package_key, stripe_checkout_session_id,
           stripe_payment_intent_id, activity_id, package_purchase_id, idempotency_key, reason,
           created_by_user_id, created_at)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::uuid, $9, $10, $11, $12::uuid, $13::timestamptz)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        record.id,
        record.studentUserId,
        record.amount,
        record.transactionType,
        record.packageKey,
        record.stripeCheckoutSessionId,
        record.stripePaymentIntentId,
        record.activityId,
        record.packagePurchaseId,
        record.idempotencyKey,
        record.reason,
        record.createdByUserId,
        record.createdAt
      );
      if (!inserted) {
        const existing = await prismaClient().$queryRawUnsafe(
          `SELECT package_purchase_id
           FROM review_credit_ledger
           WHERE idempotency_key = $1
           LIMIT 1`,
          record.idempotencyKey
        );
        return {
          ...record,
          packagePurchaseId: existing?.[0]?.package_purchase_id || null,
          duplicate: true
        };
      }
      return record;
    } catch (error) {
      if (!isDatabaseUnavailableError(error) && !/review_credit_ledger/i.test(String(error?.message || ""))) {
        throw error;
      }
    }
  }

  assertDurableStoreAvailable(process.env, "review credit ledger");
  const store = readLedgerStore();
  if (store.entries.some((item) => item.idempotencyKey === record.idempotencyKey)) {
    return { ...store.entries.find((item) => item.idempotencyKey === record.idempotencyKey), duplicate: true };
  }
  store.entries.push(record);
  writeLedgerStore(store);
  return record;
}

export async function listReviewCreditLedger(studentUserId) {
  if (!studentUserId) return [];
  if (canUsePrisma()) {
    try {
      const rows = await prismaClient().$queryRawUnsafe(
        `SELECT id, student_user_id, amount, transaction_type, package_key, stripe_checkout_session_id,
                stripe_payment_intent_id, activity_id, package_purchase_id, idempotency_key, reason,
                created_by_user_id, created_at
         FROM review_credit_ledger
         WHERE student_user_id = $1::uuid
         ORDER BY created_at ASC`,
        studentUserId
      );
      return (rows || []).map((row) => ({
        id: row.id,
        studentUserId: row.student_user_id,
        amount: Number(row.amount) || 0,
        transactionType: row.transaction_type,
        packageKey: row.package_key,
        stripeCheckoutSessionId: row.stripe_checkout_session_id,
        stripePaymentIntentId: row.stripe_payment_intent_id,
        activityId: row.activity_id,
        packagePurchaseId: row.package_purchase_id,
        idempotencyKey: row.idempotency_key,
        reason: row.reason,
        createdByUserId: row.created_by_user_id,
        createdAt: row.created_at
      }));
    } catch (error) {
      if (!isDatabaseUnavailableError(error) && !/review_credit_ledger/i.test(String(error?.message || ""))) {
        throw error;
      }
    }
  }
  assertDurableStoreAvailable(process.env, "review credit ledger");
  return readLedgerStore().entries.filter((entry) => entry.studentUserId === studentUserId);
}

export async function getReviewCreditBalance(studentUserId) {
  const [entries, packages] = await Promise.all([
    listReviewCreditLedger(studentUserId),
    listSessionPackagesForStudent(studentUserId)
  ]);
  const essayPackages = (packages || []).filter(
    (pkg) => String(pkg.bundleId || "").toLowerCase() === "essay_support"
  );
  return {
    ...summarizeReviewCredits(entries, essayPackages),
    packages: essayPackages,
    ledger: entries
  };
}

/** Grant credits after paid Essay Support checkout (idempotent). */
export async function grantEssaySupportPurchase({
  studentUserId,
  credits,
  packageKey,
  stripeCheckoutSessionId,
  stripePaymentIntentId = null,
  createdByUserId = null
}) {
  const qty = Math.floor(Number(credits));
  if (!studentUserId || !Number.isFinite(qty) || qty <= 0) return null;

  await creditSessionPackagePurchase({
    studentUserId,
    sessionsPurchased: qty,
    stripeCheckoutSessionId,
    bundleId: "essay_support"
  });

  return appendLedgerEntry({
    studentUserId,
    amount: qty,
    transactionType: TX.PURCHASE,
    packageKey: packageKey || `essay_support_${qty}`,
    stripeCheckoutSessionId,
    stripePaymentIntentId,
    createdByUserId,
    idempotencyKey: `purchase:${stripeCheckoutSessionId || randomUUID()}`
  });
}

export async function reserveEssayReviewCredit({
  studentUserId,
  activityId,
  createdByUserId = null,
  reason = "Mentor assigned essay review"
}) {
  const priorEntries = await listReviewCreditLedger(studentUserId);
  const priorAssignment = priorEntries.find(
    (entry) => entry.activityId === activityId && entry.transactionType === TX.ACTIVITY_ASSIGNED
  );
  if (priorAssignment) {
    return { reserved: true, packageId: priorAssignment.packagePurchaseId || null, duplicate: true };
  }

  const balance = await getReviewCreditBalance(studentUserId);
  if (balance.remaining <= 0) {
    const error = new Error("This student has no Essay Support review credits remaining.");
    error.statusCode = 409;
    error.code = "no_review_credits";
    throw error;
  }

  const packageId = await consumeEssayPackageCredit(studentUserId);
  if (!packageId) {
    const error = new Error("This student has no Essay Support review credits remaining.");
    error.statusCode = 409;
    error.code = "no_review_credits";
    throw error;
  }

  try {
    const ledgerEntry = await appendLedgerEntry({
      studentUserId,
      amount: -1,
      transactionType: TX.ACTIVITY_ASSIGNED,
      activityId,
      packagePurchaseId: packageId,
      createdByUserId,
      reason,
      idempotencyKey: `activity-assigned:${activityId}`
    });
    if (ledgerEntry.duplicate) {
      await releasePackageSession({ packageId });
      return { reserved: true, packageId: ledgerEntry.packagePurchaseId || null, duplicate: true };
    }
  } catch (error) {
    await releasePackageSession({ packageId });
    throw error;
  }

  return { reserved: true, packageId };
}

export async function restoreEssayReviewCreditOnCancel({
  studentUserId,
  activityId,
  createdByUserId = null,
  eligible = true
}) {
  if (!eligible || !studentUserId || !activityId) return null;

  const entries = await listReviewCreditLedger(studentUserId);
  const assigned = entries.find(
    (entry) =>
      entry.activityId === activityId &&
      entry.transactionType === TX.ACTIVITY_ASSIGNED
  );
  const alreadyRestored = entries.some(
    (entry) =>
      entry.activityId === activityId &&
      entry.transactionType === TX.ACTIVITY_CANCELLED
  );
  if (alreadyRestored) return null;

  if (!assigned) return null;
  const cancellation = await appendLedgerEntry({
    studentUserId,
    amount: 1,
    transactionType: TX.ACTIVITY_CANCELLED,
    activityId,
    createdByUserId,
    reason: "Activity cancelled before review started",
    idempotencyKey: `activity-cancelled:${activityId}`
  });
  if (!cancellation.duplicate && assigned.packagePurchaseId) {
    await releasePackageSession({ packageId: assigned.packagePurchaseId });
  }
  return cancellation;
}

export const REVIEW_CREDIT_TX = TX;

/** True when student is not on an active Plus/Pro subscription. */
export function isEssaySupportOnlyStudent(user = {}) {
  const plan = String(user.plan || user.planId || user.subscriptionPlan || "basic")
    .trim()
    .toLowerCase();
  if (plan !== "plus" && plan !== "pro") return true;
  const status = String(user.subscriptionStatus || user.subscription_status || "")
    .trim()
    .toLowerCase();
  return !["", "active", "trialing", "promotional", "checkout_completed"].includes(status);
}

export const ESSAY_SUPPORT_ACTIVITY_TYPES = Object.freeze([
  "personal_statement",
  "supplemental_essay"
]);

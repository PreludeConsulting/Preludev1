import { createClient } from "@supabase/supabase-js";
import { getBookingWindow } from "../../src/lib/contactSchedule.js";

const ACTIVE_STATUSES = ["requested", "confirmed"];
const memoryLocks = new Map();

function resolveRuntimeEnv(env) {
  if (env) return env;
  if (typeof process !== "undefined" && process.env) return process.env;
  return {};
}

function slotKey(selectedDate, selectedTime) {
  return `${selectedDate}|${selectedTime}`;
}

export function createDiscoveryCallAdmin(env = process.env) {
  const runtimeEnv = resolveRuntimeEnv(env);
  const url = (runtimeEnv.SUPABASE_URL || runtimeEnv.VITE_SUPABASE_URL || "").trim();
  const key = (runtimeEnv.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

function shouldUseMemoryStore(env = process.env) {
  const runtimeEnv = resolveRuntimeEnv(env);
  const mode = String(runtimeEnv.CONTACT_SLOT_STORE || "").trim().toLowerCase();
  if (mode === "memory") return true;
  if (mode === "supabase") return false;
  if (runtimeEnv.NODE_ENV === "test") return true;
  return !createDiscoveryCallAdmin(runtimeEnv);
}

function isUniqueViolation(error) {
  return error?.code === "23505" || /duplicate key|unique constraint/i.test(error?.message || "");
}

function slotUnavailableError(message = "That call time is no longer available. Please choose another time.") {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = "slot_unavailable";
  return error;
}

function lockUnavailableError() {
  const error = new Error("Discovery call booking is temporarily unavailable. Please try again in a moment.");
  error.statusCode = 503;
  error.code = "slot_lock_unavailable";
  return error;
}

function mapReservedRow(row) {
  const selectedDate = row.selected_date || row.selectedDate;
  const selectedTime = String(row.selected_time || row.selectedTime || "").slice(0, 5);
  return {
    selectedDate,
    selectedTime,
    status: row.status || "requested"
  };
}

export function resetDiscoveryCallLocksForTests() {
  memoryLocks.clear();
}

export async function listReservedDiscoveryCallSlots({ env = process.env, now = new Date() } = {}) {
  const runtimeEnv = resolveRuntimeEnv(env);
  const { startIsoDate, endIsoDate } = getBookingWindow(now);

  if (shouldUseMemoryStore(runtimeEnv)) {
    return [...memoryLocks.values()]
      .filter((row) => ACTIVE_STATUSES.includes(row.status))
      .filter((row) => row.selectedDate >= startIsoDate && row.selectedDate <= endIsoDate)
      .map(mapReservedRow);
  }

  const supabase = createDiscoveryCallAdmin(runtimeEnv);
  if (!supabase) throw lockUnavailableError();

  const { data, error } = await supabase
    .from("discovery_call_requests")
    .select("selected_date,selected_time,status")
    .in("status", ACTIVE_STATUSES)
    .gte("selected_date", startIsoDate)
    .lte("selected_date", endIsoDate);

  if (error) {
    const failure = lockUnavailableError();
    failure.cause = error;
    throw failure;
  }

  return (data || []).map(mapReservedRow);
}

export async function reserveDiscoveryCallSlot({ env = process.env, details }) {
  const runtimeEnv = resolveRuntimeEnv(env);
  const selectedDate = details.selected_date;
  const selectedTime = details.selected_time;
  const record = {
    selected_date: selectedDate,
    selected_time: selectedTime,
    customer_name: details.customer_name,
    customer_email: details.customer_email,
    student_year: details.student_year,
    topic: details.topic,
    status: "requested"
  };

  if (shouldUseMemoryStore(runtimeEnv)) {
    const key = slotKey(selectedDate, selectedTime);
    if (memoryLocks.has(key) && ACTIVE_STATUSES.includes(memoryLocks.get(key).status)) {
      throw slotUnavailableError();
    }
    const id = `memory-${key}`;
    memoryLocks.set(key, { id, ...record, selectedDate, selectedTime });
    return { id, selectedDate, selectedTime };
  }

  const supabase = createDiscoveryCallAdmin(runtimeEnv);
  if (!supabase) throw lockUnavailableError();

  const { data, error } = await supabase
    .from("discovery_call_requests")
    .insert(record)
    .select("id,selected_date,selected_time")
    .maybeSingle();

  if (error) {
    if (isUniqueViolation(error)) throw slotUnavailableError();
    const failure = lockUnavailableError();
    failure.cause = error;
    throw failure;
  }

  return {
    id: data.id,
    selectedDate: data.selected_date,
    selectedTime: String(data.selected_time).slice(0, 5)
  };
}

export async function releaseDiscoveryCallSlot({ env = process.env, reservationId, selectedDate, selectedTime }) {
  const runtimeEnv = resolveRuntimeEnv(env);

  if (shouldUseMemoryStore(runtimeEnv)) {
    const key = slotKey(selectedDate, selectedTime);
    const current = memoryLocks.get(key);
    if (current && (!reservationId || current.id === reservationId)) {
      memoryLocks.delete(key);
    }
    return;
  }

  const supabase = createDiscoveryCallAdmin(runtimeEnv);
  if (!supabase || !reservationId) return;

  await supabase
    .from("discovery_call_requests")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", reservationId)
    .eq("status", "requested");
}

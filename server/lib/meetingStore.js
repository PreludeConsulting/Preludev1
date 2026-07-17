import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { isDatabaseUnavailableError } from "./dbErrors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "../data/meetings.json");

function prismaClient() {
  if (!globalThis.__preludePrisma) globalThis.__preludePrisma = new PrismaClient();
  return globalThis.__preludePrisma;
}

function canUsePrisma() {
  return Boolean(process.env.DATABASE_URL);
}

function ensureJsonStore() {
  const dir = dirname(DATA_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, JSON.stringify({ meetings: [] }, null, 2));
  }
}

function readJsonStore() {
  ensureJsonStore();
  return JSON.parse(readFileSync(DATA_FILE, "utf8"));
}

function writeJsonStore(data) {
  ensureJsonStore();
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function toRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    studentId: row.studentId ?? null,
    mentorId: row.mentorId ?? null,
    studentUserId: row.studentUserId ?? null,
    mentorUserId: row.mentorUserId ?? null,
    meetingType: row.meetingType || "zoom",
    startTime: row.startTime instanceof Date ? row.startTime.toISOString() : row.startTime,
    endTime: row.endTime instanceof Date ? row.endTime.toISOString() : row.endTime,
    timeZone: row.timeZone || "America/New_York",
    zoomMeetingId: row.zoomMeetingId ?? null,
    zoomJoinUrl: row.zoomJoinUrl ?? null,
    zoomHostUrl: row.zoomHostUrl ?? null,
    zoomPassword: row.zoomPassword ?? null,
    status: row.status || "pending",
    notes: row.notes || "",
    isPrivate: Boolean(row.isPrivate),
    idempotencyKey: row.idempotencyKey ?? null,
    accessType: row.accessType ?? null,
    sessionPackageId: row.sessionPackageId ?? null
  };
}

function fromPayload(payload) {
  return {
    title: payload.title || "Mentor meeting",
    studentId: payload.studentId ?? null,
    mentorId: payload.mentorId ?? null,
    studentUserId: payload.studentUserId ?? null,
    mentorUserId: payload.mentorUserId ?? null,
    meetingType: payload.meetingType || "zoom",
    startTime: new Date(payload.startTime),
    endTime: new Date(payload.endTime),
    timeZone: payload.timeZone || "America/New_York",
    zoomMeetingId: payload.zoomMeetingId ?? null,
    zoomJoinUrl: payload.zoomJoinUrl ?? null,
    zoomHostUrl: payload.zoomHostUrl ?? null,
    zoomPassword: payload.zoomPassword ?? null,
    status: payload.status || "pending",
    notes: payload.notes || "",
    isPrivate: Boolean(payload.isPrivate),
    idempotencyKey: payload.idempotencyKey ?? null,
    accessType: payload.accessType ?? null,
    sessionPackageId: payload.sessionPackageId ?? null
  };
}

export async function findMeetingByIdempotencyKey(idempotencyKey) {
  if (!idempotencyKey) return null;
  if (canUsePrisma()) {
    try {
      const row = await prismaClient().meeting.findUnique({ where: { idempotencyKey } });
      return toRecord(row);
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) throw error;
    }
  }
  const { meetings } = readJsonStore();
  return toRecord(meetings.find((m) => m.idempotencyKey === idempotencyKey) || null);
}

export async function getMeetingById(id) {
  if (canUsePrisma()) {
    try {
      const row = await prismaClient().meeting.findUnique({ where: { id } });
      return toRecord(row);
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) throw error;
    }
  }
  const { meetings } = readJsonStore();
  return toRecord(meetings.find((m) => m.id === id) || null);
}

export async function listMeetingsForUser({ userId, role }) {
  const r = role?.toUpperCase();
  if (canUsePrisma()) {
    try {
      const where =
        r === "MENTOR"
          ? { mentorUserId: userId, status: { not: "canceled" } }
          : r === "STUDENT"
            ? { studentUserId: userId, isPrivate: false, status: { not: "canceled" } }
            : null;
      if (!where) return [];
      const rows = await prismaClient().meeting.findMany({ where, orderBy: { startTime: "asc" } });
      return rows.map(toRecord);
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) throw error;
    }
  }

  const { meetings } = readJsonStore();
  return meetings
    .filter((m) => {
      if (m.status === "canceled") return false;
      if (r === "MENTOR") return m.mentorUserId === userId || (!m.mentorUserId && m.mentorId);
      if (r === "STUDENT") {
        return (m.studentUserId === userId || (!m.studentUserId && m.studentId)) && !m.isPrivate;
      }
      return false;
    })
    .map(toRecord);
}

/** All non-canceled meetings for a mentor (includes pending holds for other students). */
export async function listMeetingsForMentor(mentorUserId) {
  if (!mentorUserId) return [];
  if (canUsePrisma()) {
    try {
      const rows = await prismaClient().meeting.findMany({
        where: {
          mentorUserId,
          status: { notIn: ["canceled", "declined"] }
        },
        orderBy: { startTime: "asc" }
      });
      return rows.map(toRecord);
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) throw error;
    }
  }

  const { meetings } = readJsonStore();
  return meetings
    .filter((m) => {
      if (m.mentorUserId !== mentorUserId) return false;
      const status = String(m.status || "").toLowerCase();
      return status !== "canceled" && status !== "cancelled" && status !== "declined";
    })
    .map(toRecord);
}

export async function createMeetingRecord(payload, { tx = null } = {}) {
  const data = fromPayload(payload);
  const client = tx || (canUsePrisma() ? prismaClient() : null);

  if (client) {
    try {
      const row = await client.meeting.create({ data });
      return toRecord(row);
    } catch (error) {
      if (tx || !isDatabaseUnavailableError(error)) throw error;
    }
  }

  const store = readJsonStore();
  const id = `meet-${randomBytes(6).toString("hex")}`;
  const record = toRecord({ id, ...data, startTime: data.startTime.toISOString(), endTime: data.endTime.toISOString() });
  store.meetings.push(record);
  writeJsonStore(store);
  return record;
}

export async function updateMeetingRecord(id, patch) {
  if (canUsePrisma()) {
    try {
      const row = await prismaClient().meeting.update({
        where: { id },
        data: {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          ...(patch.meetingType !== undefined ? { meetingType: patch.meetingType } : {}),
          ...(patch.startTime !== undefined ? { startTime: new Date(patch.startTime) } : {}),
          ...(patch.endTime !== undefined ? { endTime: new Date(patch.endTime) } : {}),
          ...(patch.timeZone !== undefined ? { timeZone: patch.timeZone } : {}),
          ...(patch.zoomMeetingId !== undefined ? { zoomMeetingId: patch.zoomMeetingId } : {}),
          ...(patch.zoomJoinUrl !== undefined ? { zoomJoinUrl: patch.zoomJoinUrl } : {}),
          ...(patch.zoomHostUrl !== undefined ? { zoomHostUrl: patch.zoomHostUrl } : {}),
          ...(patch.zoomPassword !== undefined ? { zoomPassword: patch.zoomPassword } : {}),
          ...(patch.isPrivate !== undefined ? { isPrivate: patch.isPrivate } : {}),
          ...(patch.accessType !== undefined ? { accessType: patch.accessType } : {}),
          ...(patch.sessionPackageId !== undefined ? { sessionPackageId: patch.sessionPackageId } : {})
        }
      });
      return toRecord(row);
    } catch (error) {
      if (error.code === "P2025") return null;
      if (!isDatabaseUnavailableError(error)) throw error;
    }
  }

  const store = readJsonStore();
  const idx = store.meetings.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  const next = { ...store.meetings[idx], ...patch };
  store.meetings[idx] = next;
  writeJsonStore(store);
  return toRecord(next);
}

export function sanitizeMeetingForRole(meeting, role) {
  if (!meeting) return null;
  const copy = { ...meeting };
  if (role?.toUpperCase() !== "MENTOR") {
    delete copy.zoomHostUrl;
    delete copy.zoomPassword;
  }
  return copy;
}

export function shouldAttachZoom(meetingType, isPrivate, explicitZoom = false) {
  if (isPrivate && !explicitZoom) return false;
  return meetingType === "zoom";
}

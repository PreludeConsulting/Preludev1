import argon2 from "argon2";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  LEGACY_RESET_TOKEN_MINUTES,
  PASSWORD_RESET_GENERIC_MESSAGE
} from "../shared/passwordResetConstants.js";
import {
  buildAuthUrl,
  deliverAuthEmail,
  deliverAccountDeletedEmail,
  deliverParentInviteEmail
} from "./lib/authEmail.js";
import { formatAuthApiError, logAuthApiError } from "./lib/dbErrors.js";
import { recommendCollegesFromQuestionnaire } from "./datasets/collegeRecommendations.js";

export function db() {
  if (!globalThis.__preludePrisma) globalThis.__preludePrisma = new PrismaClient();
  return globalThis.__preludePrisma;
}

const ACCESS_COOKIE = "prelude_access";
const REFRESH_COOKIE = "prelude_refresh";
const CSRF_COOKIE = "prelude_csrf";
const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_DAYS = 30;
const EMAIL_VERIFY_HOURS = 24;
const RESET_MINUTES = LEGACY_RESET_TOKEN_MINUTES;
const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 15;

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .regex(/[a-z]/, "Password must contain a lowercase letter.")
  .regex(/[A-Z]/, "Password must contain an uppercase letter.")
  .regex(/[0-9]/, "Password must contain a number.")
  .regex(/[^A-Za-z0-9]/, "Password must contain a symbol.");

const signupRoleSchema = z.enum(["STUDENT", "MENTOR", "PARENT"], {
  error: "Please choose Student, Mentor, or Parent."
});

const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  password: passwordSchema,
  role: signupRoleSchema,
  termsAccepted: z.literal(true),
  organizationId: z.string().uuid().optional(),
  promoCode: z.string().trim().max(64).optional()
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});
const requestResetSchema = z.object({ email: z.string().trim().email() });
const resetPasswordSchema = z.object({ token: z.string().min(32), password: passwordSchema });
const questionnaireAnswerSchema = z.object({
  index: z.number().int().min(0).max(100),
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(200)
});

const questionnaireSchema = z.object({
  answers: z.array(questionnaireAnswerSchema).min(1).max(100),
  completionPercent: z.number().int().min(0).max(100).optional()
});

const DELETE_ACCOUNT_PHRASE = "I agree to delete my account.";

const deleteAccountSchema = z
  .object({
    password: z.string().min(1, "Password is required."),
    confirmPassword: z.string().min(1, "Please confirm your password.")
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

const verifyPasswordSchema = z.object({
  password: z.string().min(1, "Password is required.")
});

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  studentProfile: z
    .object({
      graduationYear: z.number().int().min(2020).max(2100).nullable().optional(),
      highSchool: z.string().trim().max(180).nullable().optional(),
      location: z.string().trim().max(160).nullable().optional(),
      targetMajors: z.array(z.string().trim().max(120)).max(20).optional(),
      gpa: z.number().min(0).max(5).nullable().optional()
    })
    .optional(),
  mentorProfile: z
    .object({
      college: z.string().trim().max(180).nullable().optional(),
      major: z.string().trim().max(180).nullable().optional(),
      bio: z.string().trim().max(4000).nullable().optional(),
      specialties: z.array(z.string().trim().max(120)).max(30).optional()
    })
    .optional()
});

export function getJwtSecret(env = process.env) {
  const secret = env.JWT_ACCESS_SECRET || env.JWT_SECRET;
  if (secret) return secret;
  if (env.NODE_ENV === "production") {
    throw new Error("JWT_ACCESS_SECRET or JWT_SECRET is required in production.");
  }
  return "dev-only-change-me-before-production";
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function plusMs(ms) {
  return new Date(Date.now() + ms);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function getClientIp(req) {
  return (req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "").trim() || null;
}

function parseDevice(userAgent = "") {
  const browser = userAgent.includes("Chrome")
    ? "Chrome"
    : userAgent.includes("Firefox")
      ? "Firefox"
      : userAgent.includes("Safari")
        ? "Safari"
        : userAgent.includes("Edge")
          ? "Edge"
          : "Unknown browser";
  const device = /Mobile|Android|iPhone|iPad/i.test(userAgent) ? "Mobile" : "Desktop";
  return { browser, device };
}

export function publicUser(user) {
  const plan = (user.plan || "BASIC").toLowerCase();
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    role: user.role,
    plan,
    emailVerified: user.emailVerified,
    status: user.status,
    subscriptionStatus: user.subscriptionStatus || null,
    subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
    hasBillingCustomer: Boolean(user.stripeCustomerId),
    createdAt: user.createdAt
  };
}

export function sendJson(res, statusCode, payload, headers = {}) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(JSON.stringify(payload));
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function cookiesForTokens({ accessToken, refreshToken, csrfToken, clear = false }) {
  const base = { httpOnly: true, secure: isProduction(), sameSite: "strict", path: "/" };
  if (clear) {
    return [
      cookie.serialize(ACCESS_COOKIE, "", { ...base, maxAge: 0 }),
      cookie.serialize(REFRESH_COOKIE, "", { ...base, maxAge: 0 }),
      cookie.serialize(CSRF_COOKIE, "", { secure: isProduction(), sameSite: "strict", path: "/", maxAge: 0 })
    ];
  }
  return [
    cookie.serialize(ACCESS_COOKIE, accessToken, { ...base, maxAge: ACCESS_TTL_SECONDS }),
    cookie.serialize(REFRESH_COOKIE, refreshToken, { ...base, maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 }),
    cookie.serialize(CSRF_COOKIE, csrfToken, {
      secure: isProduction(),
      sameSite: "strict",
      path: "/",
      maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60
    })
  ];
}

function csrfCookie(csrfToken) {
  return cookie.serialize(CSRF_COOKIE, csrfToken, {
    secure: isProduction(),
    sameSite: "strict",
    path: "/",
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60
  });
}

export function requireCsrf(req) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const parsed = cookie.parse(req.headers.cookie || "");
  const cookieToken = parsed[CSRF_COOKIE];
  const headerToken = req.headers["x-csrf-token"];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    const error = new Error("CSRF token missing or invalid.");
    error.statusCode = 403;
    throw error;
  }
}

async function audit({ userId, action, entityType = "User", entityId, req, metadata = {} }) {
  await db().activityLog.create({
    data: {
      actorUserId: userId || null,
      action,
      entityType,
      entityId: entityId || null,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"] || null,
      metadata
    }
  });
}

async function securityEvent({ userId, eventType, severity = "INFO", req, metadata = {} }) {
  await db().securityEvent.create({
    data: {
      userId: userId || null,
      eventType,
      severity,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"] || null,
      metadata
    }
  });
}

async function rateLimitDb(req, route, limit, windowSeconds) {
  const ip = getClientIp(req) || "unknown";
  const key = `${route}:${ip}`;
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const bucket = await db().rateLimitBucket.upsert({
    where: { key_route_windowStart: { key, route, windowStart } },
    create: { key, route, windowStart, windowSeconds, requestCount: 1 },
    update: { requestCount: { increment: 1 } }
  });
  if (bucket.requestCount > limit) {
    await securityEvent({ eventType: "RATE_LIMIT_BLOCKED", severity: "MEDIUM", req, metadata: { route, key } });
    const error = new Error("Too many requests. Please try again later.");
    error.statusCode = 429;
    throw error;
  }
}

async function rateLimit(req, route, limit, windowSeconds) {
  await rateLimitDb(req, route, limit, windowSeconds);
}

async function createRoleProfile(tx, userId, role, organizationId) {
  if (role === "STUDENT") return tx.studentProfile.create({ data: { userId, organizationId: organizationId || null } });
  if (role === "MENTOR") return tx.mentorProfile.create({ data: { userId } });
  if (role === "PARENT") return null;
  if (role === "COUNSELOR" && organizationId) return tx.counselorProfile.create({ data: { userId, organizationId } });
  return null;
}

async function issueVerification(tx, userId) {
  const raw = randomToken(32);
  await tx.emailVerificationToken.create({
    data: { userId, tokenHash: sha256(raw), expiresAt: plusMs(EMAIL_VERIFY_HOURS * 60 * 60 * 1000) }
  });
  return raw;
}

function makeAccessToken(user, sessionId) {
  return jwt.sign({ sub: user.id, role: user.role, sid: sessionId, emailVerified: user.emailVerified }, getJwtSecret(), {
    expiresIn: ACCESS_TTL_SECONDS,
    audience: "prelude-web",
    issuer: "prelude-api"
  });
}

async function createSession(user, req) {
  const refreshToken = randomToken(48);
  const sessionSecret = randomToken(32);
  const { device, browser } = parseDevice(req.headers["user-agent"] || "");
  const expiresAt = plusMs(REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await db().session.create({
    data: {
      userId: user.id,
      sessionTokenHash: sha256(sessionSecret),
      expiresAt,
      device,
      browser,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"] || null,
      refreshTokens: {
        create: {
          userId: user.id,
          tokenHash: sha256(refreshToken),
          expiresAt,
          ipAddress: getClientIp(req),
          userAgent: req.headers["user-agent"] || null
        }
      }
    }
  });
  return { session, refreshToken, accessToken: makeAccessToken(user, session.id), csrfToken: randomToken(24) };
}

async function getAuth(req) {
  const parsed = cookie.parse(req.headers.cookie || "");
  const token = parsed[ACCESS_COOKIE] || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const claims = jwt.verify(token, getJwtSecret(), { audience: "prelude-web", issuer: "prelude-api" });
    const session = await db().session.findFirst({
      where: { id: claims.sid, userId: claims.sub, status: "ACTIVE", expiresAt: { gt: new Date() } },
      include: { user: true }
    });
    if (!session || session.user.status !== "ACTIVE") return null;
    await db().session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    return { user: session.user, session };
  } catch {
    return null;
  }
}

export async function requireAuth(req) {
  const auth = await getAuth(req);
  if (!auth) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }
  return auth;
}

async function canAccessStudent(user, studentProfileId) {
  if (user.role === "ADMIN") return true;
  if (user.role === "STUDENT") {
    return Boolean(await db().studentProfile.findFirst({ where: { id: studentProfileId, userId: user.id }, select: { id: true } }));
  }
  if (user.role === "MENTOR") {
    return Boolean(
      await db().mentorAssignment.findFirst({
        where: { active: true, studentProfileId, mentorProfile: { userId: user.id } },
        select: { id: true }
      })
    );
  }
  if (user.role === "COUNSELOR") {
    const counselor = await db().counselorProfile.findUnique({ where: { userId: user.id } });
    return Boolean(
      counselor &&
        (await db().studentProfile.findFirst({ where: { id: studentProfileId, organizationId: counselor.organizationId }, select: { id: true } }))
    );
  }
  return false;
}

async function handleRegister(req, res) {
  await rateLimit(req, "/api/auth/register", 10, 60 * 60);
  const payload = registerSchema.parse(await readJsonBody(req));
  const email = normalizeEmail(payload.email);
  const exists = await db().user.findUnique({ where: { email } });
  if (exists) return sendJson(res, 409, { error: "email_exists", message: "An account with this email already exists." });
  const passwordHash = await argon2.hash(payload.password, { type: argon2.argon2id });
  const result = await db().$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email,
        passwordHash,
        role: payload.role,
        termsAcceptedAt: new Date(),
        emailVerified: false,
        emailVerifiedAt: null
      }
    });
    await createRoleProfile(tx, user.id, user.role, payload.organizationId);
    const verificationToken = await issueVerification(tx, user.id);
    await tx.activityLog.create({ data: { actorUserId: user.id, action: "REGISTER", entityType: "User", entityId: user.id } });
    return { user, verificationToken };
  });

  let promoRedemption = null;
  if (payload.promoCode && payload.role === "STUDENT") {
    const { redeemPromoCode } = await import("./lib/promoCodes.js");
    const { deliverPromoWelcomeEmail } = await import("./lib/promoEmail.js");
    promoRedemption = await redeemPromoCode({
      code: payload.promoCode,
      email,
      userId: result.user.id,
      backend: "prisma"
    });
    if (promoRedemption.success) {
      await deliverPromoWelcomeEmail({
        to: email,
        publicCode: promoRedemption.publicCode,
        campaignName: promoRedemption.campaignName,
        planId: promoRedemption.planId,
        permanentAccess: promoRedemption.summary?.permanentAccess,
        promotionEndsAt: promoRedemption.promotionEndsAt,
        req
      });
      result.user = await db().user.findUnique({ where: { id: result.user.id } });
    }
  }

  const verifyUrl = buildAuthUrl(req, `/verify-email?token=${result.verificationToken}`);
  await deliverAuthEmail({ kind: "verify-email", to: email, url: verifyUrl, req });

  const tokens = await createSession(result.user, req);
  await audit({ userId: result.user.id, action: "LOGIN", req, entityId: result.user.id });
  sendJson(
    res,
    201,
    {
      user: publicUser(result.user),
      csrfToken: tokens.csrfToken,
      verificationEmailSent: true,
      promoRedemption: promoRedemption?.success ? promoRedemption : null,
      message:
        "Account created. We sent a verification link to your email — you can use Prelude now and verify when convenient."
    },
    { "Set-Cookie": cookiesForTokens(tokens) }
  );
}

async function handleVerifyEmail(req, res, url) {
  const token = url.searchParams.get("token") || "";
  if (!token) {
    return sendJson(res, 400, { error: "invalid_token", message: "Verification link is invalid or expired." });
  }
  const tokenHash = sha256(token);
  const record = await db().emailVerificationToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!record) {
    return sendJson(res, 400, { error: "invalid_token", message: "Verification link is invalid or expired." });
  }
  if (record.user.emailVerified) {
    return sendJson(res, 200, {
      message: "Your email is already verified. You can log in anytime.",
      emailVerified: true,
      alreadyVerified: true
    });
  }
  if (record.status !== "ACTIVE" || record.expiresAt <= new Date()) {
    return sendJson(res, 400, { error: "invalid_token", message: "Verification link is invalid or expired." });
  }
  await db().$transaction([
    db().emailVerificationToken.update({ where: { id: record.id }, data: { status: "USED", usedAt: new Date() } }),
    db().user.update({ where: { id: record.userId }, data: { emailVerified: true, emailVerifiedAt: new Date() } }),
    db().securityEvent.create({ data: { userId: record.userId, eventType: "EMAIL_VERIFIED", severity: "INFO" } })
  ]);
  sendJson(res, 200, { message: "Email verified. You're all set.", emailVerified: true });
}

async function handleResendVerification(req, res) {
  await rateLimit(req, "/api/auth/resend-verification", 5, 60 * 60);
  const auth = await requireAuth(req);
  if (auth.user.emailVerified) {
    return sendJson(res, 400, { error: "already_verified", message: "Your email is already verified." });
  }

  const verificationToken = await db().$transaction(async (tx) => {
    await tx.emailVerificationToken.updateMany({
      where: { userId: auth.user.id, status: "ACTIVE" },
      data: { status: "REVOKED" }
    });
    return issueVerification(tx, auth.user.id);
  });

  const verifyUrl = buildAuthUrl(req, `/verify-email?token=${verificationToken}`);
  const delivery = await deliverAuthEmail({ kind: "verify-email", to: auth.user.email, url: verifyUrl, req });
  await audit({ userId: auth.user.id, action: "VERIFICATION_EMAIL_RESENT", req, entityId: auth.user.id });

  sendJson(res, 200, {
    message: delivery.delivered
      ? "Verification email sent. Check your inbox."
      : "If email delivery is configured, a new verification link has been sent.",
    emailSent: Boolean(delivery.delivered)
  });
}

async function handleLogin(req, res) {
  await rateLimit(req, "/api/auth/login", 10, 15 * 60);
  const payload = loginSchema.parse(await readJsonBody(req));
  const email = normalizeEmail(payload.email);

  const user = await db().user.findUnique({ where: { email } });
  const fail = async (reason, userId = null) => {
    await db().loginHistory.create({
      data: { userId, emailAttempted: email, success: false, failureReason: reason, ipAddress: getClientIp(req), userAgent: req.headers["user-agent"] || null, ...parseDevice(req.headers["user-agent"] || "") }
    });
    await securityEvent({ userId, eventType: "LOGIN_FAILED", severity: "LOW", req, metadata: { reason } });
    sendJson(res, 401, { error: "invalid_credentials", message: "Invalid email or password." });
  };
  if (!user) return fail("NO_USER");
  if (user.lockedUntil && user.lockedUntil > new Date()) return sendJson(res, 423, { error: "account_locked", message: "Account is temporarily locked." });
  if (user.status !== "ACTIVE") return sendJson(res, 403, { error: "account_unavailable", message: "Account is not active." });
  const valid = await argon2.verify(user.passwordHash, payload.password);
  if (!valid) {
    const failedLoginCount = user.failedLoginCount + 1;
    await db().user.update({
      where: { id: user.id },
      data: { failedLoginCount, lockedUntil: failedLoginCount >= LOCK_THRESHOLD ? plusMs(LOCK_MINUTES * 60 * 1000) : null }
    });
    return fail(failedLoginCount >= LOCK_THRESHOLD ? "LOCKED" : "BAD_PASSWORD", user.id);
  }
  const tokens = await createSession(user, req);
  await db().user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await db().loginHistory.create({ data: { userId: user.id, emailAttempted: email, success: true, ipAddress: getClientIp(req), userAgent: req.headers["user-agent"] || null, ...parseDevice(req.headers["user-agent"] || "") } });
  await audit({ userId: user.id, action: "LOGIN", req, entityId: user.id });
  sendJson(res, 200, { user: publicUser(user), csrfToken: tokens.csrfToken }, { "Set-Cookie": cookiesForTokens(tokens) });
}

async function handleRefresh(req, res) {
  const parsed = cookie.parse(req.headers.cookie || "");
  const refreshToken = parsed[REFRESH_COOKIE];
  if (!refreshToken) return sendJson(res, 401, { error: "unauthenticated" });
  const tokenHash = sha256(refreshToken);
  const current = await db().refreshToken.findUnique({ where: { tokenHash }, include: { user: true, session: true } });
  if (!current || current.status !== "ACTIVE" || current.expiresAt <= new Date() || current.session.status !== "ACTIVE") {
    await securityEvent({ userId: current?.userId, eventType: "REFRESH_REJECTED", severity: "HIGH", req });
    return sendJson(res, 401, { error: "unauthenticated" }, { "Set-Cookie": cookiesForTokens({ clear: true }) });
  }
  const nextRefresh = randomToken(48);
  const next = await db().refreshToken.create({
    data: { userId: current.userId, sessionId: current.sessionId, tokenHash: sha256(nextRefresh), expiresAt: current.expiresAt, ipAddress: getClientIp(req), userAgent: req.headers["user-agent"] || null }
  });
  await db().refreshToken.update({ where: { id: current.id }, data: { status: "USED", revokedAt: new Date(), replacedByTokenId: next.id } });
  const accessToken = makeAccessToken(current.user, current.sessionId);
  const csrfToken = randomToken(24);
  sendJson(res, 200, { user: publicUser(current.user), csrfToken }, { "Set-Cookie": cookiesForTokens({ accessToken, refreshToken: nextRefresh, csrfToken }) });
}

async function handleLogout(req, res) {
  const parsed = cookie.parse(req.headers.cookie || "");
  const refreshToken = parsed[REFRESH_COOKIE];
  if (refreshToken) {
    const record = await db().refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (record) {
      await db().refreshToken.update({ where: { id: record.id }, data: { status: "REVOKED", revokedAt: new Date() } });
      await db().session.update({ where: { id: record.sessionId }, data: { status: "REVOKED", revokedAt: new Date() } });
    }
  }
  sendJson(res, 200, { message: "Logged out." }, { "Set-Cookie": cookiesForTokens({ clear: true }) });
}

async function handleRequestReset(req, res) {
  await rateLimit(req, "/api/auth/request-reset", 5, 60 * 60);
  const payload = requestResetSchema.parse(await readJsonBody(req));
  const user = await db().user.findUnique({ where: { email: normalizeEmail(payload.email) } });
  if (user) {
    const token = randomToken(32);
    await db().$transaction([
      db().passwordResetToken.updateMany({
        where: { userId: user.id, status: "ACTIVE" },
        data: { status: "USED", usedAt: new Date() }
      }),
      db().passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: plusMs(RESET_MINUTES * 60 * 1000),
          requestIp: getClientIp(req),
          userAgent: req.headers["user-agent"] || null
        }
      })
    ]);
    await securityEvent({ userId: user.id, eventType: "PASSWORD_RESET_REQUESTED", severity: "INFO", req });
    const resetUrl = buildAuthUrl(req, `/reset-password?token=${token}`);
    await deliverAuthEmail({ kind: "password-reset", to: user.email, url: resetUrl, req });
  }
  sendJson(res, 200, { message: PASSWORD_RESET_GENERIC_MESSAGE });
}

async function handleResetPassword(req, res) {
  await rateLimit(req, "/api/auth/reset-password", 10, 60 * 60);
  const payload = resetPasswordSchema.parse(await readJsonBody(req));
  const record = await db().passwordResetToken.findUnique({ where: { tokenHash: sha256(payload.token) }, include: { user: true } });
  if (!record || record.status !== "ACTIVE" || record.expiresAt <= new Date()) {
    return sendJson(res, 400, { error: "invalid_token", message: "Reset link is invalid or expired." });
  }
  const samePassword = await argon2.verify(record.user.passwordHash, payload.password);
  if (samePassword) {
    return sendJson(res, 400, {
      error: "same_password",
      message: "New password cannot be the same as your current password."
    });
  }
  const passwordHash = await argon2.hash(payload.password, { type: argon2.argon2id });
  await db().$transaction([
    db().user.update({ where: { id: record.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } }),
    db().passwordResetToken.update({ where: { id: record.id }, data: { status: "USED", usedAt: new Date() } }),
    db().session.updateMany({ where: { userId: record.userId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } }),
    db().refreshToken.updateMany({ where: { userId: record.userId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } }),
    db().securityEvent.create({ data: { userId: record.userId, eventType: "PASSWORD_RESET_COMPLETED", severity: "MEDIUM", ipAddress: getClientIp(req), userAgent: req.headers["user-agent"] || null } })
  ]);
  sendJson(res, 200, { message: "Password reset. Please log in again." }, { "Set-Cookie": cookiesForTokens({ clear: true }) });
}

async function handleMe(req, res) {
  const auth = await requireAuth(req);
  const csrfToken = randomToken(24);
  sendJson(res, 200, { user: publicUser(auth.user), csrfToken }, { "Set-Cookie": csrfCookie(csrfToken) });
}

async function handleProfile(req, res) {
  const auth = await requireAuth(req);
  if (req.method === "GET") {
    const user = await db().user.findUnique({
      where: { id: auth.user.id },
      include: { studentProfile: true, mentorProfile: true, counselorProfile: { include: { organization: true } } }
    });
    return sendJson(res, 200, { user: publicUser(user), profile: { student: user.studentProfile, mentor: user.mentorProfile, counselor: user.counselorProfile } });
  }
  const payload = profileSchema.parse(await readJsonBody(req));
  const user = await db().$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: auth.user.id }, data: { firstName: payload.firstName, lastName: payload.lastName } });
    if (payload.studentProfile && auth.user.role === "STUDENT") await tx.studentProfile.update({ where: { userId: auth.user.id }, data: payload.studentProfile });
    if (payload.mentorProfile && auth.user.role === "MENTOR") await tx.mentorProfile.update({ where: { userId: auth.user.id }, data: payload.mentorProfile });
    await tx.activityLog.create({ data: { actorUserId: auth.user.id, action: "PROFILE_UPDATED", entityType: "User", entityId: auth.user.id } });
    return updated;
  });
  sendJson(res, 200, { user: publicUser(user) });
}


async function handlePreludeMatchQuestionnaire(req, res) {
  const auth = await requireAuth(req);

  if (req.method === "GET") {
    const questionnaire = await db().preludeMatchQuestionnaire.findUnique({ where: { userId: auth.user.id } });
    return sendJson(res, 200, { questionnaire });
  }

  const payload = questionnaireSchema.parse(await readJsonBody(req));
  const uniqueAnswers = new Set(payload.answers.map((answer) => answer.index));
  const completionPercent = payload.completionPercent ?? Math.round((uniqueAnswers.size / payload.answers.length) * 100);
  const studentProfile = await db().studentProfile.findUnique({ where: { userId: auth.user.id }, select: { id: true } });

  const questionnaire = await db().$transaction(async (tx) => {
    const saved = await tx.preludeMatchQuestionnaire.upsert({
      where: { userId: auth.user.id },
      create: {
        userId: auth.user.id,
        studentProfileId: studentProfile?.id || null,
        answers: payload.answers,
        completionPercent,
        submittedAt: new Date()
      },
      update: {
        studentProfileId: studentProfile?.id || null,
        answers: payload.answers,
        completionPercent,
        submittedAt: new Date()
      }
    });
    await tx.activityLog.create({
      data: {
        actorUserId: auth.user.id,
        action: "PRELUDE_MATCH_QUESTIONNAIRE_SUBMITTED",
        entityType: "PreludeMatchQuestionnaire",
        entityId: saved.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || null,
        metadata: { answerCount: payload.answers.length, completionPercent }
      }
    });
    return saved;
  });

  sendJson(res, 200, { questionnaire });
}

async function handleCollegeRecommendations(req, res) {
  const auth = await requireAuth(req);
  if (!["STUDENT", "ADMIN"].includes(auth.user.role)) {
    return sendJson(res, 403, { error: "forbidden", message: "Only student accounts can request college recommendations." });
  }

  const [profile, questionnaire] = await Promise.all([
    db().studentProfile.findUnique({ where: { userId: auth.user.id } }),
    db().preludeMatchQuestionnaire.findUnique({ where: { userId: auth.user.id } })
  ]);
  const recommendations = recommendCollegesFromQuestionnaire({ profile, questionnaire, limit: 8 });
  sendJson(res, 200, {
    ...recommendations,
    generatedAt: new Date().toISOString()
  });
}

async function handleDashboard(req, res) {
  const auth = await requireAuth(req);
  const user = auth.user;
  if (user.role === "STUDENT") {
    const student = await db().studentProfile.findUnique({
      where: { userId: user.id },
      include: { collegeApplications: { orderBy: { createdAt: "desc" } }, essays: { orderBy: { updatedAt: "desc" } }, mentorAssignments: { where: { active: true }, include: { mentorProfile: { include: { user: true } } } } }
    });
    return sendJson(res, 200, { role: user.role, student });
  }
  if (user.role === "MENTOR") {
    const mentor = await db().mentorProfile.findUnique({ where: { userId: user.id }, include: { mentorAssignments: { where: { active: true }, include: { studentProfile: { include: { user: true } } } } } });
    return sendJson(res, 200, { role: user.role, mentor });
  }
  if (user.role === "PARENT") {
    return sendJson(res, 200, { role: user.role, parent: { userId: user.id, firstName: user.firstName, lastName: user.lastName } });
  }
  if (user.role === "COUNSELOR") {
    const counselor = await db().counselorProfile.findUnique({ where: { userId: user.id }, include: { organization: { include: { studentProfiles: { include: { user: true } } } } } });
    return sendJson(res, 200, { role: user.role, counselor });
  }
  const [users, applications, essays, sessions] = await Promise.all([
    db().user.count(),
    db().collegeApplication.count(),
    db().essay.count(),
    db().session.count({ where: { status: "ACTIVE" } })
  ]);
  sendJson(res, 200, { role: user.role, metrics: { users, applications, essays, activeSessions: sessions } });
}

async function handleSessions(req, res, url) {
  const auth = await requireAuth(req);
  if (req.method === "GET") {
    const sessions = await db().session.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, device: true, browser: true, ipAddress: true, createdAt: true, lastSeenAt: true, expiresAt: true } });
    return sendJson(res, 200, { sessions });
  }
  const sessionId = url.pathname.split("/").pop();
  const session = await db().session.findFirst({ where: { id: sessionId, userId: auth.user.id } });
  if (!session) return sendJson(res, 404, { error: "not_found" });
  await db().session.update({ where: { id: session.id }, data: { status: "REVOKED", revokedAt: new Date() } });
  await db().refreshToken.updateMany({ where: { sessionId: session.id, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } });
  sendJson(res, 200, { message: "Session revoked." });
}

async function handleVerifyPassword(req, res) {
  await rateLimit(req, "/api/account/verify-password", 10, 15 * 60);
  const auth = await requireAuth(req);
  const payload = verifyPasswordSchema.parse(await readJsonBody(req));

  if (!auth.user.passwordHash) {
    return sendJson(res, 400, {
      error: "password_not_set",
      message: "This account does not have a password. Reset your password first, then try again."
    });
  }

  const valid = await argon2.verify(auth.user.passwordHash, payload.password);
  if (!valid) {
    await securityEvent({
      userId: auth.user.id,
      eventType: "PASSWORD_VERIFY_FAILED",
      severity: "MEDIUM",
      req,
      metadata: { context: "account_delete" }
    });
    return sendJson(res, 401, { error: "invalid_password", message: "Password is incorrect." });
  }

  sendJson(res, 200, { valid: true });
}

async function handleDeleteAccount(req, res) {
  await rateLimit(req, "/api/account/delete", 3, 60 * 60);
  const auth = await requireAuth(req);
  const payload = deleteAccountSchema.parse(await readJsonBody(req));

  if (!auth.user.passwordHash) {
    return sendJson(res, 400, {
      error: "password_not_set",
      message: "This account does not have a password. Reset your password first, then try again."
    });
  }

  const valid = await argon2.verify(auth.user.passwordHash, payload.password);
  if (!valid) {
    await securityEvent({
      userId: auth.user.id,
      eventType: "ACCOUNT_DELETE_FAILED",
      severity: "MEDIUM",
      req,
      metadata: { reason: "BAD_PASSWORD" }
    });
    return sendJson(res, 401, { error: "invalid_password", message: "Password is incorrect." });
  }

  const { email, firstName, id: userId } = auth.user;

  await db().$transaction(async (tx) => {
    await tx.refreshToken.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() }
    });
    await tx.session.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() }
    });
    await tx.user.delete({ where: { id: userId } });
  });

  await deliverAccountDeletedEmail({ to: email, firstName, req });
  await securityEvent({
    eventType: "ACCOUNT_DELETED",
    severity: "HIGH",
    req,
    metadata: { deletedEmail: email }
  });

  sendJson(
    res,
    200,
    { message: "Your account has been permanently deleted.", emailSent: true },
    { "Set-Cookie": cookiesForTokens({ clear: true }) }
  );
}

const deletedNotifySchema = z.object({
  email: z.string().trim().email(),
  firstName: z.string().trim().min(1).max(80).optional()
});

async function handleDeletedNotify(req, res) {
  await rateLimit(req, "/api/account/deleted-notify", 5, 60 * 60);
  const payload = deletedNotifySchema.parse(await readJsonBody(req));
  await deliverAccountDeletedEmail({
    to: normalizeEmail(payload.email),
    firstName: payload.firstName || "there",
    req
  });
  sendJson(res, 200, { message: "Deletion confirmation sent." });
}

const parentInviteSendSchema = z.object({
  parentEmail: z.string().trim().email(),
  studentName: z.string().trim().min(1).max(120),
  inviteToken: z.string().trim().min(8).max(200)
});

async function handleParentInviteSend(req, res) {
  await rateLimit(req, "/api/parent-invites/send", 10, 60 * 60);
  await requireAuth(req);
  const payload = parentInviteSendSchema.parse(await readJsonBody(req));
  const url = buildAuthUrl(
    req,
    `/register?${new URLSearchParams({ parentInvite: payload.inviteToken, role: "parent" }).toString()}`
  );
  const result = await deliverParentInviteEmail({
    to: normalizeEmail(payload.parentEmail),
    studentName: payload.studentName,
    url,
    req
  });
  sendJson(res, 200, {
    message: "Invitation email sent.",
    emailSent: Boolean(result.delivered || result.logged)
  });
}

async function handleStudentRead(req, res, url) {
  const auth = await requireAuth(req);
  const studentProfileId = url.pathname.split("/").pop();
  if (!(await canAccessStudent(auth.user, studentProfileId))) return sendJson(res, 403, { error: "forbidden", message: "You are not allowed to access that student." });
  const student = await db().studentProfile.findUnique({ where: { id: studentProfileId }, include: { user: true, collegeApplications: true, essays: true, mentorAssignments: true } });
  sendJson(res, 200, { student });
}

export function createAuthApiMiddleware() {
  return async function authApiMiddleware(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    if (
      !url.pathname.startsWith("/api/auth") &&
      !url.pathname.startsWith("/api/account") &&
      !url.pathname.startsWith("/api/dashboard") &&
      !url.pathname.startsWith("/api/students") &&
      !url.pathname.startsWith("/api/parent-invites") &&
      url.pathname !== "/api/prelude-match-questionnaire" &&
      url.pathname !== "/api/college-recommendations"
    ) {
      return next();
    }

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token");
      res.end();
      return;
    }

    try {
      if (!["/api/auth/login", "/api/auth/register", "/api/auth/request-reset", "/api/auth/reset-password", "/api/account/deleted-notify"].includes(url.pathname)) requireCsrf(req);
      if (url.pathname === "/api/auth/register" && req.method === "POST") return await handleRegister(req, res);
      if (url.pathname === "/api/auth/verify-email" && req.method === "GET") return await handleVerifyEmail(req, res, url);
      if (url.pathname === "/api/auth/resend-verification" && req.method === "POST") return await handleResendVerification(req, res);
      if (url.pathname === "/api/auth/google/start" && req.method === "POST") {
        return sendJson(res, 200, {
          message:
            "Google OAuth is not configured yet. Use email and password sign-in, or set GOOGLE_CLIENT_ID in the server environment."
        });
      }
      if (url.pathname === "/api/auth/login" && req.method === "POST") return await handleLogin(req, res);
      if (url.pathname === "/api/auth/refresh" && req.method === "POST") return await handleRefresh(req, res);
      if (url.pathname === "/api/auth/logout" && req.method === "POST") return await handleLogout(req, res);
      if (url.pathname === "/api/auth/request-reset" && req.method === "POST") return await handleRequestReset(req, res);
      if (url.pathname === "/api/auth/reset-password" && req.method === "POST") return await handleResetPassword(req, res);
      if (url.pathname === "/api/auth/me" && req.method === "GET") return await handleMe(req, res);
      if (url.pathname === "/api/account/profile" && ["GET", "PATCH"].includes(req.method)) return await handleProfile(req, res);
      if (url.pathname === "/api/account/verify-password" && req.method === "POST") return await handleVerifyPassword(req, res);
      if (url.pathname === "/api/account/delete" && req.method === "POST") return await handleDeleteAccount(req, res);
      if (url.pathname === "/api/account/deleted-notify" && req.method === "POST") return await handleDeletedNotify(req, res);
      if (url.pathname === "/api/prelude-match-questionnaire" && ["GET", "POST"].includes(req.method)) return await handlePreludeMatchQuestionnaire(req, res);
      if (url.pathname === "/api/college-recommendations" && req.method === "GET") return await handleCollegeRecommendations(req, res);
      if (url.pathname === "/api/account/sessions" && req.method === "GET") return await handleSessions(req, res, url);
      if (url.pathname.startsWith("/api/account/sessions/") && req.method === "DELETE") return await handleSessions(req, res, url);
      if (url.pathname === "/api/dashboard" && req.method === "GET") return await handleDashboard(req, res);
      if (url.pathname === "/api/parent-invites/send" && req.method === "POST") return await handleParentInviteSend(req, res);
      if (url.pathname.startsWith("/api/students/") && req.method === "GET") return await handleStudentRead(req, res, url);
      sendJson(res, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof z.ZodError) return sendJson(res, 400, { error: "validation_error", issues: error.issues });
      const formatted = formatAuthApiError(error);
      logAuthApiError(error, formatted);
      sendJson(res, formatted.statusCode, {
        error: formatted.error,
        message: formatted.message
      });
    }
  };
}

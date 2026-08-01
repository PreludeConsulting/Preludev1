export function hasAuthenticatedRequest(req) {
  const authorization = String(req?.headers?.authorization || "").trim();
  const cookie = String(req?.headers?.cookie || "").trim();
  return Boolean(authorization || /\bprelude_(access|refresh)=/.test(cookie));
}

export function ownershipError(message = "You do not have access to this data.") {
  const error = new Error(message);
  error.statusCode = 403;
  error.code = "forbidden";
  return error;
}

function normalizeRows(rows) {
  if (!rows) return [];
  return Array.isArray(rows) ? rows : [rows];
}

export function rowBelongsToUser(row, userId, ownerFields) {
  if (!row || !userId) return false;
  return ownerFields.some((field) => row[field] && row[field] === userId);
}

export function assertRowsBelongToUser(rows, userId, ownerFields, label) {
  for (const row of normalizeRows(rows)) {
    if (!rowBelongsToUser(row, userId, ownerFields)) {
      throw ownershipError(`${label} does not belong to this account.`);
    }
  }
}

export function assertDashboardAppDataOwnership({
  userId,
  profile,
  settings,
  availability,
  wallet
}) {
  if (profile) assertRowsBelongToUser(profile, userId, ["id"], "Profile data");
  if (settings) assertRowsBelongToUser(settings, userId, ["user_id"], "Settings data");
  if (availability) assertRowsBelongToUser(availability, userId, ["mentor_user_id"], "Availability data");
  if (wallet) assertRowsBelongToUser(wallet, userId, ["user_id"], "Reward wallet data");
  // events/messages/notifications/tasks stay RLS-scoped; mentors/parents may see
  // linked-student rows and must not brick dashboard boot.
}

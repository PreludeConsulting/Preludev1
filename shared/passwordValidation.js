export function normalizePassword(value) {
  return String(value || "");
}

function hasNumberOrSymbol(password) {
  return /[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password);
}

export function getPasswordRequirements(supabaseAuth, mode = "signup") {
  if (supabaseAuth) {
    if (mode === "reset") {
      return [
        { id: "length", label: "At least 8 characters", test: (password) => password.length >= 8 },
        { id: "lower", label: "One lowercase letter", test: (password) => /[a-z]/.test(password) },
        { id: "upper", label: "One uppercase letter", test: (password) => /[A-Z]/.test(password) },
        {
          id: "numberOrSymbol",
          label: "One number or special character",
          test: hasNumberOrSymbol
        }
      ];
    }
    return [{ id: "length", label: "At least 6 characters", test: (password) => password.length >= 6 }];
  }

  return [
    { id: "length", label: "12+ characters", test: (password) => password.length >= 12 },
    { id: "lower", label: "Lowercase letter", test: (password) => /[a-z]/.test(password) },
    { id: "upper", label: "Uppercase letter", test: (password) => /[A-Z]/.test(password) },
    { id: "number", label: "Number", test: (password) => /[0-9]/.test(password) },
    { id: "symbol", label: "Symbol", test: (password) => /[^A-Za-z0-9]/.test(password) }
  ];
}

export function getPasswordRequirementStatus(password, supabaseAuth, mode = "signup") {
  return getPasswordRequirements(supabaseAuth, mode).map((rule) => ({
    ...rule,
    met: rule.test(password)
  }));
}

export function validatePasswordForAuth(password, supabaseAuth, mode = "signup") {
  const requirements = getPasswordRequirementStatus(password, supabaseAuth, mode);
  const unmet = requirements.find((rule) => !rule.met);
  if (unmet) return `Password must meet all requirements (${unmet.label.toLowerCase()}).`;
  return "";
}

export function passwordsMatch(password, confirmPassword) {
  return normalizePassword(password) === normalizePassword(confirmPassword);
}

export function getPasswordStrength(password, supabaseAuth, mode = "signup") {
  const requirements = getPasswordRequirementStatus(password, supabaseAuth, mode);
  const metCount = requirements.filter((rule) => rule.met).length;
  const total = requirements.length;
  if (!password) return { label: "Enter a password", level: 0, metCount, total };
  if (metCount <= 1) return { label: "Weak", level: 1, metCount, total };
  if (metCount < total - 1) return { label: "Fair", level: 2, metCount, total };
  if (metCount < total) return { label: "Good", level: 3, metCount, total };
  return { label: "Strong", level: 4, metCount, total };
}

export function maskEmail(email) {
  if (!email || !email.includes("@")) return "";
  const [name, domain] = email.split("@");
  const visible = name.slice(0, 1);
  const hidden = "•".repeat(Math.min(Math.max(name.length - 1, 4), 8));
  return `${visible}${hidden}@${domain}`;
}

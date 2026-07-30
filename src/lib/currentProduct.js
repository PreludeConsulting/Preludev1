import { normalizePlanId } from "./plans.js";

export function isEssaySupportProduct(planId, fallbackName = "") {
  return normalizePlanId(planId) === "basic" || String(fallbackName).trim().toLowerCase() === "basic";
}

export function getCurrentProductName(planId, fallbackName = "") {
  return isEssaySupportProduct(planId, fallbackName) ? "Essay Support" : fallbackName || "Prelude";
}

export function getCurrentProductLabel(planId, fallbackName = "") {
  const name = getCurrentProductName(planId, fallbackName);
  return isEssaySupportProduct(planId, fallbackName) ? name : `${name} plan`;
}

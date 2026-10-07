export const COLLATERAL_TYPES = [
  { id: "land", label: "Land" },
  { id: "vehicle", label: "Vehicle" },
  { id: "livestock", label: "Livestock" },
  { id: "business_stock", label: "Business stock" },
  { id: "electronics", label: "Electronics" },
  { id: "household", label: "Household items" },
  { id: "guarantor", label: "Guarantor" },
  { id: "other", label: "Other" },
];

export const COLLATERAL_LABELS = Object.fromEntries(
  COLLATERAL_TYPES.map((t) => [t.id, t.label])
);

export const COLLATERAL_MIN_FILES = 4;
export const COLLATERAL_MAX_FILES = 6;

export function coverageInfo({ amount, totalRepayment, collateralValue }) {
  const principal = Number(amount || 0);
  const total = Number(totalRepayment || 0);
  const value = Number(collateralValue || 0);
  if (!principal || !value) return null;
  const vsPrincipal = value / principal;
  const vsTotal = total ? value / total : null;
  const shortfall = total ? Math.max(0, total - value) : 0;
  const surplus = total ? Math.max(0, value - total) : 0;
  const passesFloor = value >= principal;
  const coversTotal = total ? value >= total : false;
  return { vsPrincipal, vsTotal, shortfall, surplus, passesFloor, coversTotal };
}

// True on touch-first devices (phones/tablets). Used to show the
// "Take photo" camera button only on mobile; desktop keeps the file picker.
export function isMobileDevice() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

// Camera shots arrive with generic names (e.g. "image.jpg"). Rename them so
// uploads don't collide in the proofs bucket and admins can tell them apart.
export function normalizeCameraFile(file) {
  if (!(file instanceof File)) return file;
  const rawExt = String(file.name?.split(".").pop() || "").toLowerCase();
  const ext = /^[a-z0-9]{2,4}$/.test(rawExt) ? rawExt : "jpg";
  return new File([file], `camera_${Date.now()}.${ext}`, {
    type: file.type || "image/jpeg",
    lastModified: file.lastModified ?? Date.now(),
  });
}

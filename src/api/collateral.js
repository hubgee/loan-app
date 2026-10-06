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

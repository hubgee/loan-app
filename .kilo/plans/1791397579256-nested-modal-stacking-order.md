# Plan: Fix nested modal stacking order

## Problem

When an admin opens the loan detail modal (`LoanDetailView`, `z-[70]`) and then clicks **Disburse funds** or **Verify repayment**, the action modal (`DisburseModal` / `VerifyRepaymentModal`) renders **behind** the detail modal instead of in front.

## Root Cause

`LoanDetailView` is rendered in `Dashboard.jsx` at `z-[70]` (`src/components/LoanDetailView.jsx:89`).

`DisburseModal` and `VerifyRepaymentModal` are rendered as siblings in `Dashboard.jsx` at `z-50` (`src/components/DisburseModal.jsx:70`, `src/components/VerifyRepaymentModal.jsx:96`).

Because they share the same stacking context via the dashboard root and `z-[70] > z-50`, the action modals paint behind the detail modal.

## Fix

Raise the action modals above the detail modal.

1. `src/components/DisburseModal.jsx` — change the outer fixed container from `z-50` to `z-[80]`.
2. `src/components/VerifyRepaymentModal.jsx` — change the outer fixed container from `z-50` to `z-[80]`.

## Files Changed

- `src/components/DisburseModal.jsx`
- `src/components/VerifyRepaymentModal.jsx`

## Validation

1. Open the admin dashboard.
2. Click **View full application + ID** to open the loan detail modal.
3. Click **Disburse funds** or **Verify repayment** inside the detail modal.
4. Confirm the action modal appears in front of the detail modal and remains interactive.

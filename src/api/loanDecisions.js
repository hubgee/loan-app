import { supabase } from "./supabaseClient";

export const ACTIVE_STATUSES = ["pending", "approved", "confirmed", "edit_requested"];

export const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved — awaiting your confirmation",
  confirmed: "Confirmed — ready for disbursement",
  edit_requested: "Edit requested",
  cancelled: "Cancelled",
  repaid: "Repaid",
};

export const DURATION_RATES = {
  "1_week": 0.15,
  "2_weeks": 0.30,
  "1_month": 0.60,
};

export function calcLoan(amount, duration) {
  const n = Number(amount);
  if (!n || !DURATION_RATES[duration]) {
    return { interest: 0, totalRepayment: 0, repaymentDate: "", rate: 0 };
  }
  const rate = DURATION_RATES[duration];
  const interest = Number((n * rate).toFixed(2));
  const totalRepayment = Number((n + interest).toFixed(2));
  const date = new Date();
  if (duration === "1_week") date.setDate(date.getDate() + 7);
  else if (duration === "2_weeks") date.setDate(date.getDate() + 14);
  else date.setMonth(date.getMonth() + 1);
  return { interest, totalRepayment, repaymentDate: date.toISOString().split("T")[0], rate };
}

export async function logLoanEvent({ loanId, actorRole, actorId, action, fromStatus, toStatus, message }) {
  const { error } = await supabase.from("loan_events").insert({
    loan_id: loanId,
    actor_role: actorRole,
    actor_id: actorId ?? null,
    action,
    from_status: fromStatus ?? null,
    to_status: toStatus ?? null,
    message: message ?? null,
  });
  if (error) console.error("logLoanEvent failed", error);
}

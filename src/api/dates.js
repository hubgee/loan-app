export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  if (Number.isNaN(due.getTime())) return null;
  due.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

export function getRepaymentCountdown(loan) {
  if (!loan?.repayment_date) return null;
  // Countdown is only meaningful once the loan is moving toward repayment.
  if (["pending", "approved", "edit_requested", "cancelled", "repaid", "forfeited"].includes(loan.status)) {
    return null;
  }
  const days = daysUntil(loan.repayment_date);
  if (days === null) return null;

  let tone = "green";
  let text;
  if (days < 0) {
    tone = "red";
    text = `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  } else if (days === 0) {
    tone = "red";
    text = "Due today";
  } else if (days === 1) {
    tone = "orange";
    text = "Due tomorrow";
  } else {
    text = `Due in ${days} days`;
    tone = days <= 3 ? "orange" : days <= 7 ? "amber" : "green";
  }

  if (loan.status === "repayment_pending") {
    text += " · waiting for admin verification";
  }
  if (loan.status === "forfeiture_pending") {
    text += " · forfeiture awaiting admin review";
  }
  return { days, text, tone };
}

export function countdownToneClasses(tone) {
  return {
    green: "bg-emerald-50 border-emerald-200 text-emerald-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    orange: "bg-orange-50 border-orange-200 text-orange-800",
    red: "bg-red-50 border-red-200 text-red-800",
  }[tone] ?? "bg-slate-50 border-slate-200 text-slate-700";
}

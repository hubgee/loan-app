import { countdownToneClasses, getRepaymentCountdown } from "../api/dates";

export default function RepaymentCountdown({ loan, compact = false }) {
  const countdown = getRepaymentCountdown(loan);
  if (!countdown) return null;
  const tone = countdownToneClasses(countdown.tone);
  if (compact) {
    return (
      <p className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${tone}`}>
        <span className="mr-1">⏳</span>
        {countdown.text}
      </p>
    );
  }
  return (
    <div className={`rounded-xl border p-4 text-center ${tone}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">Repayment countdown</p>
      <p className="text-2xl md:text-3xl font-bold mt-1">{countdown.text}</p>
      <p className="text-sm opacity-80 mt-1">
        Due: {loan.repayment_date ? new Date(loan.repayment_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
      </p>
    </div>
  );
}

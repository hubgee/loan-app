import { supabase } from "./supabaseClient";

export const TRANSACTION_TYPES = {
  disbursement: "Disbursement",
  repayment: "Repayment",
};

export const TRANSACTION_STATUSES = {
  pending_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  rejected: "Rejected",
};

export async function getOrganizationSettings() {
  const { data, error } = await supabase
    .from("organization_settings")
    .select("key, value");
  if (error) throw error;
  const map = {};
  for (const row of data || []) map[row.key] = row.value;
  return map;
}

export async function createTransaction({
  loanId,
  type,
  referenceNumber,
  paymentMethod,
  amount,
  proofFile,
  submittedBy,
}) {
  let proofUrl = null;
  if (proofFile) {
    // Store under the borrower's folder so the borrower can read it later,
    // even when the admin is the one uploading the disbursement proof.
    const { data: loan, error: loanError } = await supabase
      .from("loan_applications")
      .select("user_id")
      .eq("id", loanId)
      .single();
    if (loanError) throw loanError;
    const path = `${loan.user_id}/${Date.now()}_${proofFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from("proofs")
      .upload(path, proofFile, { upsert: false });
    if (uploadError) throw uploadError;
    proofUrl = path;
  }

  const { data, error } = await supabase
    .from("loan_transactions")
    .insert({
      loan_id: loanId,
      type,
      reference_number: referenceNumber,
      payment_method: paymentMethod,
      amount: amount || null,
      proof_url: proofUrl,
      status: "pending_confirmation",
      submitted_by: submittedBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTransactionStatus({ id, status, confirmedBy, reason }) {
  const patch = {
    status,
    confirmed_by: confirmedBy || null,
    confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
  };
  const { error } = await supabase
    .from("loan_transactions")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

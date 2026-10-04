# Kuwala Loans — Application Capabilities & Communication Guide

## 1. What This Application Does

Kuwala Loans is a web-based loan management system built with React and Supabase. It helps small lending organizations manage short-term personal loans. The application runs entirely in the browser — there is no central application server. Instead, the browser connects directly to Supabase (a cloud backend), and database security rules ensure that borrowers can only see their own data while administrators can see everything.

### 1.1 Target Users

There are two types of users in the system:

- **Borrowers** — individuals who apply for, receive, and repay loans.
- **Administrators** — staff members who review applications, approve loans, edit loan details, and record repayments.

### 1.2 Loan Products

The application is designed for small, short-term personal loans. When a borrower applies, they choose a repayment period:

- **1 week** — carries a 15% interest charge.
- **2 weeks** — carries a 30% interest charge.
- **1 month** — carries a 60% interest charge.

The system automatically calculates the interest amount, the total repayment due, and the exact repayment date based on the borrower's chosen duration.

---

## 2. Borrower Experience

### 2.1 Creating an Account

A new borrower visits the application and signs up with an email address and password. The system immediately creates their account and directs them to a **Pending Activation** screen. New borrowers cannot apply for a loan or view any loan-related pages until an administrator manually activates their account. This is a deliberate security measure that prevents unauthorized or fraudulent applications from entering the system.

### 2.2 Waiting for Activation

While a borrower's account is pending, they see a simple waiting screen with a manual "Refresh" button. Clicking this button asks the system to re-check whether their account has been activated yet. The borrower is blocked from accessing any loan features during this time.

### 2.3 Applying for a Loan

Once activated, the borrower can submit a loan application. The application form collects the following information:

- **Personal details** — full name, email address, and phone number.
- **Loan details** — the amount requested and the repayment duration (1 week, 2 weeks, or 1 month).
- **Purpose of the loan** — a brief description of why the borrower needs the money.
- **National ID** — a scanned copy or photo of the borrower's government-issued identification document (accepted formats are PDF, JPG, or PNG).
- **Payout details** — how the borrower wants to receive the loan funds. Options include mobile money services (Airtel Money or TNM Mpamba) or bank transfer (FDH Bank, National Bank, or Standard Bank). For bank transfers, the borrower must also provide the branch name.

The system automatically calculates and displays the interest, total repayment amount, and repayment date before the borrower submits the form.

For convenience, if the borrower has applied for a loan before, the system offers to pre-fill the payout details from their previous application to save time.

### 2.4 Viewing My Loans

After submitting an application, the borrower can view all of their loans on the "My Loans" page. Each loan shows:

- The current status (pending, approved, confirmed, edit requested, cancelled, or repaid).
- A visual progress bar indicating where the loan stands in its lifecycle.
- The loan amount, interest, total repayment, and repayment date.
- A complete timeline of every action taken on the loan.

### 2.5 Acting on an Approved Loan

When an administrator approves a loan, the borrower sees a notification and three possible actions:

1. **Confirm** — The borrower reviews the loan details and confirms they are correct and ready to receive the funds. This moves the loan to "Confirmed" status and signals the administrator that the money should be disbursed.
2. **Request an Edit** — If any detail is wrong (for example, the payout account number or phone number), the borrower can open an editing modal, change any field, and write a required message explaining what needs to be changed and why. This moves the loan to "Edit Requested" status.
3. **Cancel** — If the borrower no longer wants the loan, they can cancel it but must provide a required reason (such as "I found another lender"). This moves the loan to "Cancelled" status.

### 2.6 Tracking Communication

Every meaningful action — approval, confirmation, edit request, cancellation, or repayment — creates a permanent record in the loan's timeline. The timeline shows:

- What happened (for example: "Loan approved" or "Borrower requested an edit").
- Who performed the action (the borrower or an administrator).
- When it happened.
- Any message attached to the action (such as the reason for an edit request or cancellation).

---

## 3. Administrator Experience

### 3.1 Logging In

Administrators use a separate, restricted login page. If a regular borrower somehow reaches this page and logs in, their session is immediately destroyed. This prevents unauthorized users from accessing administrator functions.

### 3.2 Activating Borrowers

When a new borrower signs up, the administrator sees them in the **User Management** section. New accounts appear with an "inactive" status. The administrator can activate or deactivate borrower accounts with a simple toggle switch. Deactivated borrowers cannot apply for new loans or access loan features.

### 3.3 The Loan Dashboard

The main administrator dashboard provides a complete overview of all loans in the system. Key features include:

- **Summary cards** showing the total count of loans in each status: total, pending, approved, confirmed, edit requested, and repaid.
- **Search** — find any loan by borrower name, email, phone number, or amount.
- **Filtering** — filter loans by status or by payout method (mobile money or bank).
- **Needs review filter** — quickly surface loans that have been edited by borrowers or need the administrator's attention.
- **Sorting** — sort loans by various fields.
- **Pagination** — display loans three per page for easy browsing.

### 3.4 Reviewing Individual Loans

The administrator can open any loan to see its full details, including:

- All application information entered by the borrower.
- The uploaded National ID document (viewed as an image or PDF through a secure, time-limited link).
- The complete timeline of actions.
- Any borrower messages attached to edit requests or cancellations.

### 3.5 Loan Actions Available to Administrators

From the dashboard or the detail view, an administrator can perform the following actions:

- **Approve** — Change a loan from "Pending" to "Approved." This notifies the borrower that the loan has been approved and that they need to confirm, edit, or cancel.
- **Re-approve** — After a borrower has requested an edit, the administrator reviews the requested changes and the reason provided. If the administrator accepts the changes, they click "Re-approve" to move the loan back to "Approved" status. The borrower is then prompted to review and confirm the updated details.
- **Mark Repaid** — Once the administrator has disbursed the funds and the borrower has repaid the loan, the administrator changes the status to "Repaid."
- **Mark Reviewed** — When a loan requires the administrator's attention (for example, an edit request has arrived), the dashboard highlights it. The administrator can click "Mark reviewed" to clear this notification flag without changing the loan's status. This is an internal signal that the administrator has seen the loan.

### 3.6 Document Access

Administrators have secure access to every borrower's uploaded National ID document. These documents are stored in a private cloud storage area. The system generates a temporary, time-limited link (valid for one hour) so the administrator can view the document during the review process. Borrowers cannot access each other's documents, and documents are never exposed publicly.

---

## 4. Communication Between Borrowers and Administrators

The application does not include email, instant messaging, or a traditional inbox. Instead, all communication happens through the loan record itself. Every action taken by either party is recorded as a structured status change, a message, or an audit event. Below is a plain-language explanation of how the two parties communicate.

### 4.1 Step 1: Borrower Submits an Application

When a borrower fills out and submits the loan form, they are sending a formal request to the administrator. The loan appears in the administrator's dashboard with a "needs review" indicator. The administrator now knows:

- Who the borrower is.
- How much money they need and for how long.
- How they want to receive the funds.
- Why they need the loan.
- That they have provided a valid National ID.

### 4.2 Step 2: Administrator Approves the Loan

When the administrator clicks "Approve," the system records this as an audit event. The borrower receives a clear notification that the loan has been approved. At this point, the administrator has communicated: "Your loan request has been reviewed and accepted."

### 4.3 Step 3: Borrower Responds to Approval

The borrower now has three ways to respond, each of which sends a specific signal back to the administrator:

- **Confirm** — Communicates: "The details are correct. I am ready to receive the money." The administrator sees this confirmation in the timeline and knows to disburse the funds.
- **Request an Edit** — Communicates: "Something is wrong, and here is exactly what needs to change and why." The borrower's message (which is required) gives the administrator the specific information needed to correct the record.
- **Cancel** — Communicates: "I no longer need this loan, and here is my reason." This closes the communication loop and allows the administrator to update their records.

### 4.4 Step 4: Administrator Re-approves Edited Loans

When the administrator receives an edit request, they review the requested changes and the borrower's reason. If they accept the changes, they click "Re-approve." This communicates back to the borrower: "Your edits have been accepted. Please review the updated loan and confirm."

### 4.5 Step 5: Administrator Records Repayment

After disbursing the funds, the administrator waits for the borrower to repay. Once repayment is received, the administrator marks the loan as "Repaid." This creates a final audit event and closes the loan lifecycle.

### 4.6 The Audit Trail as a Communication Log

Every single action described above is recorded in an append-only audit trail called `loan_events`. This trail is the system's equivalent of a conversation history. It permanently records:

- Which party took the action (borrower or administrator).
- What the action was (approve, confirm, edit request, cancel, re-approve, mark repaid, mark reviewed).
- What status the loan changed from and to.
- Any message attached to the action.
- The exact date and time of the action.

Both borrowers and administrators can view this timeline at any time. It ensures complete transparency: neither party can deny an action, and both sides can always see the full history of their interactions.

---

## 5. Summary of Key Features

### For Borrowers
- Self-service account creation and activation wait.
- Online loan application with automatic interest and repayment date calculation.
- Upload of National ID for identity verification.
- Choice of payout method (mobile money or bank transfer).
- "Use last details" convenience for repeat applicants.
- Dashboard showing all personal loans with status and timeline.
- Ability to confirm, edit, or cancel approved loans.
- Full visibility into the history of every loan.

### For Administrators
- Separate, secure login process.
- User management with activation and deactivation controls.
- Complete loan dashboard with search, filter, sort, and pagination.
- Inline loan status changes without navigating away from the list.
- Detailed loan view with full application data and National ID viewer.
- Ability to approve, re-approve, mark repaid, and mark reviewed.
- Secure, time-limited access to borrower National ID documents.
- Clear visual indicators for loans requiring attention.

### System-Wide
- No application server required; fully serverless architecture.
- Row-level database security ensures data isolation between borrowers.
- Role-based access controls every page and every action.
- Append-only audit trail for complete transparency and accountability.
- Automatic interest calculation based on selected loan duration.
- Single active loan restriction prevents a borrower from holding multiple active loans simultaneously.
- Mobile-responsive design for use on phones and computers.

---

## 6. How Communication Flows in Practice

To give a concrete example of how the system replaces traditional communication, consider this typical scenario:

1. **Borrower submits an application** — This is the initial "request." The administrator sees it in the dashboard.
2. **Administrator opens the loan** — They review all details and view the National ID.
3. **Administrator clicks Approve** — The status changes to "Approved." The system records this event. The borrower sees a notification.
4. **Borrower opens the loan and clicks Request Edit** — They change the payout account number and write: "I provided the wrong account. Please use this Airtel Money number instead: 088..." The status changes to "Edit Requested." The administrator receives this message through the system's notification indicators.
5. **Administrator sees the edit request** — They view the requested changes and the message.
6. **Administrator clicks Re-approve** — The status changes back to "Approved." The borrower is notified.
7. **Borrower reviews the updated details** — Everything looks correct now, so they click Confirm.
8. **Borrower sees: "Confirmed — waiting for disbursement."** The administrator sees this confirmation in the timeline.
9. **Administrator disburses the funds** — They mark the loan as "Repaid" once the borrower settles the debt.

At every step in this process, both parties can see exactly what has happened, when it happened, who did it, and any messages that were attached. There is no confusion about the current state of the loan, and there is a permanent record of every decision.

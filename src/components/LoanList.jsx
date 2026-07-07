// src/components/LoanList.jsx

export default function LoanList({ loans }) {
    return (
      <div className="space-y-4 mt-6">
        <h2 className="text-lg font-bold">Loan Records</h2>
        {loans.length === 0 ? (
          <p className="text-gray-500">No loans yet. Submit one above.</p>
        ) : (
          loans.map((loan, i) => (
            <div key={i} className="bg-white p-4 rounded shadow-md">
              <p className="font-semibold">{loan.name}</p>
              <p>Amount: ${loan.amount}</p>
              <p>
                Status:{" "}
                <span className="px-2 py-1 text-xs rounded bg-yellow-200 text-yellow-800">
                  {loan.status}
                </span>
              </p>
            </div>
          ))
        )}
      </div>
    );
  }
  
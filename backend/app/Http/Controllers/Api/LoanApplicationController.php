<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoanApplication;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class LoanApplicationController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:50',
            'amount' => 'required|numeric|min:1',
            'purpose' => 'nullable|string|max:2000',
            'nationalId' => 'required|file|mimes:pdf,jpg,jpeg,png|max:2048',
        ]);

        $file = $request->file('nationalId');
        $path = $file->storeAs(
            'ids',
            uniqid('id_', true).'.'.$file->getClientOriginalExtension(),
            'private'
        );

        $application = LoanApplication::create([
            'borrower_name' => $data['name'],
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'amount' => $data['amount'],
            'purpose' => $data['purpose'] ?? null,
            'national_id_path' => $path,
            'national_id_original' => $file->getClientOriginalName(),
            'status' => 'Pending',
        ]);

        return response()->json([
            'message' => 'Loan application submitted successfully.',
            'application' => $application,
        ], 201);
    }

    public function index()
    {
        $applications = LoanApplication::latest()->paginate(50);

        return response()->json([
            'applications' => $applications->items(),
            'pagination' => [
                'total' => $applications->total(),
                'per_page' => $applications->perPage(),
                'current_page' => $applications->currentPage(),
                'last_page' => $applications->lastPage(),
            ],
            'stats' => [
                'total' => LoanApplication::count(),
                'pending' => LoanApplication::where('status', 'Pending')->count(),
                'approved' => LoanApplication::where('status', 'Approved')->count(),
                'repaid' => LoanApplication::where('status', 'Repaid')->count(),
            ],
        ]);
    }

    public function updateStatus(Request $request, LoanApplication $loan)
    {
        $data = $request->validate([
            'status' => 'required|in:Pending,Approved,Repaid',
        ]);

        $loan->update([
            'status' => $data['status'],
            'processed_by' => Auth::guard('admin')->id(),
        ]);

        return response()->json([
            'message' => 'Status updated.',
            'application' => $loan,
        ]);
    }

    public function downloadId(LoanApplication $loan)
    {
        abort_unless(Storage::disk('private')->exists($loan->national_id_path), 404);

        return Storage::disk('private')->download(
            $loan->national_id_path,
            $loan->national_id_original ?? 'national-id'
        );
    }
}

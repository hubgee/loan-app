<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LoanApplicationController;
use Illuminate\Support\Facades\Route;

// Public — borrower submits an application (with National ID upload)
Route::post('/api/loans', [LoanApplicationController::class, 'store']);

// Admin authentication (session-based SPA auth)
Route::post('/api/login', [AuthController::class, 'login']);

// Admin-only area — dashboard data + actions
Route::middleware('admin')->group(function () {
    Route::get('/api/me', [AuthController::class, 'me']);
    Route::post('/api/logout', [AuthController::class, 'logout']);
    Route::get('/api/loans', [LoanApplicationController::class, 'index']);
    Route::patch('/api/loans/{loan}', [LoanApplicationController::class, 'updateStatus']);
    Route::get('/api/loans/{loan}/national-id', [LoanApplicationController::class, 'downloadId']);
});

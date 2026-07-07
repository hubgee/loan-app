<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoanApplication extends Model
{
    protected $fillable = [
        'borrower_name',
        'email',
        'phone',
        'amount',
        'purpose',
        'national_id_path',
        'national_id_original',
        'status',
        'processed_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function processor()
    {
        return $this->belongsTo(Admin::class, 'processed_by');
    }
}

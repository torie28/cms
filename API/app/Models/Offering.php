<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'category', 'amount', 'received_on', 'payment_method', 'jumuiya_id',
    'contributor', 'reference', 'notes', 'user_id', 'recorded_by',
])]
class Offering extends Model
{
    use SoftDeletes;

    /** @var array<string, string> Category key => Swahili label. */
    public const CATEGORIES = [
        'sadaka' => 'Sadaka ya ibada',
        'zaka' => 'Zaka',
        'fungu_la_kumi' => 'Fungu la kumi',
        'majitoleo' => 'Majitoleo ya jumuiya (thamani ya vipaji)',
        'shukrani' => 'Shukrani',
        'ujenzi' => 'Mchango wa ujenzi',
        'mengineyo' => 'Matoleo mengineyo',
    ];

    /** Given by an individual, so the giver's name is required. */
    public const PERSONAL_CATEGORIES = ['zaka', 'fungu_la_kumi'];

    /** Always belong to a jumuiya. */
    public const JUMUIYA_CATEGORIES = ['majitoleo'];

    /** @var array<string, string> */
    public const PAYMENT_METHODS = [
        'cash' => 'Taslimu',
        'mobile' => 'Pesa kwa simu',
        'bank' => 'Benki',
        'cheque' => 'Hundi',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'received_on' => 'date:Y-m-d',
        ];
    }

    public function jumuiya(): BelongsTo
    {
        return $this->belongsTo(Jumuiya::class)->withTrashed();
    }
}

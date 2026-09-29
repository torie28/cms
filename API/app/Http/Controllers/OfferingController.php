<?php

namespace App\Http\Controllers;

use App\Models\Offering;
use App\Support\ActivityLogger;
use App\Support\Modules;
use App\Support\Recycle;
use App\Support\Sms\Phone;
use App\Support\Sms\ThankYou;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OfferingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureAccess($request);

        $range = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $offerings = Offering::query()
            ->with(['jumuiya:id,name', 'thankYouMessage:id,status'])
            ->when($range['from'] ?? null, fn ($query, $from) => $query->whereDate('received_on', '>=', $from))
            ->when($range['to'] ?? null, fn ($query, $to) => $query->whereDate('received_on', '<=', $to))
            ->orderByDesc('received_on')
            ->orderByDesc('id')
            ->get();

        return response()->json($offerings);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAccess($request);

        $offering = Offering::query()->create([
            ...$this->validated($request),
            'user_id' => $request->user()->id,
            'recorded_by' => $request->user()->name,
        ]);
        $offering->load('jumuiya:id,name');
        $this->thankGiver($request, $offering);

        app(ActivityLogger::class)->record(
            $request->user(),
            'created',
            $this->describe($offering),
            'offering',
            $request,
            $offering,
        );

        return response()->json($offering, 201);
    }

    public function update(Request $request, Offering $offering): JsonResponse
    {
        $this->ensureAccess($request);

        $offering->update($this->validated($request));
        $changes = ActivityLogger::changes($offering, [
            'category' => 'Aina',
            'amount' => 'Kiasi',
            'received_on' => 'Tarehe',
            'payment_method' => 'Njia ya malipo',
            'jumuiya_id' => 'Jumuiya (namba)',
            'contributor' => 'Mtoaji',
            'contributor_phone' => 'Simu ya mtoaji',
            'reference' => 'Namba ya risiti',
            'notes' => 'Maelezo',
        ]);
        $offering->load('jumuiya:id,name');
        if ($offering->thank_you_message_id === null) {
            $this->thankGiver($request, $offering);
        }

        app(ActivityLogger::class)->record(
            $request->user(),
            'updated',
            $this->describe($offering),
            'offering',
            $request,
            $offering,
            $changes ? ['changes' => $changes] : null,
        );

        return response()->json($offering);
    }

    public function destroy(Request $request, Offering $offering): JsonResponse
    {
        $this->ensureAccess($request);

        $snapshot = Recycle::snapshot($offering);
        $offering->delete();

        app(ActivityLogger::class)->record(
            $request->user(),
            'deleted',
            $this->describe($offering),
            'offering',
            $request,
            $offering,
            ['snapshot' => $snapshot],
        );

        return response()->json(['message' => 'Offering removed.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'category' => ['required', 'string', Rule::in(array_keys(Offering::CATEGORIES))],
            'amount' => ['required', 'numeric', 'min:1', 'max:999999999999'],
            'received_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'payment_method' => ['required', 'string', Rule::in(array_keys(Offering::PAYMENT_METHODS))],
            'jumuiya_id' => [
                Rule::requiredIf(in_array($request->input('category'), Offering::JUMUIYA_CATEGORIES, true)),
                'nullable',
                'integer',
                Rule::exists('jumuiyas', 'id')->whereNull('deleted_at'),
            ],
            'contributor' => [
                Rule::requiredIf(in_array($request->input('category'), Offering::PERSONAL_CATEGORIES, true)),
                'nullable',
                'string',
                'max:255',
            ],
            'contributor_phone' => [
                'nullable',
                'string',
                'max:40',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (Phone::normalize($value) === null) {
                        $fail('Namba ya simu ya mtoaji si sahihi.');
                    }
                },
            ],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], [
            'jumuiya_id.required' => 'Chagua jumuiya iliyotoa majitoleo haya.',
            'contributor.required' => 'Andika jina la aliyetoa.',
        ]);

        return [
            ...$data,
            'jumuiya_id' => $data['jumuiya_id'] ?? null,
            'contributor' => $data['contributor'] ?? null,
            'contributor_phone' => Phone::normalize($data['contributor_phone'] ?? null),
            'reference' => $data['reference'] ?? null,
            'notes' => $data['notes'] ?? null,
        ];
    }

    /** Sends the automatic thank-you SMS unless the recorder unticked "send_thank_you". */
    private function thankGiver(Request $request, Offering $offering): void
    {
        if (ThankYou::applies($offering) && $request->boolean('send_thank_you', true)) {
            ThankYou::send($offering, $request->user());
        }

        $offering->load('thankYouMessage:id,status');
    }

    private function describe(Offering $offering): string
    {
        $subject = Offering::CATEGORIES[$offering->category].' TSh '.number_format((float) $offering->amount)
            .' ('.$offering->received_on->toDateString().')';

        $from = $offering->contributor ?: $offering->jumuiya?->name;

        return $from ? $subject.' from '.$from : $subject;
    }

    private function ensureAccess(Request $request): void
    {
        abort_unless(
            Modules::canAccess($request->user(), 'sadaka'),
            403,
            'Huna ruhusa ya kusimamia sadaka na michango.',
        );
    }
}

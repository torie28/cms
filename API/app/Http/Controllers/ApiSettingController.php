<?php

namespace App\Http\Controllers;

use App\Models\ApiSetting;
use App\Support\ActivityLogger;
use App\Support\ApiSettings;
use App\Support\Modules;
use App\Support\Sms\Phone;
use App\Support\Sms\SmsGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Throwable;

class ApiSettingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureModule($request);

        return response()->json(ApiSettings::present());
    }

    /**
     * Body: `values` (field => value) and optional `reset` (fields that go back to .env).
     * A secret sent as null/empty is left unchanged, so the form never has to echo it back.
     */
    public function update(Request $request, string $service): JsonResponse
    {
        $this->ensureCan($request, 'api_settings', 'update');
        abort_unless(ApiSettings::exists($service), 404);

        $fields = ApiSettings::DEFINITIONS[$service]['fields'];
        $data = $request->validate([
            'values' => ['sometimes', 'array'],
            'reset' => ['sometimes', 'array'],
            'reset.*' => ['string', Rule::in(array_keys($fields))],
            ...$this->rules($fields),
        ], [], $this->attributes($fields));

        $reset = $data['reset'] ?? [];
        $changes = [];

        foreach ($data['values'] ?? [] as $name => $value) {
            if (in_array($name, $reset, true) || ($fields[$name]['type'] === 'secret' && blank($value))) {
                continue;
            }

            $changes[$name] = is_string($value) ? trim($value) : $value;
        }

        foreach ($reset as $name) {
            $changes[$name] = ApiSettings::envValue($fields[$name]);
        }

        $before = ApiSettings::values($service);
        $after = ApiSettings::values($service, $changes);

        if ($missing = ApiSettings::missing($service, $after)) {
            abort(422, 'Jaza sehemu hizi kwanza: '.implode(', ', $missing).'.');
        }

        $actor = $request->user()->name;

        foreach ($changes as $name => $value) {
            $key = "{$service}.{$name}";

            if (in_array($name, $reset, true)) {
                ApiSetting::query()->where('key', $key)->delete();
            } elseif ((string) $value !== (string) $before[$name]) {
                ApiSetting::query()->updateOrCreate(['key' => $key], ['value' => $value, 'updated_by' => $actor]);
            }
        }

        ApiSettings::apply();

        $logged = [];
        foreach ($changes as $name => $value) {
            if ((string) $value === (string) $before[$name]) {
                continue;
            }

            $secret = $fields[$name]['type'] === 'secret';
            $logged[$fields[$name]['label']] = [
                'from' => $secret ? (filled($before[$name]) ? '••••' : null) : $before[$name],
                'to' => $secret ? (filled($value) ? '••••' : null) : $value,
            ];
        }

        if ($logged !== []) {
            app(ActivityLogger::class)->record(
                $request->user(),
                'updated',
                'API '.ApiSettings::DEFINITIONS[$service]['label'],
                'api_settings',
                $request,
                details: ['changes' => $logged],
            );
        }

        return response()->json(collect(ApiSettings::present())->firstWhere('key', $service));
    }

    public function test(Request $request, string $service): JsonResponse
    {
        $this->ensureCan($request, 'api_settings', 'update');
        abort_unless(ApiSettings::exists($service), 404);

        $appName = (string) config('app.name');
        $values = ApiSettings::values($service);

        if ($missing = ApiSettings::missing($service, $values)) {
            abort(422, 'Jaza sehemu hizi kwanza: '.implode(', ', $missing).'.');
        }

        $isTestMode = ApiSettings::status($service, $values) === 'test';

        if ($service === 'sms') {
            $data = $request->validate(['to' => ['required', 'string', 'max:30']], [], ['to' => 'namba ya simu']);
            $phone = Phone::normalize($data['to']);
            abort_unless($phone, 422, 'Namba ya simu si sahihi.');

            $error = app(SmsGateway::class)->send([
                $phone => "Jaribio la SMS kutoka {$appName}. Ukipokea ujumbe huu, mipangilio ya SMS iko sawa.",
            ])[$phone] ?? null;

            abort_if($error, 422, $error ?? '');
        } else {
            $data = $request->validate(['to' => ['required', 'email', 'max:255']], [], ['to' => 'barua pepe']);

            try {
                Mail::purge();
                Mail::raw(
                    "Jaribio la barua pepe kutoka {$appName}. Ukipokea barua hii, mipangilio ya barua pepe iko sawa.",
                    fn ($message) => $message->to($data['to'])->subject("Jaribio la barua pepe · {$appName}"),
                );
            } catch (Throwable $exception) {
                report($exception);
                abort(422, 'Imeshindwa kutuma: '.$exception->getMessage());
            }
        }

        return response()->json([
            'ok' => true,
            'test_mode' => $isTestMode,
            'message' => $isTestMode
                ? 'Iko kwenye hali ya majaribio: ujumbe umeandikwa kwenye storage/logs/laravel.log, haujatumwa.'
                : 'Ujumbe wa majaribio umetumwa. Hakikisha umeupokea.',
        ]);
    }

    private function ensureModule(Request $request): void
    {
        abort_unless(
            Modules::canAccess($request->user(), 'api_settings'),
            403,
            'Huna ruhusa ya kuona mipangilio ya API.',
        );
    }

    /** @param array<string, array<string, mixed>> $fields */
    private function rules(array $fields): array
    {
        $rules = [];

        foreach ($fields as $name => $field) {
            $rule = match ($field['type']) {
                'select' => [Rule::in(array_keys($field['options']))],
                'number' => ['integer', 'min:1', 'max:65535'],
                'email' => ['email', 'max:255'],
                default => ['string', 'max:'.($field['max'] ?? 1000)],
            };

            $rules["values.{$name}"] = ['nullable', ...$rule];
        }

        return $rules;
    }

    /** @param array<string, array<string, mixed>> $fields */
    private function attributes(array $fields): array
    {
        return collect($fields)
            ->mapWithKeys(fn (array $field, string $name) => ["values.{$name}" => $field['label']])
            ->all();
    }
}

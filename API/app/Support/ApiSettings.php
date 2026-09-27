<?php

namespace App\Support;

use App\Models\ApiSetting;
use Illuminate\Support\Arr;
use Throwable;

/**
 * External services (SMS gateway, email, …) configured from Settings → APIs.
 *
 * Each field maps onto a Laravel config path. Values saved in the `api_settings`
 * table override config at boot; a field with no saved value falls back to
 * whatever .env / config provides. To add a service or field, extend DEFINITIONS.
 */
class ApiSettings
{
    /**
     * `type`: text | secret | select | number | email.
     * `show_when`: [field, value(s)] — only relevant (and required) when that field matches.
     * `live_when`: [field, value] — the service really sends when that field is not the test value.
     *
     * @var array<string, array<string, mixed>>
     */
    public const DEFINITIONS = [
        'sms' => [
            'label' => 'SMS',
            'description' => 'Mtoa huduma anayetumika kutuma SMS kwa waumini, jumuiya na watumiaji.',
            'test' => 'phone',
            'test_mode' => ['driver', 'log'],
            'fields' => [
                'driver' => [
                    'label' => 'Mtoa huduma',
                    'type' => 'select',
                    'config' => 'services.sms.driver',
                    'required' => true,
                    'options' => [
                        'log' => 'Majaribio (huandikwa kwenye log, hazitumwi)',
                        'beem' => 'Beem Africa',
                    ],
                ],
                'sender_id' => [
                    'label' => 'Jina la mtumaji (Sender ID)',
                    'type' => 'text',
                    'config' => 'services.sms.sender_id',
                    'required' => true,
                    'max' => 11,
                    'help' => 'Herufi zisizozidi 11. Kwa Beem, lazima liwe limeidhinishwa kwenye akaunti yako.',
                ],
                'beem_api_key' => [
                    'label' => 'Beem API Key',
                    'type' => 'secret',
                    'config' => 'services.sms.beem.api_key',
                    'required' => true,
                    'show_when' => ['driver', 'beem'],
                    'help' => 'Beem Africa dashboard → Profile → Authentication Information.',
                ],
                'beem_secret_key' => [
                    'label' => 'Beem Secret Key',
                    'type' => 'secret',
                    'config' => 'services.sms.beem.secret_key',
                    'required' => true,
                    'show_when' => ['driver', 'beem'],
                ],
            ],
        ],
        'mail' => [
            'label' => 'Barua pepe (SMTP)',
            'description' => 'Seva ya barua pepe inayotumika kutuma barua kutoka kwenye mfumo.',
            'test' => 'email',
            'test_mode' => ['mailer', 'log'],
            'fields' => [
                'mailer' => [
                    'label' => 'Njia ya kutuma',
                    'type' => 'select',
                    'config' => 'mail.default',
                    'required' => true,
                    'options' => [
                        'log' => 'Majaribio (huandikwa kwenye log, hazitumwi)',
                        'smtp' => 'SMTP',
                    ],
                ],
                'host' => [
                    'label' => 'Seva (host)',
                    'type' => 'text',
                    'config' => 'mail.mailers.smtp.host',
                    'required' => true,
                    'show_when' => ['mailer', 'smtp'],
                    'placeholder' => 'smtp.gmail.com',
                ],
                'port' => [
                    'label' => 'Port',
                    'type' => 'number',
                    'config' => 'mail.mailers.smtp.port',
                    'required' => true,
                    'show_when' => ['mailer', 'smtp'],
                    'placeholder' => '587',
                ],
                'scheme' => [
                    'label' => 'Usalama',
                    'type' => 'select',
                    'config' => 'mail.mailers.smtp.scheme',
                    'show_when' => ['mailer', 'smtp'],
                    'options' => [
                        'smtp' => 'STARTTLS (port 587 / 25)',
                        'smtps' => 'SSL/TLS (port 465)',
                    ],
                ],
                'username' => [
                    'label' => 'Jina la mtumiaji',
                    'type' => 'text',
                    'config' => 'mail.mailers.smtp.username',
                    'show_when' => ['mailer', 'smtp'],
                ],
                'password' => [
                    'label' => 'Nenosiri',
                    'type' => 'secret',
                    'config' => 'mail.mailers.smtp.password',
                    'show_when' => ['mailer', 'smtp'],
                    'help' => 'Kwa Gmail tumia "App password", si nenosiri la kawaida.',
                ],
                'from_address' => [
                    'label' => 'Barua pepe ya mtumaji',
                    'type' => 'email',
                    'config' => 'mail.from.address',
                    'required' => true,
                    'placeholder' => 'parokia@example.com',
                ],
                'from_name' => [
                    'label' => 'Jina la mtumaji',
                    'type' => 'text',
                    'config' => 'mail.from.name',
                    'placeholder' => 'Parokia',
                ],
            ],
        ],
    ];

    /** Config values as .env left them, before any saved override was applied. */
    private static array $defaults = [];

    /** Called at boot: overlays saved values onto config. Silently skipped before migrations run. */
    public static function apply(): void
    {
        try {
            $rows = ApiSetting::query()->get(['key', 'value']);
        } catch (Throwable) {
            return;
        }

        foreach ($rows as $row) {
            $field = self::field($row->key);

            if (! $field) {
                continue;
            }

            try {
                $value = $row->value;
            } catch (Throwable) {
                // Encrypted with a different APP_KEY; keep the .env value.
                continue;
            }

            if (! array_key_exists($field['config'], self::$defaults)) {
                self::$defaults[$field['config']] = config($field['config']);
            }

            config([$field['config'] => self::cast($field, $value)]);
        }
    }

    public static function exists(string $service): bool
    {
        return isset(self::DEFINITIONS[$service]);
    }

    /** @return array<string, mixed>|null */
    public static function field(string $key): ?array
    {
        [$service, $name] = array_pad(explode('.', $key, 2), 2, null);

        return self::DEFINITIONS[$service]['fields'][$name] ?? null;
    }

    /** Every service with its fields and current values; secrets are never returned. */
    public static function present(): array
    {
        $saved = self::saved();
        $services = [];

        foreach (self::DEFINITIONS as $service => $definition) {
            $values = self::values($service);
            $fields = [];

            foreach ($definition['fields'] as $name => $field) {
                $key = "{$service}.{$name}";
                $value = $values[$name];
                $isSecret = $field['type'] === 'secret';
                $options = $field['options'] ?? null;

                if ($options !== null && filled($value) && ! array_key_exists((string) $value, $options)) {
                    $options[(string) $value] = (string) $value;
                }

                $fields[] = [
                    'key' => $name,
                    'label' => $field['label'],
                    'type' => $field['type'],
                    'required' => $field['required'] ?? false,
                    'help' => $field['help'] ?? null,
                    'placeholder' => $field['placeholder'] ?? null,
                    'max' => $field['max'] ?? null,
                    'options' => $options === null ? null : collect($options)
                        ->map(fn (string $label, string $optionValue) => ['value' => $optionValue, 'label' => $label])
                        ->values(),
                    'show_when' => isset($field['show_when'])
                        ? ['field' => $field['show_when'][0], 'value' => $field['show_when'][1]]
                        : null,
                    'value' => $isSecret ? null : $value,
                    'has_value' => filled($value),
                    'preview' => $isSecret && filled($value) ? self::mask((string) $value) : null,
                    'source' => array_key_exists($key, $saved) ? 'database' : (filled($value) ? 'env' : null),
                ];
            }

            $services[] = [
                'key' => $service,
                'label' => $definition['label'],
                'description' => $definition['description'],
                'test' => $definition['test'],
                'status' => self::status($service, $values),
                'missing' => self::missing($service, $values),
                'fields' => $fields,
                'overridden' => collect($saved)->keys()->contains(fn (string $key) => str_starts_with($key, "{$service}.")),
                'updated_at' => collect($saved)
                    ->filter(fn ($row, string $key) => str_starts_with($key, "{$service}."))
                    ->max('updated_at')?->toIso8601String(),
                'updated_by' => collect($saved)
                    ->filter(fn ($row, string $key) => str_starts_with($key, "{$service}."))
                    ->sortByDesc('updated_at')
                    ->first()?->updated_by,
            ];
        }

        return $services;
    }

    /**
     * Effective value of every field in a service, with `$changes` layered on top.
     *
     * @return array<string, mixed>
     */
    public static function values(string $service, array $changes = []): array
    {
        $values = [];

        foreach (self::DEFINITIONS[$service]['fields'] as $name => $field) {
            $values[$name] = array_key_exists($name, $changes) ? $changes[$name] : config($field['config']);
        }

        return $values;
    }

    /** Value the field would fall back to if its saved override were removed. */
    public static function envValue(array $field): mixed
    {
        return array_key_exists($field['config'], self::$defaults)
            ? self::$defaults[$field['config']]
            : config($field['config']);
    }

    /** @return list<string> labels of relevant required fields that are empty */
    public static function missing(string $service, array $values): array
    {
        $missing = [];

        foreach (self::DEFINITIONS[$service]['fields'] as $name => $field) {
            if (($field['required'] ?? false) && self::isRelevant($field, $values) && blank($values[$name] ?? null)) {
                $missing[] = $field['label'];
            }
        }

        return $missing;
    }

    public static function isRelevant(array $field, array $values): bool
    {
        if (! isset($field['show_when'])) {
            return true;
        }

        [$other, $expected] = $field['show_when'];

        return in_array((string) ($values[$other] ?? ''), Arr::wrap($expected), true);
    }

    /** "live" (really sends), "test" (log only) or "incomplete" (required fields missing). */
    public static function status(string $service, array $values): string
    {
        if (self::missing($service, $values) !== []) {
            return 'incomplete';
        }

        [$modeField, $testValue] = self::DEFINITIONS[$service]['test_mode'];

        return (string) ($values[$modeField] ?? '') === $testValue ? 'test' : 'live';
    }

    /** @return array<string, ApiSetting> */
    private static function saved(): array
    {
        try {
            return ApiSetting::query()->get()->keyBy('key')->all();
        } catch (Throwable) {
            return [];
        }
    }

    private static function cast(array $field, mixed $value): mixed
    {
        return $field['type'] === 'number' && is_numeric($value) ? (int) $value : $value;
    }

    private static function mask(string $value): string
    {
        return strlen($value) <= 4 ? '••••' : '••••'.substr($value, -4);
    }
}

<?php

namespace App\Support\Sms;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class SmsGateway
{
    private const BATCH_SIZE = 100;

    private const NEXTSMS_BASE_URL = 'https://messaging-service.co.tz/api/sms/v1';

    /** NextSMS status groups that mean the message will not reach the phone. */
    private const NEXTSMS_FAILED_GROUPS = ['REJECTED', 'UNDELIVERABLE', 'EXPIRED'];

    public const PROVIDERS = [
        'log' => 'Majaribio (log)',
        'nextsms' => 'NextSMS',
        'beem' => 'Beem Africa',
    ];

    public static function driver(): string
    {
        return (string) config('services.sms.driver', 'log');
    }

    public static function providerLabel(): string
    {
        return self::PROVIDERS[self::driver()] ?? self::driver();
    }

    public static function senderId(): string
    {
        return (string) config('services.sms.sender_id', 'PAROKIA');
    }

    /** True when messages are only simulated (written to the log or sent to a provider sandbox). */
    public static function isTestMode(): bool
    {
        return match (self::driver()) {
            'nextsms' => self::nextSmsSandbox(),
            'beem' => false,
            default => true,
        };
    }

    /**
     * Sends each [phone => text] pair and returns [phone => error|null]; null means the
     * gateway accepted it. Numbers with identical text are sent in one request.
     *
     * @param  array<string, string>  $messages
     * @return array<string, string|null>
     */
    public function send(array $messages): array
    {
        $results = [];
        $byText = [];

        foreach ($messages as $phone => $text) {
            $byText[$text][] = (string) $phone;
        }

        foreach ($byText as $text => $phones) {
            foreach (array_chunk($phones, self::BATCH_SIZE) as $batch) {
                foreach ($this->dispatch((string) $text, $batch) as $phone => $error) {
                    $results[(string) $phone] = $error;
                }
            }
        }

        return $results;
    }

    /**
     * @param  list<string>  $phones
     * @return array<string, string|null>
     */
    private function dispatch(string $text, array $phones): array
    {
        try {
            $outcome = match (self::driver()) {
                'nextsms' => $this->sendViaNextSms($text, $phones),
                'beem' => $this->sendViaBeem($text, $phones),
                default => $this->sendViaLog($text, $phones),
            };
        } catch (Throwable $exception) {
            report($exception);
            $outcome = 'Hitilafu ya mtandao: '.$exception->getMessage();
        }

        if (is_array($outcome)) {
            return $outcome;
        }

        return array_fill_keys($phones, $outcome);
    }

    /** @param list<string> $phones */
    private function sendViaLog(string $text, array $phones): ?string
    {
        Log::info('[SMS:log] '.count($phones).' recipient(s)', ['to' => $phones, 'from' => self::senderId(), 'text' => $text]);

        return null;
    }

    /**
     * Returns one error (applies to the whole batch) or a per-phone result map.
     *
     * @param  list<string>  $phones
     * @return string|array<string, string|null>
     */
    private function sendViaNextSms(string $text, array $phones): string|array
    {
        $username = config('services.sms.nextsms.username');
        $password = config('services.sms.nextsms.password');

        if (! $username || ! $password) {
            return 'NextSMS haijasanidiwa (username / password).';
        }

        $endpoint = self::NEXTSMS_BASE_URL.(self::nextSmsSandbox() ? '/test' : '').'/text/single';

        $response = Http::withBasicAuth((string) $username, (string) $password)
            ->acceptJson()
            ->timeout(30)
            ->post($endpoint, [
                'from' => self::senderId(),
                'to' => count($phones) === 1 ? $phones[0] : $phones,
                'text' => $text,
            ]);

        if (! $response->successful()) {
            return self::nextSmsError($response);
        }

        $reported = $response->json('messages');

        if (! is_array($reported) || $reported === []) {
            return self::nextSmsError($response);
        }

        $results = array_fill_keys($phones, null);

        foreach ($reported as $item) {
            $phone = (string) ($item['to'] ?? '');
            $group = strtoupper((string) ($item['status']['groupName'] ?? ''));

            if ($phone !== '' && array_key_exists($phone, $results) && in_array($group, self::NEXTSMS_FAILED_GROUPS, true)) {
                $results[$phone] = 'NextSMS: '.($item['status']['description'] ?? $item['status']['name'] ?? $group);
            }
        }

        return $results;
    }

    /** @param list<string> $phones */
    private function sendViaBeem(string $text, array $phones): ?string
    {
        $key = config('services.sms.beem.api_key');
        $secret = config('services.sms.beem.secret_key');

        if (! $key || ! $secret) {
            return 'Beem haijasanidiwa (BEEM_API_KEY / BEEM_SECRET_KEY).';
        }

        $response = Http::withBasicAuth($key, $secret)
            ->acceptJson()
            ->timeout(30)
            ->post('https://apisms.beem.africa/v1/send', [
                'source_addr' => self::senderId(),
                'encoding' => 0,
                'schedule_time' => '',
                'message' => $text,
                'recipients' => array_map(
                    fn (string $phone, int $index) => ['recipient_id' => $index + 1, 'dest_addr' => $phone],
                    $phones,
                    array_keys($phones),
                ),
            ]);

        if ($response->successful() && $response->json('successful') === true) {
            return null;
        }

        return (string) ($response->json('message') ?? $response->json('data.message') ?? 'Beem ilikataa ombi (HTTP '.$response->status().').');
    }

    private static function nextSmsSandbox(): bool
    {
        return config('services.sms.nextsms.environment') === 'sandbox';
    }

    private static function nextSmsError(Response $response): string
    {
        if ($response->status() === 401) {
            return 'NextSMS imekataa username au password (HTTP 401).';
        }

        $detail = $response->json('requestError.serviceException.text')
            ?? $response->json('requestError.policyException.text')
            ?? $response->json('message')
            ?? $response->json('error');

        return 'NextSMS ilikataa ombi'.(is_string($detail) && $detail !== '' ? ": {$detail}" : ' (HTTP '.$response->status().').');
    }
}

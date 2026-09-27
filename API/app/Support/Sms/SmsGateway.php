<?php

namespace App\Support\Sms;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class SmsGateway
{
    private const BATCH_SIZE = 100;

    public static function driver(): string
    {
        return (string) config('services.sms.driver', 'log');
    }

    public static function senderId(): string
    {
        return (string) config('services.sms.sender_id', 'PAROKIA');
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
                $error = $this->dispatch((string) $text, $batch);

                foreach ($batch as $phone) {
                    $results[$phone] = $error;
                }
            }
        }

        return $results;
    }

    /** @param list<string> $phones */
    private function dispatch(string $text, array $phones): ?string
    {
        try {
            return match (self::driver()) {
                'beem' => $this->sendViaBeem($text, $phones),
                default => $this->sendViaLog($text, $phones),
            };
        } catch (Throwable $exception) {
            report($exception);

            return 'Hitilafu ya mtandao: '.$exception->getMessage();
        }
    }

    /** @param list<string> $phones */
    private function sendViaLog(string $text, array $phones): ?string
    {
        Log::info('[SMS:log] '.count($phones).' recipient(s)', ['to' => $phones, 'from' => self::senderId(), 'text' => $text]);

        return null;
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
}

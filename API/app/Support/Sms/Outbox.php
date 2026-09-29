<?php

namespace App\Support\Sms;

use App\Models\Message;
use App\Models\MessageRecipient;

/**
 * Sends a message's SMS and keeps its recipient rows and totals in step, so every
 * SMS (composed or automatic) shows up the same way in the Arifa na SMS history.
 */
class Outbox
{
    public const NAME_PLACEHOLDER = '{jina}';

    /** @param list<array<string, mixed>> $recipients */
    public static function deliverSms(Message $message, array $recipients): void
    {
        if ($recipients === []) {
            return;
        }

        $texts = [];
        foreach ($recipients as $recipient) {
            $texts[$recipient['phone']] = self::render($message->body, $recipient['name']);
        }

        $results = app(SmsGateway::class)->send($texts);
        $now = now();

        foreach (array_chunk($recipients, 500) as $chunk) {
            MessageRecipient::query()->insert(array_map(function (array $recipient) use ($message, $results, $now) {
                $error = self::errorFor($results, $recipient['phone']);

                return [
                    ...$recipient,
                    'message_id' => $message->id,
                    'channel' => 'sms',
                    'status' => $error === null ? 'sent' : 'failed',
                    'error' => $error,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }, $chunk));
        }
    }

    public static function refreshTotals(Message $message): void
    {
        $sms = $message->recipients()->where('channel', 'sms')->get(['name', 'status']);
        $sent = $sms->where('status', 'sent');
        $failed = $sms->count() - $sent->count();
        $app = $message->recipients()->where('channel', 'app')->count();

        $message->update([
            'sms_count' => $sms->count(),
            'sms_sent' => $sent->count(),
            'sms_failed' => $failed,
            'sms_segments' => $sent->sum(fn ($recipient) => Segments::count(self::render($message->body, $recipient->name))),
            'app_count' => $app,
            'status' => match (true) {
                $failed === 0 => 'sent',
                $sent->isEmpty() && $app === 0 => 'failed',
                default => 'partial',
            },
        ]);
    }

    /** @param array<string, string|null> $results  null means sent, so `??` can't be used here. */
    public static function errorFor(array $results, string $phone): ?string
    {
        return array_key_exists($phone, $results) ? $results[$phone] : 'Haikutumwa.';
    }

    public static function render(string $body, ?string $name): string
    {
        return str_replace(self::NAME_PLACEHOLDER, $name ?: 'Mpendwa', $body);
    }
}

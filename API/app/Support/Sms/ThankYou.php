<?php

namespace App\Support\Sms;

use App\Models\Message;
use App\Models\Offering;
use App\Models\User;

/** Automatic thank-you SMS for Zaka, Fungu la kumi and Shukrani. */
class ThankYou
{
    public const AUDIENCE = 'offering';

    /** @var array<string, string> Separate sentences because "fungu" takes different Swahili noun-class agreement. */
    private const RECEIVED = [
        'zaka' => 'Zaka yako ya TSh %s ya tarehe %s imepokelewa.',
        'fungu_la_kumi' => 'Fungu lako la kumi la TSh %s la tarehe %s limepokelewa.',
        'shukrani' => 'Sadaka yako ya shukrani ya TSh %s ya tarehe %s imepokelewa.',
    ];

    public static function applies(Offering $offering): bool
    {
        return in_array($offering->category, Offering::THANK_YOU_CATEGORIES, true)
            && $offering->contributor_phone !== null;
    }

    public static function send(Offering $offering, User $recordedBy): Message
    {
        $message = Message::query()->create([
            'user_id' => $recordedBy->id,
            'sender' => $recordedBy->name,
            'channel' => 'sms',
            'audience' => self::AUDIENCE,
            'audience_ids' => ['offering_id' => $offering->id],
            'audience_label' => 'SMS ya shukrani · '.Offering::CATEGORIES[$offering->category],
            'title' => null,
            'body' => self::body($offering),
            'status' => 'sending',
            'skipped_count' => 0,
        ]);

        Outbox::deliverSms($message, [[
            'recipient_type' => 'phone',
            'recipient_id' => null,
            'name' => $offering->contributor,
            'phone' => $offering->contributor_phone,
            'group_name' => $offering->jumuiya?->name,
        ]]);
        Outbox::refreshTotals($message);

        $offering->update(['thank_you_message_id' => $message->id]);

        return $message;
    }

    private static function body(Offering $offering): string
    {
        $received = sprintf(
            self::RECEIVED[$offering->category],
            number_format((float) $offering->amount),
            $offering->received_on->format('d/m/Y'),
        );

        return 'Tumsifu Yesu Kristu '.Outbox::NAME_PLACEHOLDER.'. '.$received.' Asante kwa ukarimu wako, Mungu akubariki.';
    }
}

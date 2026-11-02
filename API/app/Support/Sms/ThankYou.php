<?php

namespace App\Support\Sms;

use App\Models\Message;
use App\Models\MessageTemplate;
use App\Models\Offering;
use App\Models\User;

/** Automatic thank-you SMS after an offering is recorded with the giver's phone. */
class ThankYou
{
    public const AUDIENCE = 'offering';

    public const AMOUNT_PLACEHOLDER = '{kiasi}';

    public const DATE_PLACEHOLDER = '{tarehe}';

    /** Fallback when no thank-you template is stored yet (e.g. before migrate). */
    private const FALLBACK = [
        'sadaka' => 'Tumsifu Yesu Kristu {jina}. Sadaka yako ya ibada ya TSh {kiasi} ya tarehe {tarehe} imepokelewa. Asante kwa kushiriki, Mungu akubariki.',
        'zaka' => 'Tumsifu Yesu Kristu {jina}. Zaka yako ya TSh {kiasi} ya tarehe {tarehe} imepokelewa. Asante kwa kushiriki, Mungu akubariki.',
        'fungu_la_kumi' => 'Tumsifu Yesu Kristu {jina}. Fungu lako la kumi la TSh {kiasi} la tarehe {tarehe} limepokelewa. Asante kwa kushiriki, Mungu akubariki.',
        'majitoleo' => 'Tumsifu Yesu Kristu {jina}. Majitoleo yako ya jumuiya ya TSh {kiasi} ya tarehe {tarehe} yamepokelewa. Asante kwa kushiriki, Mungu akubariki.',
        'shukrani' => 'Tumsifu Yesu Kristu {jina}. Sadaka yako ya shukrani ya TSh {kiasi} ya tarehe {tarehe} imepokelewa. Asante kwa kushiriki, Mungu akubariki.',
        'ujenzi' => 'Tumsifu Yesu Kristu {jina}. Mchango wako wa ujenzi wa TSh {kiasi} wa tarehe {tarehe} umepokelewa. Asante kwa kushiriki, Mungu akubariki.',
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
            'topic' => $offering->category,
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

    /** Amount and date are filled here; {jina} stays for Outbox per recipient. */
    private static function body(Offering $offering): string
    {
        $template = MessageTemplate::query()
            ->where('topic', $offering->category)
            ->where('kind', MessageTemplate::KIND_THANK_YOU)
            ->where('is_default', true)
            ->value('body')
            ?? self::FALLBACK[$offering->category]
            ?? self::FALLBACK['zaka'];

        return str_replace(
            [self::AMOUNT_PLACEHOLDER, self::DATE_PLACEHOLDER],
            [
                number_format((float) $offering->amount),
                $offering->received_on->format('d/m/Y'),
            ],
            $template,
        );
    }
}

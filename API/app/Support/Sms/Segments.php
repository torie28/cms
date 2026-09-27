<?php

namespace App\Support\Sms;

class Segments
{
    private const GSM_BASIC = "@£\$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

    private const GSM_EXTENDED = '^{}\\[~]|€';

    /** Number of SMS parts the text is billed as (GSM-7: 160/153, otherwise UCS-2: 70/67). */
    public static function count(string $text): int
    {
        if ($text === '') {
            return 0;
        }

        $units = 0;
        $gsm = true;

        foreach (mb_str_split($text) as $char) {
            if (mb_strpos(self::GSM_BASIC, $char) !== false) {
                $units++;
            } elseif (mb_strpos(self::GSM_EXTENDED, $char) !== false) {
                $units += 2;
            } else {
                $gsm = false;
                break;
            }
        }

        if (! $gsm) {
            $length = mb_strlen($text);

            return $length <= 70 ? 1 : (int) ceil($length / 67);
        }

        return $units <= 160 ? 1 : (int) ceil($units / 153);
    }
}

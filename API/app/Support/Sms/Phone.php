<?php

namespace App\Support\Sms;

class Phone
{
    /**
     * International format without "+" (e.g. 255712345678), or null when the
     * number can't be dialled. Local Tanzanian forms (0712…, 712…) get 255.
     */
    public static function normalize(?string $raw): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $raw);

        if ($digits === '' || $digits === null) {
            return null;
        }

        if (str_starts_with($digits, '00')) {
            $digits = substr($digits, 2);
        }

        if (strlen($digits) === 10 && str_starts_with($digits, '0')) {
            return '255'.substr($digits, 1);
        }

        if (strlen($digits) === 9 && in_array($digits[0], ['6', '7'], true)) {
            return '255'.$digits;
        }

        if (strlen($digits) >= 10 && strlen($digits) <= 15 && ! str_starts_with($digits, '0')) {
            return $digits;
        }

        return null;
    }
}

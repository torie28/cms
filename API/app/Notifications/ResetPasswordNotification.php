<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Reset link that opens the Angular app (not the API), written in the user's
 * language. The locale is applied by User::preferredLocale() before this renders.
 */
class ResetPasswordNotification extends ResetPassword
{
    public function toMail($notifiable): MailMessage
    {
        $url = $this->resetUrl($notifiable);
        $minutes = config('auth.passwords.'.config('auth.defaults.passwords').'.expire');

        if (app()->getLocale() === 'en') {
            return (new MailMessage)
                ->subject('Reset your password')
                ->greeting("Hello {$notifiable->name},")
                ->line('We received a request to reset the password for your account.')
                ->action('Set a new password', $url)
                ->line("This link will expire in {$minutes} minutes.")
                ->line('If you did not request a password reset, you can ignore this email; your password will not change.')
                ->salutation('Regards, St. Mathias Chapel');
        }

        return (new MailMessage)
            ->subject('Badilisha nenosiri lako')
            ->greeting("Habari {$notifiable->name},")
            ->line('Tumepokea ombi la kubadilisha nenosiri la akaunti yako.')
            ->action('Weka nenosiri jipya', $url)
            ->line("Kiungo hiki kitaisha muda baada ya dakika {$minutes}.")
            ->line('Kama hukuomba kubadilisha nenosiri, puuza barua pepe hii; nenosiri lako halitabadilika.')
            ->salutation('Wako, St. Mathias Chapel');
    }

    protected function resetUrl($notifiable): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/reset-password?'.http_build_query([
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);
    }
}

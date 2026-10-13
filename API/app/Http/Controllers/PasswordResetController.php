<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\ActivityLogger;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use Throwable;

class PasswordResetController extends Controller
{
    public function forgot(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
        ]);

        // The answer is the same whether or not the address belongs to an account,
        // so the form cannot be used to discover who is registered.
        try {
            Password::sendResetLink(['email' => $data['email']]);
        } catch (Throwable $e) {
            report($e);
        }

        return response()->json([
            'message' => 'Kama barua pepe hiyo imesajiliwa, tumekutumia kiungo cha kubadilisha nenosiri.',
        ]);
    }

    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'confirmed', PasswordRule::defaults()],
        ]);

        $status = Password::reset($data, function (User $user, string $password) use ($request) {
            $user->forceFill(['password' => $password])->setRememberToken(Str::random(60));
            $user->save();

            // Sign out every device that was using the old password.
            $user->tokens()->delete();

            event(new PasswordReset($user));

            app(ActivityLogger::class)->record(
                $user,
                'reset password',
                'the system',
                'session',
                $request,
            );
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => ['Kiungo cha kubadilisha nenosiri si sahihi au kimeisha muda. Omba kiungo kipya.'],
            ]);
        }

        return response()->json([
            'message' => 'Nenosiri limebadilishwa. Ingia kwa nenosiri jipya.',
        ]);
    }
}

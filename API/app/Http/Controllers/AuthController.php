<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\Modules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('username', $credentials['username'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'username' => ['Taarifa hizo hazilingani na kumbukumbu zetu.'],
            ]);
        }

        app(ActivityLogger::class)->record(
            $user,
            'logged in',
            'the system',
            'session',
            $request,
        );

        return response()->json([
            'token' => $user->createToken('cms')->plainTextToken,
            'user' => $this->present($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        app(ActivityLogger::class)->record(
            $user,
            'logged out',
            'the system',
            'session',
            $request,
        );

        $user?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Signed out.']);
    }

    public function user(Request $request): JsonResponse
    {
        return response()->json($this->present($request->user()));
    }

    public function preferences(Request $request): JsonResponse
    {
        $data = $request->validate([
            'locale' => ['required', 'string', 'in:sw,en'],
        ]);

        $request->user()->update($data);

        return response()->json($this->present($request->user()));
    }

    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'phone' => $user->phone,
            'gender' => $user->gender,
            'locale' => $user->locale,
            'role' => $user->role,
            'role_label' => Role::query()->where('name', $user->role)->value('label'),
            'modules' => Modules::accessibleBy($user),
        ];
    }
}

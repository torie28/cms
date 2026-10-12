<?php

namespace App\Http\Controllers;

use App\Support\Noah\Noah;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NoahController extends Controller
{
    public function intro(Request $request): JsonResponse
    {
        return response()->json($this->noah($request)->intro());
    }

    public function ask(Request $request): JsonResponse
    {
        $data = $request->validate([
            'message' => ['nullable', 'string', 'max:500'],
            'topic' => ['nullable', 'string', 'max:100'],
            'path' => ['nullable', 'string', 'max:255'],
            'last_module' => ['nullable', 'string', 'max:50'],
        ]);

        return response()->json($this->noah($request)->ask(
            $data['message'] ?? '',
            $data['topic'] ?? null,
            $data['path'] ?? null,
            $data['last_module'] ?? null,
        ));
    }

    private function noah(Request $request): Noah
    {
        return new Noah($request->user(), app()->getLocale());
    }
}

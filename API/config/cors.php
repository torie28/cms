<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Only the Angular frontend may call the API from a browser. List every
    | origin it is served from in FRONTEND_URL, separated by commas.
    |
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

    'allowed_origins' => array_filter(array_map('trim', explode(',', env('FRONTEND_URL', 'http://localhost:4200,http://127.0.0.1:4200')))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Accept', 'Accept-Language', 'Authorization', 'Content-Type', 'X-Requested-With'],

    'exposed_headers' => ['Content-Disposition'],

    'max_age' => 3600,

    'supports_credentials' => false,

];

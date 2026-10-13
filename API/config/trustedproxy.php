<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Trusted Proxies
    |--------------------------------------------------------------------------
    |
    | IP addresses (comma-separated) of the reverse proxy or load balancer in
    | front of the API, or "*" to trust any. Needed so HTTPS and client IPs
    | (used for login rate limiting) are read from X-Forwarded-* headers.
    |
    */

    'proxies' => env('TRUSTED_PROXIES') ?: null,

];

<?php

// Vercel serverless entry point; the filesystem is read-only apart from /tmp.
$storage = '/tmp/storage';
foreach (['framework/cache/data', 'framework/views', 'framework/sessions', 'logs', 'app'] as $dir) {
    if (! is_dir("{$storage}/{$dir}")) {
        mkdir("{$storage}/{$dir}", 0755, true);
    }
}

require __DIR__.'/../public/index.php';

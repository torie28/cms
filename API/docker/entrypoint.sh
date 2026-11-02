#!/bin/bash
set -e

php artisan config:cache
php artisan route:cache
php artisan migrate --force --no-interaction || true

exec "$@"

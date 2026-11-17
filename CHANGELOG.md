# Changelog

All notable changes to CHRMS are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
version numbers follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html):
`MAJOR.MINOR.PATCH`, where a bug fix that changes nothing else raises only `PATCH`.

## [Unreleased]

## [0.1.0] - 2026-11-17

Security hardening ahead of real use, plus scheduled maintenance for the
production (Vercel + Supabase) setup.

### Added

- **Daily maintenance now runs on a schedule in production.** Vercel is
  serverless — there is no always-on process to run Laravel's scheduler — so the
  recycle bin was never emptied past its 30-day window and expired login tokens
  were never pruned. A new endpoint `GET /api/cron/run` (`API/routes/api.php`)
  runs `recycle:purge-expired` and `sanctum:prune-expired`, and `API/vercel.json`
  calls it once a day at 03:00 through Vercel Cron. The endpoint rejects any
  request whose bearer token does not match `CRON_SECRET`, so only the scheduler
  can trigger it.

### Changed

- **The reverse-proxy trust list is now configurable.** The API previously
  trusted the `X-Forwarded-*` headers of every hop in front of it (`*`), which is
  only safe behind a platform that strips those headers. `API/bootstrap/app.php`
  now reads `TRUSTED_PROXIES`: left blank or `*` it keeps the old behaviour, or it
  can be set to the real proxy IP(s) to lock it down.
- **Faster recycle-bin cleanup.** A new index on `activity_logs (action,
  created_at)` keeps the daily purge of expired, soft-deleted rows from scanning
  the whole table as the log grows.

### Security

- **Row Level Security is enabled on every database table.** The database is
  hosted on Supabase, which exposes a public data API using the project's
  publishable key. That API connects as the Postgres `anon`/`authenticated`
  roles — not the application's own role — and those roles could read and write
  every table directly, including `users` (password hashes) and
  `personal_access_tokens` (live login tokens), completely bypassing the Laravel
  API and its permission checks. A new migration turns on Row Level Security for
  all `public` tables and revokes `anon`/`authenticated` access, closing that
  public door. The application connects as the database owner, which bypasses Row
  Level Security, so its own behaviour is unchanged. The migration runs only on
  PostgreSQL; the SQLite database used locally and in tests has no such feature
  and is skipped.
- **The browser can no longer send data to arbitrary sites.** The
  Content-Security-Policy `connect-src` list (`src/server.ts`) ended with a
  blanket `https:`, which let the page open a connection to any HTTPS host; it now
  allows only the app's own API. In the same pass the HTTP interceptor
  (`src/app/core/auth-interceptor.ts`) was changed to attach the login token only
  to requests aimed at the API, instead of every outgoing request, so the token
  cannot leak to a third-party URL.
- **Saved API secrets are fully masked.** The settings screen showed the last
  four characters of stored third-party keys; it now shows a fixed mask that
  reveals nothing about the value (`API/app/Support/ApiSettings.php`).

_Contributed by Mario (magangs)._

## [0.0.1] - 2026-10-12

First numbered release. Until now the project carried Angular's placeholder
version `0.0.0`.

### Fixed

- **The language chosen on the login page was not saved to the account on first
  sign-in.** A user whose account had no saved language (`locale` is `null`)
  signs in. The app then tries to save the language chosen on the login page to
  `PUT /api/user/preferences`, but that request was sent before the login token
  had been written to `sessionStorage`. The HTTP interceptor
  (`src/app/core/auth-interceptor.ts`) reads the token from `sessionStorage`, so
  the request went out without an `Authorization` header and the API answered
  `401 Unauthorized`. The error was caught silently, so nothing looked broken: the
  language still applied in that browser tab, but it was never stored on the
  account. Because the stored value stayed `null`, the same failed request
  repeated on every later sign-in, and the language was lost each time the user
  opened a new tab or another device.

  `AuthService.authenticate()` (`src/app/core/auth.ts`) now writes the token to
  `sessionStorage` before it stores the user. The language request therefore
  carries the token and succeeds on the first sign-in.

  Verified by resetting the admin account's `locale` to `null`, signing in with
  a headless browser and opening every page. Before the fix the browser logged
  `401 /api/user/preferences`. After it the browser logged no errors and the
  account's `locale` was saved as `sw`.

  _Contributed by Mario (magangs)._

[Unreleased]: https://github.com/torie28/cms/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/torie28/cms/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/torie28/cms/releases/tag/v0.0.1

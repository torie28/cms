# Changelog

All notable changes to CHRMS are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
version numbers follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html):
`MAJOR.MINOR.PATCH`, where a bug fix that changes nothing else raises only `PATCH`.

## [Unreleased]

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

[Unreleased]: https://github.com/torie28/cms/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/torie28/cms/releases/tag/v0.0.1

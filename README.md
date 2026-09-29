# CHRMS — Mfumo wa Usimamizi wa Kanisa

A parish (church) management system for recording and organising parish life: its
zones (**Kanda**), small Christian communities (**Jumuiya**) and their members,
offerings (**Sadaka**), SMS/in-app notifications, and system users with
role-based access. The UI is in **Swahili by default**, with an English toggle.

The project has two parts in one repository:

| Part     | Location | Stack                                                    |
| -------- | -------- | -------------------------------------------------------- |
| Frontend | `/`      | Angular 22 (standalone components, signals, SSR), Tailwind CSS 4 |
| Backend  | `/API`   | Laravel 13 REST API, Sanctum token auth, PostgreSQL      |

---

## What the system does

### Login and access control
- Users sign in with a **username and password**. The API returns a Sanctum
  token that the frontend keeps in `sessionStorage` and sends as a
  `Bearer` header on every request (closing the tab logs you out).
- Access is granted **per module**. Every feature is a module (see the table
  below). An **admin** can open every enabled module; any other user sees only
  the modules assigned to them, plus the dashboard.
- Admins can switch whole modules off in *Mipangilio → Mipangilio ya mfumo*.
  Core modules (dashboard, settings, API settings, activity logs) cannot be
  disabled.

### Modules

| Module (key)                   | Page            | What it does |
| ------------------------------ | --------------- | ------------ |
| Muhtasari (`dashboard`)        | `/dashboard`    | Overview: totals for users, jumuiya, active members, offerings and new notifications. |
| Watumiaji (`users`)            | `/users`        | Create, edit and delete user accounts; assign each user a role (*Nyadhifa*) and the modules they may open. |
| Kanda (`kanda`)                | `/kanda`        | Parish zones and their leaders. Supports bulk import from Excel/CSV and export. |
| Jumuiya (`jumuiya`)            | `/jumuiya`      | Small Christian communities, each belonging to a kanda, with a chairperson and members (name, phone, gender). Bulk import/export of communities and members. |
| Sadaka (`sadaka`)              | `/sadaka`       | Records offerings by category (sadaka ya ibada, zaka, fungu la kumi, majitoleo ya jumuiya, shukrani, ujenzi, mengineyo) and payment method (cash, mobile, bank, cheque). Personal categories (zaka, fungu la kumi) require the giver's name; majitoleo must belong to a jumuiya. |
| Arifa na SMS (`notifications`) | `/notifications`| Send messages by **SMS**, **in-app**, or both to: everyone, selected kanda, selected jumuiya, system users, or custom phone numbers. Tracks delivery per recipient, SMS segment counts, and lets you retry failed sends. Users see in-app messages in the notification bell. |
| Mipangilio (`settings`)        | `/settings/system` | Enable/disable modules. |
| API na huduma za nje (`api_settings`) | `/settings/apis` | Credentials for external services (e.g. the Beem Africa SMS gateway), stored **encrypted** with `APP_KEY`, with a "send test" button. |
| Kumbukumbu za shughuli (`activity_logs`) | `/settings/activity-logs` | Audit trail of who did what and when. Deleted records can be **restored** from here. |

### Other behaviour worth knowing
- **Recycle bin (30 days):** users, roles, jumuiya, members and offerings are
  soft-deleted. They can be restored from the activity log for 30 days; after
  that, `php artisan recycle:purge-expired` (scheduled daily) removes them for
  good. A snapshot stays in the log so you can still see what was deleted.
- **Import / export:** Kanda, Jumuiya and Sadaka lists export to Excel, CSV,
  PDF or print. Imports accept `.xlsx/.xls/.ods/.csv` and match column headers
  in Swahili or English. A downloadable template is provided.
- **Liturgical calendar:** the header shows today's liturgical day, season,
  colour and Sunday/weekday cycle, computed locally (no internet needed).
- **Language:** Swahili is the source language. English strings live in
  `src/app/i18n/en/*`; any text missing there falls back to Swahili. Laravel
  validation messages follow the selected language (`API/lang/sw`).
- **Offline screen:** if the API becomes unreachable, the app shows an offline
  screen and reloads itself when the connection returns.
- **SMS driver:** with `SMS_DRIVER=log` (the default), messages are written to
  the Laravel log instead of being sent, which is useful for development.

---

## Running it locally

### Requirements
- Node.js 22+ and npm
- PHP 8.3+ and Composer
- PostgreSQL

### 1. Backend (Laravel API)

```bash
cd API
composer install
cp .env.example .env
php artisan key:generate
```

Edit `API/.env` to point at your PostgreSQL database:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=church_db
DB_USERNAME=root
DB_PASSWORD=
```

Then create the tables and the first admin account, and start the server:

```bash
php artisan migrate --seed
php artisan serve        # http://127.0.0.1:8000
```

The seeder creates the user **`admin` / `admin`**. Change this password after
your first login.

### 2. Frontend (Angular)

In a second terminal, from the project root:

```bash
npm install
npm start                # ng serve → http://localhost:4200
```

The frontend expects the API at `http://127.0.0.1:8000/api`
(set in `src/app/core/api.ts`).

### Useful scripts

| Command           | What it does |
| ----------------- | ------------ |
| `npm start`       | Angular dev server on port 4200 |
| `npm run api`     | Alternative way to serve the API on port 8000 from the project root |
| `npm run build`   | Production build into `dist/` |
| `npm test`        | Frontend unit tests (Vitest) |
| `npm run db:ui`   | Serves Adminer at `http://127.0.0.1:8080` for browsing the database (download `tools/adminer.php` first; it is not committed) |
| `cd API && php artisan test` | Backend tests |

---

## Project structure

```
src/app/
  core/          Services and shared logic: auth, API calls, i18n, liturgical calendar,
                 spreadsheet import/export, connectivity
  i18n/en/       English translations, one file per area
  layout/        App shell: sidebar navigation (nav.ts), header
  pages/
    login/
    dashboard/components/   One folder per module (overview, users, kanda,
                            jumuiya, sadaka, notifications, settings)
  shared/        Reusable UI pieces (icons, search box, filter panel, toggles, bell)

API/
  app/Http/Controllers/     One controller per resource
  app/Models/               Eloquent models
  app/Support/              Business rules: Modules (access), Recycle (restore/purge),
                            ActivityLogger, ApiSettings, Sms/ (gateway, audience, phone)
  database/migrations/      Schema
  routes/api.php            All API endpoints (everything except /login needs a token)
  routes/console.php        Artisan commands and the daily schedule
```

### Adding a new module
1. Add an entry to `DEFINITIONS` in `API/app/Support/Modules.php`. It appears
   automatically in System settings and in the user dialog.
2. Add the API routes and controller, and check access with
   `Modules::canAccess($user, 'your_key')`.
3. Add the page route in `src/app/app.routes.ts` with
   `canActivate: [moduleGuard('your_key')]`, and a menu entry in
   `src/app/layout/nav.ts`.
4. For a new settings sub-page, add it to
   `src/app/pages/dashboard/components/settings/settings.sections.ts`.

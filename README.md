# Vhost Manager Next.js

Realtime Next.js UI for creating local Nginx vhosts. The app uses Next.js API routes only; it does not call or require the old PHP `vhost-manager/public/index.php` app.

## Run

```sh
pnpm install
./node_modules/.bin/next dev -H 0.0.0.0 -p 3025
```

Open:

```text
http://localhost:3025
```

## Teammate Setup

Each teammate should keep their own local config:

```sh
cp config/app.env.example config/app.env.local
```

Edit `config/app.env.local`:

```text
VHOST_BASE_DIR=/home/their-user/www
VHOST_ALLOWED_BASE_DIRS=/home/their-user/www
VHOST_OWNER=their-user
VHOST_APP_USERS=their-user
```

Install sudoers once on that machine:

```sh
sudo ./bin/install-sudoers
```

Then run:

```sh
pnpm install
pnpm dev
```

Advanced: set `VHOST_MANAGER_CONFIG=/absolute/path/to/app.env.local` to load a config from another location.

## Notes

- Reads config from `config/app.env.local` first, then `config/app.env`.
- Runs the local helper at `bin/vhostctl`.
- Shows a first-open project root picker and stores the choice in browser local storage.
- Supports English/Khmer language switching with visible language marks.
- Uses Figtree for English UI and Hanuman for Khmer UI.
- Supports light/dark mode and remembers the browser choice.
- Supports roots like `/home/wintech/www/ums` or `/home/wintech/www/school` when they are inside `VHOST_ALLOWED_BASE_DIRS`.
- Streams create/remove command output from `/api/stream`.
- Reads current folders/sites/PHP-FPM versions from `/api/state` using Node.js.
- Lists PHP-FPM versions available from apt, not only currently running sockets.
- Supports `No PHP-FPM / static` for projects that do not need PHP.
- Requires sudoers permission for the user running Next.js to execute `bin/vhostctl`.

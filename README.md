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

Optional clean local URL:

```sh
sudo cp config/nginx.vhost-manager-shell /etc/nginx/sites-available/vhost-manager-shell
sudo cp config/nginx.vhost-manager-shell /etc/nginx/sites-enabled/vhost-manager-shell
echo "127.0.0.1 vhost-manager-shell" | sudo tee -a /etc/hosts
sudo nginx -t
sudo systemctl reload nginx
```

Then open:

```text
http://vhost-manager-shell
```

## Backend Agent

For Vercel or any hosted frontend, each teammate runs the backend agent on their own machine:

```sh
cd /path/to/vhost-manager-next
pnpm agent
```

From any directory, use pnpm's `--dir` option:

```sh
pnpm --dir /path/to/vhost-manager-next agent
```

Or install the global wrapper once:

```sh
sudo ./bin/install-agent-command
vhost-manager-agent
```

Default agent URL:

```text
http://127.0.0.1:3036
```

The frontend can connect to it in two ways:

- Click `Backend` in the UI and enter `http://127.0.0.1:3036`.
- Or set `NEXT_PUBLIC_VHOST_API_URL=http://127.0.0.1:3036` before building/deploying the frontend.

Optional token:

```sh
VHOST_AGENT_TOKEN=change-me pnpm agent
```

Then enter the same token in the UI Backend modal, or set `NEXT_PUBLIC_VHOST_API_TOKEN`.

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

For hosted UI + local backend:

```sh
cd /path/to/vhost-manager-next
pnpm agent
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

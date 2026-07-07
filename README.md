# ClickPrintBot

A WhatsApp bot (built on [whatsapp-web.js](https://wwebjs.dev/)) that acts as a
middleman between users and the [ClickPrint](https://github.com/WeCodePK/ClickPrintBackend)
print-management backend.

```
User  ⇄  WhatsApp  ⇄  ClickPrintBot  ⇄  ClickPrint backend
```

Users upload files, choose print settings, pick a shop, get a price quote, and
place print jobs — all through fixed `/commands` (no natural-language guessing).

## Features

- 📤 **Upload files** — send an image or document and it's uploaded to the backend
  and added to your current *draft*.
- ⚙️ **Print settings** — per-file colour, copies, sidedness, orientation, page
  selection, pages-per-sheet and page type via `/set`.
- 🏪 **Shops** — browse shops and pick one for your order.
- 🧾 **Quote & confirm** — see a costed quote before you commit, then submit.
- 📦 **Jobs** — list your active jobs and cancel them.
- 👤 **Profile** — view your name & balance, and rename yourself.

## How it works

- **Auth** — each user is authenticated by their WhatsApp phone number. The bot
  calls `POST /auth/token { number }` once, then caches the returned forever-token
  in Redis (`token:<number>`) for all future requests. A `401` triggers a single
  automatic token refresh.
- **Drafts** — a *draft* is an in-progress order. Uploading a file creates or
  extends the user's active draft (its id is stored in Redis as `draft:<number>`).
  Selecting a shop or changing settings edits the same draft. `/check` prices it,
  `/confirm` submits it into a job.
- **Numbered lists** — when the bot shows a numbered list (shops, jobs) it caches
  the ordered ids in Redis so `/shop 2` or `/cancel 1` resolve by position.

## Commands

| Command | Description |
| --- | --- |
| *(send a file)* | Upload an image/document and add it to your draft |
| `/help` | Show all commands |
| `/profile` | View your name & balance |
| `/name <new name>` | Change your name |
| `/draft` | Show your current draft |
| `/files` | List files in your draft |
| `/set <file#> <option> <value>` | Change a file's print settings |
| `/removefile <file#>` | Remove a file from the draft |
| `/shops` | List available shops |
| `/shop <number>` | Pick a shop for your draft |
| `/canceldraft` | Discard the current draft |
| `/check` | Price quote for the draft |
| `/confirm` | Submit the order |
| `/jobs` | List your active jobs |
| `/cancel <number>` | Cancel a job |

### `/set` options

| Option | Values | Setting |
| --- | --- | --- |
| `color` | `on` / `off` | colour vs black & white |
| `copies` | number ≥ 1 | number of copies |
| `sided` | `single` / `double` / `short` | single-sided, or double-sided on the long (`double`) or short edge |
| `orientation` | `portrait` / `landscape` | page orientation |
| `pages` | e.g. `1-3,5` (blank = all) | page selection |
| `perpage` | number ≥ 1 | pages per sheet |
| `type` | e.g. `A4` | page/paper type |

Example: `/set 1 color on`

## Setup

### Prerequisites

- Node.js 18+ (developed on Node 24)
- A running **Redis** instance
- A WhatsApp account to link the bot to

### Install & run

```bash
npm install
cp .env.example .env   # then edit .env
npm start
```

On first run a QR code prints in the terminal — scan it from WhatsApp
(**Settings → Linked Devices → Link a Device**). The session is persisted under
`.wwebjs_auth/` so you only scan once.

### Run with Docker (recommended)

The compose stack runs the bot **and** its Redis dependency together:

```bash
docker compose up --build
```

On first start, watch the logs for the QR code and scan it from WhatsApp
(**Settings → Linked Devices → Link a Device**):

```bash
docker compose logs -f bot
```

The WhatsApp session is stored in the `wweb-auth` volume and Redis data in
`redis-data`, so both survive restarts — you only scan the QR once. Run it
detached once linked:

```bash
docker compose up -d --build
```

Override the backend URL (and other settings) via the shell or a `.env` file
next to `docker-compose.yml`:

```bash
CLICKPRINT_API_URL=http://localhost:3000 docker compose up
```

> The Docker image bundles the Chromium that `whatsapp-web.js` drives, so no
> host browser is needed. Redis is reached at `redis://redis:6379` inside the
> network — you don't run Redis separately.

### Configuration (`.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `CLICKPRINT_API_URL` | `https://clickprintbackend.wckd.pk` | Backend base URL (`http://localhost:3000` for dev) |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection string |
| `TOKEN_TTL_SECONDS` | `2592000` | How long to cache a user's token (safety-net refresh) |
| `WWEBJS_CLIENT_ID` | `clickprint` | LocalAuth session id |
| `WWEBJS_DATA_PATH` | *(unset)* | Where the WhatsApp session is stored (`/data` in Docker) |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |

## Project structure

```
src/
  index.js     WhatsApp client wiring (QR, lifecycle, message events)
  router.js    Parses messages, routes to media/command handlers
  handlers.js  Command handlers + media upload flow
  api.js       Backend API client (auth token cache, all endpoints)
  draft.js     Draft-building helpers (add/edit/remove files, set shop)
  session.js   Redis-backed state (active draft, list caches, per-user lock)
  settings.js  Parser/validator for /set options
  format.js    WhatsApp message formatting
  config.js    Env-driven configuration
  redis.js     Redis client
  logger.js    Tiny leveled logger
```

## Notes

- Real-time job status push (via the backend event stream) is **not** wired up —
  that stream is for shops, not users. Users pull their status with `/jobs`.
- Albums arrive as a burst of separate media messages; per-user processing is
  serialised so concurrent draft edits don't race.
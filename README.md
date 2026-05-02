# Lobster

Discord bot that tracks ongoing Among Us lobbies and notifies #vanilla-game-chat
when a game enters lobby. The bot watches Discord presences for the Among Us
activity and reacts to state transitions (`In Menus` → `In Lobby` etc.) to
auto-announce, queue, and confirm lobbies.

## Prerequisites

- Node.js >= 18.17
- MySQL 8.x (or a MariaDB equivalent)
- A Discord bot token with the Server Members + Presence + Message Content
  intents enabled
- A `secret.mjs` file one directory **above** this repo, exporting the MySQL
  connection config:

  ```js
  // ../secret.mjs (sibling of this folder)
  export const LobsterConfig = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
  ```

## Setup

```bash
cp .env.example .env   # then fill in the values
npm install
npm start              # runs node index.mjs
```

The first boot creates every table the bot uses (see `bot/system.mjs#tables`)
and immediately rehydrates the in-memory lobby state from MySQL.

## Layout

```
core/         Bootstrap, Database (mysql2 with parameterised queries),
              Controller base class, Discord client, error/warn helpers
bot/          Lobster (Discord event handlers), Parser, System (boot / table
              creation / slash-command registration)
controllers/  one file per top-level command — !lob <controller> <method>
models/       MySQL-backed model classes
views/        text/embed templates rendered by Controller#post
tools/        small utilities (Time, random, gif, embed)
utils/        shell scripts the bot can run (pull, reboot, backup)
```

## Command surface

`!lob <controller> <method> [key:value | positional]...`

For the `lobby` controller, useful methods include `create`, `delete`, `queue`,
`unqueue`, `list`, `announce`, `unannounce`. There are also short aliases —
e.g. `!lob join <code>` is the same as `!lob lobby queue <code>`.

## Slash commands

Run `npm run deploy:slash` (or use the legacy `slash-deploy.js`) to register
the `/lob` and `/ping` commands against the configured guild.

## Operational notes

- The schema lives in code (`bot/system.mjs#tables`); any change there is
  applied on next boot via `CREATE TABLE IF NOT EXISTS`. There is no
  migration tool yet — column additions are safe, but renames need a manual
  step in MySQL.
- `lobby_controller.clearOld` runs every 10 seconds and deletes lobbies whose
  `pingtime` is older than 180000 seconds. It now also clears the matching
  in-memory entry, so the cache and DB stay aligned.
- `manage sql` is intentionally disabled — it used to accept arbitrary SQL
  from a Discord message. Add a named operation if you need one.

## Security

- Every SQL query goes through `mysql2`'s `?`/`??` placeholders.
- `bot/parser.mjs` rejects controller/method names that contain anything
  outside `[a-z0-9_]`, and it denylists every property on `Object.prototype`
  to keep `!lob lobby constructor` and similar from reaching `eval`.
- `core/error.mjs` writes log lines via `fs.appendFile` rather than shelling
  out, so a backtick or `$()` in an error message is inert.

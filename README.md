# Mankai Server

A self-hosted manga server with an admin dashboard that implements the [Mankai HTTP API](https://mankai.app/api/http-api/) for the [Mankai](https://github.com/mankai-app/mankai) manga reader.

Point the Mankai app at `http://<host>:3000/api`, sign in, and your library and reading progress sync across devices.

## Features

- Full Mankai API support: server info, JWT auth, manga browsing, search, suggestions, and the in-app [editor API](https://mankai.app/api/editor-api/).
- Web admin dashboard for managing manga, chapter groups, chapters, page images, covers, and users.
- Semantic search and autocomplete powered by local sentence embeddings (`Xenova/bge-m3`) indexed with pgvector.
- Installed plugins, browsable plugins, reading progress, and saved-library sync with an incremental endpoint.
- PostgreSQL + pgvector in production, or embedded PGlite for zero-config setups.
- JWT Bearer tokens for the app, session cookies for the dashboard, and auto-generated API keys per user.

## Quick start (Docker Compose)

`docker-compose.yml` runs the server alongside a `pgvector/pgvector:pg18` Postgres instance.

1. Edit `docker-compose.yml` and change the placeholder secrets under the `app` service's `environment` block:

```yaml
environment:
  SESSION_SECRET: changeme123-make-sure-it-is-at-least-32-characters
  JWT_SECRET: changeme123-make-sure-it-is-at-least-32-characters
  SERVER_ID: mankai-server
  ADMIN_EMAIL: admin@mankai.local
  ADMIN_PASSWORD: changeme123
  # Optional, takes precedence over ADMIN_PASSWORD. Escape each $ as $$.
  # ADMIN_PASSWORD_HASH: "$$argon2id$$..."
  # BASE_API_URL: https://api.example.app
  # EMBEDDING_QUANTIZED: "0"
  # FORCE_SECURE_COOKIE: "true"
  # LOG_LEVEL: debug
```

2. Build and start:

```bash
docker compose up -d --build
```

On startup the container runs migrations, seeds the admin user from `ADMIN_EMAIL` and either `ADMIN_PASSWORD_HASH` or `ADMIN_PASSWORD` (idempotent), and serves the app on port 3000.

`ADMIN_PASSWORD_HASH` takes precedence when both are set and is stored directly without rehashing. It must be a valid password hash supported by [Bun.password.verify](https://bun.sh/docs/runtime/hashing), such as Argon2 or bcrypt. An invalid hash stops admin seeding. If no hash is provided, `ADMIN_PASSWORD` must contain at least 8 characters.

Generate a hash with Bun, escaped for use in `docker-compose.yml`:

```bash
bun -e 'console.log((await Bun.password.hash("your-password-here")).replaceAll("$", () => "$$"))'
```

3. Open `http://localhost:3000` for the dashboard, or add a server in the Mankai app with base URL `http://<host>:3000/api`.

Data is persisted on the host under `./data`.

```bash
docker compose logs -f app
docker compose restart app
docker compose down
```

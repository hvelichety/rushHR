# Deploy queue API to Railway

The queue backend (`backend/`) is a separate Node service from your Flask app. It uses the **same Postgres** database as your restaurants.

## 1. Create a new Railway service

1. Open your Railway project (same project as Postgres + Flask is fine).
2. **New → GitHub Repo** (or Empty Service) and connect this repo.
3. Set **Root Directory** to `backend`.
4. Railway will detect Node and run `npm start`.

## 2. Environment variables

On the **queue service** (not Postgres), add:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Reference your Postgres service → `DATABASE_URL` (internal URL is fine) |
| `PORT` | Railway sets this automatically |

Do **not** commit `backend/.env` — use Railway's variable UI.

## 3. Deploy & get URL

After deploy succeeds:

1. Open the queue service → **Settings → Networking → Generate Domain**
2. Copy the URL, e.g. `https://rushhr-queue-production.up.railway.app`
3. Test: `curl https://YOUR-URL/health`

## 4. Point the mobile app at Railway

In `restaurant-mobile/.env`:

```env
EXPO_PUBLIC_QUEUE_API_URL=https://YOUR-QUEUE-SERVICE.up.railway.app
```

Restart Expo (`npm start` → press `r` to reload).

## 5. You can stop the local server

No need for `npm run queue:backend` on your Mac anymore once Railway is working.

## Troubleshooting

- **502 / crash on start**: Check deploy logs — usually missing `DATABASE_URL`.
- **Empty locations**: Run health check; migrations run automatically on startup.
- **Phone can't connect**: Use the public Railway HTTPS URL, not `localhost`.

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
| `VAPI_API_KEY` | From [dashboard.vapi.ai](https://dashboard.vapi.ai) → API Keys |
| `VAPI_ASSISTANT_ID` | RushHour Assistant ID |
| `VAPI_PHONE_NUMBER_ID` | Your Twilio/Vapi outbound number ID |
| `VAPI_WEBHOOK_URL` | `https://YOUR-QUEUE-SERVICE.up.railway.app/webhooks/vapi` |
| `YELP_API_KEY` | From [Yelp Developers](https://www.yelp.com/developers/v3/manage_app) — powers automatic restaurant discovery |

Do **not** commit `backend/.env` — use Railway's variable UI.

### Restaurant auto-discovery (Yelp)

With `YELP_API_KEY` set, the app calls `GET /restaurants?sync=1&lat=…&lng=…` on load. The backend:

1. Searches Yelp for **sit-down restaurants** near you (or `location=New York, NY` when searching a city)
2. Skips chains (Shake Shack, McDonald's, etc.) and fast-food Yelp categories
3. Upserts into Postgres (cached ~24h per area so you don't burn API quota)

Manual rows (Test, SriRangam) stay — they have no `yelp_id`.

Force refresh: `POST /restaurants/sync` with `{ "lat": 40.46, "lng": -74.66, "force": true }`

Force refresh: `POST /restaurants/sync` with `{ "lat": 40.46, "lng": -74.66, "force": true }`

Also set the same webhook URL on the Vapi assistant (**Advanced → Server URL**).

### Vapi system prompt (one-time)

The API sends `call_behavior_rules` on every call so the agent handles "anything else?" without re-reading the whole order. Add this to your **RushHour assistant system prompt** in [dashboard.vapi.ai](https://dashboard.vapi.ai) (near the top, after your role description):

```
{{call_behavior_rules}}
```

Keep your existing `{{user_question}}` and `{{restaurant_name}}` variables. Without `{{call_behavior_rules}}` in the dashboard prompt, the backend rules are sent but the model will not see them.

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

The Home tab loads restaurants from **`GET /restaurants?sync=1`** (Yelp auto-discovery + Postgres cache). Restart Expo after changing env.

### Restaurant catalog behavior

| Query param | Effect |
|-------------|--------|
| `sync=1` | Pull new restaurants from Yelp (cached ~24h per area) |
| `lat`, `lng` | Adds `distance_miles` and sorts nearest-first |
| `location` | Discover by city, e.g. `New York, NY` (trip planning) |
| `radius` | Only when user enables **Nearby only** (30 mi) |
| `q`, `city` | Filter by name, cuisine, city |

Fast-food chains (Shake Shack, McDonald's, etc.) are filtered out automatically. Set `call_eligible = false` on a row to hide it manually.

## 5. You can stop the local server

No need for `npm run queue:backend` on your Mac anymore once Railway is working.

### Healthcheck failed?

Almost always **`DATABASE_URL` is missing** on this service.

1. Open your **Postgres** service → **Variables** → copy `DATABASE_URL`  
   OR use **Add Reference Variable** on the queue service.
2. On the **queue service** → **Variables** → **New Variable**  
   - Name: `DATABASE_URL`  
   - Value: `${{ Postgres.DATABASE_URL }}` (pick your Postgres service from the dropdown)
3. Redeploy.

Check **Deploy Logs** for `DATABASE_URL is not set` or `Database init failed`.

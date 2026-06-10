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

Also set the same webhook URL on the Vapi assistant (**Advanced → Server URL**).

### Vapi system prompt (one-time)

The API sends `call_behavior_rules` on every call so the agent handles "anything else?" without re-reading the whole order. Add this to your **RushHour assistant system prompt** in [dashboard.vapi.ai](https://dashboard.vapi.ai) (near the top, after your role description):

```
{{call_behavior_rules}}
```

Keep your existing `{{user_question}}` and `{{restaurant_name}}` variables. Without `{{call_behavior_rules}}` in the dashboard prompt, the backend rules are sent but the model will not see them.

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

### Healthcheck failed?

Almost always **`DATABASE_URL` is missing** on this service.

1. Open your **Postgres** service → **Variables** → copy `DATABASE_URL`  
   OR use **Add Reference Variable** on the queue service.
2. On the **queue service** → **Variables** → **New Variable**  
   - Name: `DATABASE_URL`  
   - Value: `${{ Postgres.DATABASE_URL }}` (pick your Postgres service from the dropdown)
3. Redeploy.

Check **Deploy Logs** for `DATABASE_URL is not set` or `Database init failed`.

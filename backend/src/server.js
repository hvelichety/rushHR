import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb, pingDb } from './db.js';
import {
  getLocations,
  getLocation,
  getLocationQueue,
  joinQueue,
  getQueueStatus,
  callNextCustomer,
  customerCheckIn,
  requestExtension,
  markServed,
  markNoShow,
  removeEntry,
  verifyCheckInCode,
  updateLocationSettings,
  processExpiredDeadlines,
  collectPendingNotifications,
  getActiveEntriesForDevice,
} from './queueService.js';
import { createVoiceCall, getVoiceCall, handleVapiWebhook } from './vapiService.js';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const pendingNotifications = [];

function enqueueNotifications(notifications) {
  if (!notifications?.length) return;
  for (const n of notifications) {
    pendingNotifications.push({
      ...n,
      id: `${Date.now()}-${Math.random()}`,
      createdAt: new Date().toISOString(),
    });
  }
}

setInterval(async () => {
  try {
    await processExpiredDeadlines();
    const statusNotifications = await collectPendingNotifications();
    enqueueNotifications(statusNotifications);
  } catch (err) {
    console.error('Background queue job error:', err.message);
  }
}, 5000);

app.post('/calls', async (req, res) => {
  try {
    const { restaurantId, question, questionForRestaurant, deviceId, pushToken } = req.body;
    const resolvedQuestion = questionForRestaurant ?? question;

    if (!restaurantId || !resolvedQuestion?.trim()) {
      return res.status(400).json({
        error: 'restaurantId and question (or questionForRestaurant) are required',
      });
    }

    const call = await createVoiceCall({
      restaurantId: Number(restaurantId),
      questionForRestaurant: resolvedQuestion,
      deviceId,
      pushToken,
    });

    res.status(201).json(call);
  } catch (err) {
    const body = { error: err.message };
    if (err.vapiDetails) body.vapiDetails = err.vapiDetails;
    res.status(400).json(body);
  }
});

app.get('/calls/:callId', async (req, res) => {
  try {
    const call = await getVoiceCall(Number(req.params.callId));
    if (!call) return res.status(404).json({ error: 'Call not found' });
    res.json(call);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/webhooks/vapi', async (req, res) => {
  try {
    const result = await handleVapiWebhook(req.body);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Vapi webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', async (_req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      status: 'error',
      service: 'rushhr-queue',
      error: 'DATABASE_URL is not set on this Railway service',
    });
  }
  try {
    await pingDb();
    res.json({
      status: 'ok',
      service: 'rushhr-queue',
      database: 'connected',
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      service: 'rushhr-queue',
      error: err.message,
    });
  }
});

app.get('/locations', async (req, res) => {
  try {
    const includeAll = req.query.all === '1' || req.query.all === 'true';
    res.json(await getLocations({ includeAll }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/locations/:locationId/queue', async (req, res) => {
  try {
    const locationId = Number(req.params.locationId);
    const location = await getLocation(locationId);
    if (!location) return res.status(404).json({ error: 'Location not found' });

    res.json({
      location,
      queue: await getLocationQueue(locationId),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/queue/active', async (req, res) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ error: 'deviceId is required' });
    }
    res.json(await getActiveEntriesForDevice(deviceId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/queue/join', async (req, res) => {
  try {
    const { locationId, customerName, customerContact, partySize, deviceId, pushToken } = req.body;

    if (!locationId || !customerName?.trim() || !customerContact?.trim()) {
      return res.status(400).json({ error: 'locationId, customerName, and customerContact are required' });
    }

    const entry = await joinQueue({
      locationId: Number(locationId),
      customerName: customerName.trim(),
      customerContact: customerContact.trim(),
      partySize,
      deviceId,
      pushToken,
    });

    const statusNotifications = await collectPendingNotifications();
    enqueueNotifications(statusNotifications);

    res.status(201).json(entry);
  } catch (err) {
    if (err.code === 'ALREADY_IN_QUEUE') {
      return res.status(409).json({
        error: err.message,
        code: err.code,
        existingEntryId: err.existingEntryId,
      });
    }
    if (err.code === 'MAX_QUEUES_REACHED') {
      return res.status(409).json({ error: err.message, code: err.code });
    }
    res.status(400).json({ error: err.message });
  }
});

app.get('/queue/:entryId/status', async (req, res) => {
  try {
    const entry = await getQueueStatus(Number(req.params.entryId));
    if (!entry) return res.status(404).json({ error: 'Queue entry not found' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/queue/:entryId/check-in', async (req, res) => {
  try {
    res.json(await customerCheckIn(Number(req.params.entryId)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/queue/:entryId/extension', async (req, res) => {
  try {
    res.json(await requestExtension(Number(req.params.entryId)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/locations/:locationId/call-next', async (req, res) => {
  try {
    const result = await callNextCustomer(Number(req.params.locationId));
    if (result.notification) enqueueNotifications([result.notification]);
    res.json(result.entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/queue/:entryId/served', async (req, res) => {
  try {
    res.json(await markServed(Number(req.params.entryId)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/queue/:entryId/no-show', async (req, res) => {
  try {
    res.json(await markNoShow(Number(req.params.entryId)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/locations/:locationId/verify-code', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: 'code is required' });
    res.json(await verifyCheckInCode(Number(req.params.locationId), code));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/queue/:entryId', async (req, res) => {
  try {
    res.json(await removeEntry(Number(req.params.entryId)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/locations/:locationId/settings', async (req, res) => {
  try {
    res.json(
      await updateLocationSettings(Number(req.params.locationId), {
        isQueueOpen: req.body.isQueueOpen,
        averageServiceTimeMinutes: req.body.averageServiceTimeMinutes,
      })
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/notifications/pending', async (req, res) => {
  try {
    const { deviceId } = req.query;
    const relevant = deviceId
      ? (
          await Promise.all(
            pendingNotifications.map(async (n) => {
              const entry = await getQueueStatus(n.entryId);
              return entry?.deviceId === deviceId ? n : null;
            })
          )
        ).filter(Boolean)
      : pendingNotifications;

    res.json(relevant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/notifications/pending', (req, res) => {
  const { ids } = req.body;
  if (Array.isArray(ids)) {
    for (let i = pendingNotifications.length - 1; i >= 0; i--) {
      if (ids.includes(pendingNotifications[i].id)) {
        pendingNotifications.splice(i, 1);
      }
    }
  }
  res.json({ cleared: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Queue API listening on port ${PORT}`);
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set — add it in Railway Variables');
    return;
  }
  initDb().catch((err) => console.error('❌ Database init failed:', err.message));
});

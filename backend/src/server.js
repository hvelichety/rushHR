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
import {
  clearPendingNotifications,
  enqueueNotifications,
  getPendingNotificationsForDevice,
} from './notificationQueue.js';
import { createVoiceCall, getVoiceCall, getVoiceCallsForDevice, handleVapiWebhook } from './vapiService.js';
import { getRestaurantById, listRestaurants } from './restaurantService.js';
import { syncRestaurantsFromYelp } from './restaurantDiscovery.js';
import { findRestaurantsBySearch } from './restaurantSearchService.js';
import {
  bookTimeSlot,
  cancelBooking,
  closeTimeSlot,
  createTimeSlot,
  getActiveBookingForDevice,
  getBookingById,
  getBookingsForSlot,
  getTimeSlotById,
  getTimeSlotsForRestaurant,
  markBookingArrived,
  markBookingNoShow,
  updateTimeSlot,
} from './timeSlotService.js';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

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

app.get('/calls', async (req, res) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ error: 'deviceId is required' });
    }
    res.json(await getVoiceCallsForDevice(deviceId));
  } catch (err) {
    res.status(500).json({ error: err.message });
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

app.get('/restaurants/search', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    if (q.trim().length < 2) {
      return res.status(400).json({ error: 'q must be at least 2 characters' });
    }

    const payload = await findRestaurantsBySearch({
      q,
      lat: req.query.lat,
      lng: req.query.lng,
    });

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/restaurants', async (req, res) => {
  try {
    const { restaurants, discovery, searchFetch } = await listRestaurants({
      lat: req.query.lat,
      lng: req.query.lng,
      radius: req.query.radius,
      q: req.query.q,
      city: req.query.city,
      location: req.query.location,
      cuisine: req.query.cuisine,
      sort: req.query.sort,
      sync: req.query.sync,
      fetch: req.query.fetch,
    });

    if (discovery?.imported != null && !discovery.skipped) {
      res.set('X-Restaurants-Imported', String(discovery.imported));
    }
    if (searchFetch?.imported != null && !searchFetch.skipped) {
      res.set('X-Restaurants-Search-Imported', String(searchFetch.imported));
    }
    if (discovery?.error) {
      res.set('X-Restaurants-Sync-Error', discovery.error);
    }
    if (searchFetch?.error) {
      res.set('X-Restaurants-Search-Error', searchFetch.error);
    }

    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/restaurants/sync', async (req, res) => {
  try {
    const { lat, lng, location, force } = { ...req.query, ...req.body };
    const result = await syncRestaurantsFromYelp({
      lat,
      lng,
      location,
      force: force === true || force === '1' || force === 'true' || force === 'force',
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await getRestaurantById(Number(req.params.id), {
      lat: req.query.lat,
      lng: req.query.lng,
    });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(restaurant);
  } catch (err) {
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
      ? await getPendingNotificationsForDevice(String(deviceId), { getQueueStatus })
      : await getPendingNotificationsForDevice(null, { getQueueStatus });

    res.json(relevant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/notifications/pending', (req, res) => {
  const { ids } = req.body;
  clearPendingNotifications(ids);
  res.json({ cleared: true });
});

// --- TimeSlots (scheduled arrival) ---

app.get('/locations/:locationId/time-slots', async (req, res) => {
  try {
    const locationId = Number(req.params.locationId);
    const location = await getLocation(locationId);
    if (!location) return res.status(404).json({ error: 'Location not found' });

    const slots = await getTimeSlotsForRestaurant(locationId, {
      from: req.query.from,
      to: req.query.to,
    });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/time-slots', async (req, res) => {
  try {
    const { restaurantId, startTime, endTime, capacity } = req.body;
    if (!restaurantId) return res.status(400).json({ error: 'restaurantId is required' });

    const slot = await createTimeSlot(Number(restaurantId), {
      startTime,
      endTime,
      capacity,
    });
    res.status(201).json(slot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/time-slots/:slotId', async (req, res) => {
  try {
    const slot = await updateTimeSlot(Number(req.params.slotId), {
      capacity: req.body.capacity,
      status: req.body.status,
    });
    res.json(slot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/time-slots/:slotId/close', async (req, res) => {
  try {
    res.json(await closeTimeSlot(Number(req.params.slotId)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/time-slots/:slotId/bookings', async (req, res) => {
  try {
    res.json(await getBookingsForSlot(Number(req.params.slotId)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/time-slots/:slotId/book', async (req, res) => {
  try {
    const { customerName, phoneNumber, partySize, deviceId } = req.body;
    const booking = await bookTimeSlot({
      timeSlotId: Number(req.params.slotId),
      customerName,
      phoneNumber,
      partySize,
      deviceId,
    });
    res.status(201).json(booking);
  } catch (err) {
    if (err.code === 'ALREADY_BOOKED') {
      return res.status(409).json({
        error: err.message,
        code: err.code,
        existingBookingId: err.existingBookingId,
      });
    }
    res.status(400).json({ error: err.message });
  }
});

app.get('/time-slot-bookings/active', async (req, res) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ error: 'deviceId is required' });
    }
    const booking = await getActiveBookingForDevice(deviceId);
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/time-slot-bookings/:bookingId', async (req, res) => {
  try {
    const booking = await getBookingById(Number(req.params.bookingId));
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/time-slot-bookings/:bookingId/cancel', async (req, res) => {
  try {
    const booking = await cancelBooking(Number(req.params.bookingId), {
      deviceId: req.body.deviceId,
    });
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/time-slot-bookings/:bookingId/arrived', async (req, res) => {
  try {
    res.json(await markBookingArrived(Number(req.params.bookingId)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/time-slot-bookings/:bookingId/no-show', async (req, res) => {
  try {
    res.json(await markBookingNoShow(Number(req.params.bookingId)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Queue API listening on port ${PORT}`);
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set — add it in Railway Variables');
    return;
  }
  initDb().catch((err) => console.error('❌ Database init failed:', err.message));
});

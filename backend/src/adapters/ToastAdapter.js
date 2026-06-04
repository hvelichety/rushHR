import { POSAdapter } from './POSAdapter.js';

/**
 * Toast POS adapter placeholder — integrate when Toast API credentials are available.
 */
export class ToastAdapter extends POSAdapter {
  constructor(_config = {}) {
    super();
  }

  async getToastWaitTime(locationId) {
    // TODO: Fetch live wait time from Toast API
    console.log('[ToastAdapter] getToastWaitTime stub for location', locationId);
    return null;
  }

  async syncQueueToToast(locationId) {
    // TODO: Push local queue state to Toast waitlist
    console.log('[ToastAdapter] syncQueueToToast stub for location', locationId);
    return { synced: false };
  }

  async syncToastToQueue(locationId) {
    // TODO: Pull Toast waitlist into local queue
    console.log('[ToastAdapter] syncToastToQueue stub for location', locationId);
    return { synced: false };
  }

  async createToastReservationOrWaitlistEntry(queueEntry) {
    // TODO: Create Toast waitlist entry from queue entry
    console.log('[ToastAdapter] createToastReservationOrWaitlistEntry stub', queueEntry?.id);
    return null;
  }
}

export const toastAdapter = new ToastAdapter();

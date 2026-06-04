/**
 * Future POS integration layer — queue system works independently.
 */
export abstract class POSAdapter {
  abstract getToastWaitTime(locationId: number): Promise<number | null>;
  abstract syncQueueToToast(locationId: number): Promise<{ synced: boolean }>;
  abstract syncToastToQueue(locationId: number): Promise<{ synced: boolean }>;
  abstract createToastReservationOrWaitlistEntry(
    queueEntry: unknown
  ): Promise<unknown | null>;
}

/**
 * Toast POS adapter placeholder — integrate when Toast API credentials are available.
 */
export class ToastAdapter extends POSAdapter {
  async getToastWaitTime(locationId: number): Promise<number | null> {
    console.log('[ToastAdapter] getToastWaitTime stub for location', locationId);
    return null;
  }

  async syncQueueToToast(locationId: number): Promise<{ synced: boolean }> {
    console.log('[ToastAdapter] syncQueueToToast stub for location', locationId);
    return { synced: false };
  }

  async syncToastToQueue(locationId: number): Promise<{ synced: boolean }> {
    console.log('[ToastAdapter] syncToastToQueue stub for location', locationId);
    return { synced: false };
  }

  async createToastReservationOrWaitlistEntry(queueEntry: unknown): Promise<unknown | null> {
    console.log('[ToastAdapter] createToastReservationOrWaitlistEntry stub', queueEntry);
    return null;
  }
}

export const toastAdapter = new ToastAdapter();

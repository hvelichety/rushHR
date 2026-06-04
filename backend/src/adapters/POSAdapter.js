/**
 * Future POS integration layer — queue system works independently.
 */
export class POSAdapter {
  async getToastWaitTime(_locationId) {
    throw new Error('Not implemented — use queue system wait time');
  }

  async syncQueueToToast(_locationId) {
    throw new Error('Not implemented');
  }

  async syncToastToQueue(_locationId) {
    throw new Error('Not implemented');
  }

  async createToastReservationOrWaitlistEntry(_queueEntry) {
    throw new Error('Not implemented');
  }
}

export class QueueApiError extends Error {
  existingEntryId?: number;
  existingBookingId?: number;
  code?: string;

  constructor(
    message: string,
    existingEntryId?: number,
    code?: string,
    existingBookingId?: number
  ) {
    super(message);
    this.name = 'QueueApiError';
    this.existingEntryId = existingEntryId;
    this.code = code;
    this.existingBookingId = existingBookingId;
  }
}

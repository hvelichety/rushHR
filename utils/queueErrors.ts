export class QueueApiError extends Error {
  existingEntryId?: number;

  constructor(message: string, existingEntryId?: number) {
    super(message);
    this.name = 'QueueApiError';
    this.existingEntryId = existingEntryId;
  }
}

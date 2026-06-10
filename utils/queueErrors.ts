export class QueueApiError extends Error {
  existingEntryId?: number;
  code?: string;

  constructor(message: string, existingEntryId?: number, code?: string) {
    super(message);
    this.name = 'QueueApiError';
    this.existingEntryId = existingEntryId;
    this.code = code;
  }
}

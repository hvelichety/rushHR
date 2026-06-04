let activeEntryId: number | null = null;

export function setActiveQueueEntry(id: number): void {
  activeEntryId = id;
}

export function getActiveQueueEntry(): number | null {
  return activeEntryId;
}

export function clearActiveQueueEntry(): void {
  activeEntryId = null;
}

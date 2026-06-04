const MAX_PARTY_SIZE = 20;

export function parsePartySize(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  if (Number.isNaN(n) || n < 1 || n > MAX_PARTY_SIZE) return null;
  return n;
}

export function getPartySizeValidationMessage(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return 'Party size is required';
  const n = parseInt(trimmed, 10);
  if (Number.isNaN(n) || n < 1) return 'Enter at least 1';
  if (n > MAX_PARTY_SIZE) return `Maximum party size is ${MAX_PARTY_SIZE}`;
  return null;
}

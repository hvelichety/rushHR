const MAX_PARTY_SIZE = 20;

export function normalizePartySize(value) {
  const n = Math.floor(Number(value));
  if (Number.isNaN(n) || n < 1) {
    throw new Error('Party size must be at least 1');
  }
  if (n > MAX_PARTY_SIZE) {
    throw new Error(`Party size cannot exceed ${MAX_PARTY_SIZE}`);
  }
  return n;
}

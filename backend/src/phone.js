export function normalizePhone(input) {
  const digits = String(input).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

export function isValidPhone(input) {
  const normalized = normalizePhone(input);
  if (!normalized) return false;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(normalized);
}

export function formatPhoneE164(input) {
  const normalized = normalizePhone(input);
  if (!normalized || !isValidPhone(input)) return null;
  return `+1${normalized}`;
}

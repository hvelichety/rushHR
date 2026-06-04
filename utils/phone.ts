/** Strip to digits; return 10-digit US number or null */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

/** US phone: 10 digits, area code & exchange cannot start with 0 or 1 */
export function isValidPhone(input: string): boolean {
  const normalized = normalizePhone(input);
  if (!normalized) return false;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(normalized);
}

/** Store as E.164 US (+1XXXXXXXXXX) */
export function formatPhoneE164(input: string): string | null {
  const normalized = normalizePhone(input);
  if (!normalized || !isValidPhone(input)) return null;
  return `+1${normalized}`;
}

/** Display format: (555) 123-4567 */
export function formatPhoneDisplay(input: string): string {
  const normalized = normalizePhone(input);
  if (!normalized) return input;
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

/** Format +15551234567 for display */
export function formatPhoneFromE164(e164: string): string {
  if (e164.startsWith('+1') && e164.length === 12) {
    return formatPhoneDisplay(e164.slice(2));
  }
  return e164;
}

export function getPhoneValidationMessage(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return 'Phone number is required';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10) return 'Enter a complete 10-digit phone number';
  if (digits.length > 11 || (digits.length === 11 && !digits.startsWith('1'))) {
    return 'Enter a valid US phone number';
  }
  if (!isValidPhone(trimmed)) return 'Enter a valid US phone number';
  return null;
}

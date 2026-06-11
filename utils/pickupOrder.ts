const MAX_PICKUP_NAME_LENGTH = 40;
const MAX_PICKUP_ITEMS_LENGTH = 400;
const MIN_PICKUP_ITEMS_LENGTH = 3;

const VOWELS = 'aeiou';

const INVALID_NAME_PLACEHOLDERS = new Set([
  'name',
  'test',
  'asdf',
  'xxx',
  'abc',
  'your name',
  'pickup name',
  'customer',
]);

const INVALID_ITEMS_PLACEHOLDERS = new Set([
  'food',
  'stuff',
  'items',
  'order',
  'something',
  'anything',
  'idk',
  'test',
]);

const ALLOWED_SHORT_TOKENS = new Set(['bbq', 'pho', 'naan', 'roti', 'dim', 'sum']);

const PICKUP_NAME_RE = /^[a-zA-Z][a-zA-Z\s'.-]*$/;

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

function lettersOnly(text: string): string {
  return text.replace(/[^a-zA-Z]/g, '');
}

function vowelRatio(text: string): number {
  const letters = lettersOnly(text);
  if (letters.length === 0) return 0;
  let vowels = 0;
  for (const c of letters.toLowerCase()) {
    if (VOWELS.includes(c)) vowels += 1;
  }
  return vowels / letters.length;
}

function maxConsecutiveConsonants(text: string): number {
  let max = 0;
  let current = 0;
  for (const c of lettersOnly(text).toLowerCase()) {
    if (VOWELS.includes(c)) {
      current = 0;
    } else {
      current += 1;
      max = Math.max(max, current);
    }
  }
  return max;
}

function isKeyboardMash(text: string): boolean {
  const letters = lettersOnly(text).toLowerCase();
  if (letters.length < 4) return false;
  return KEYBOARD_ROWS.some(
    (row) => letters.length >= 4 && [...letters].every((c) => row.includes(c))
  );
}

function hasExcessiveRepeats(text: string): boolean {
  const compact = text.replace(/\s/g, '').toLowerCase();
  if (/(.)\1{4,}/.test(compact)) return true;
  if (/(.{2,3})\1{2,}/.test(compact)) return true;
  return false;
}

/** Heuristic: random key mashing vs real words/names */
export function looksLikeGibberish(text: string): boolean {
  const letters = lettersOnly(text);
  if (letters.length < 3) return false;

  const lower = letters.toLowerCase();
  if (ALLOWED_SHORT_TOKENS.has(lower)) return false;

  if (hasExcessiveRepeats(letters)) return true;
  if (isKeyboardMash(letters)) return true;

  const ratio = vowelRatio(letters);
  const maxConsonants = maxConsecutiveConsonants(letters);

  if (letters.length === 3) {
    return ratio === 0;
  }

  if (letters.length <= 5) {
    return ratio < 0.15 || maxConsonants >= 4;
  }

  if (ratio < 0.2) return true;
  if (maxConsonants >= 5) return true;
  if (letters.length >= 8 && ratio < 0.28) return true;

  return false;
}

function splitNameParts(name: string): string[] {
  return name.split(/[\s'.-]+/).filter((part) => part.length >= 2);
}

function splitOrderWords(items: string): string[] {
  return items
    .split(/[,;]+/)
    .flatMap((segment) =>
      segment
        .trim()
        .split(/\s+/)
        .map((word) => word.replace(/^[\d.]+/, '').replace(/[^a-zA-Z'-]/g, ''))
        .filter((word) => word.length >= 3)
    );
}

function gibberishMessage(kind: 'name' | 'items'): string {
  return kind === 'name'
    ? "That doesn't look like a real name — use your actual pickup name"
    : 'Use real dish names the restaurant can understand (e.g. garlic naan)';
}

export function getPickupNameValidationMessage(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter the name for pickup';
  if (trimmed.length < 2) return 'Name must be at least 2 characters';
  if (trimmed.length > MAX_PICKUP_NAME_LENGTH) return 'Name is too long';
  if (!/[a-zA-Z]/.test(trimmed)) return 'Use a real name with letters';
  if (!PICKUP_NAME_RE.test(trimmed)) {
    return 'Use letters, spaces, hyphens, or apostrophes only';
  }
  if (INVALID_NAME_PLACEHOLDERS.has(trimmed.toLowerCase())) {
    return 'Enter your actual pickup name';
  }

  const parts = splitNameParts(trimmed);
  const toCheck = parts.length > 0 ? parts : [trimmed];
  for (const part of toCheck) {
    if (part.length >= 3 && looksLikeGibberish(part)) {
      return gibberishMessage('name');
    }
  }

  return null;
}

export function getPickupItemsValidationMessage(items: string): string | null {
  const trimmed = items.trim();
  if (!trimmed) return 'List what you want to order';
  if (trimmed.length < MIN_PICKUP_ITEMS_LENGTH) {
    return 'Describe your order (at least 3 characters)';
  }
  if (trimmed.length > MAX_PICKUP_ITEMS_LENGTH) return 'Order description is too long';
  if (!/[a-zA-Z]/.test(trimmed)) return 'Include item names (e.g. garlic naan)';
  if (INVALID_ITEMS_PLACEHOLDERS.has(trimmed.toLowerCase())) {
    return 'Be specific — list the dishes you want';
  }

  const words = splitOrderWords(trimmed);
  if (words.length === 0) {
    return 'Include item names (e.g. garlic naan)';
  }

  for (const word of words) {
    if (looksLikeGibberish(word)) {
      return gibberishMessage('items');
    }
  }

  return null;
}

export function isValidPickupName(name: string): boolean {
  return getPickupNameValidationMessage(name) === null;
}

export function isValidPickupItems(items: string): boolean {
  return getPickupItemsValidationMessage(items) === null;
}

export function buildPickupQuestion(name: string, items: string): string {
  return `Can I place an order for pickup for ${name.trim()}: ${items.trim()}`;
}

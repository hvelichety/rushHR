/** Cooldown from API/DB; only null/undefined use fallback (0 is valid). */
export function resolveCooldownMinutes(
  value: number | null | undefined,
  fallback = 30
): number {
  return value ?? fallback;
}

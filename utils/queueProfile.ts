import AsyncStorage from '@react-native-async-storage/async-storage';
import { parsePartySize } from './partySize';
import { formatPhoneE164, isValidPhone } from './phone';

const PROFILE_KEY = '@rushhr/queue_guest_profile';
const PROMPT_SEEN_KEY = '@rushhr/queue_profile_prompt_seen';

export type QueueGuestProfile = {
  name: string;
  phone: string;
  partySize: number;
};

export async function getSavedQueueProfile(): Promise<QueueGuestProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QueueGuestProfile;
    if (!parsed.name || !parsed.phone || !parsed.partySize) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveQueueProfile(profile: QueueGuestProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  await AsyncStorage.setItem(PROMPT_SEEN_KEY, '1');
}

export async function clearQueueProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY);
}

export async function hasSeenSaveProfilePrompt(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PROMPT_SEEN_KEY);
  return value === '1';
}

/** User declined or saved — never show the first-time prompt again */
export async function markSaveProfilePromptSeen(): Promise<void> {
  await AsyncStorage.setItem(PROMPT_SEEN_KEY, '1');
}

export function isValidQueueProfile(data: {
  name: string;
  contact: string;
  partySize: number;
}): data is { name: string; contact: string; partySize: number } {
  return (
    data.name.trim().length > 0 &&
    isValidPhone(data.contact) &&
    parsePartySize(String(data.partySize)) !== null
  );
}

export function toQueueProfile(data: {
  name: string;
  contact: string;
  partySize: number;
}): QueueGuestProfile | null {
  const phone = formatPhoneE164(data.contact);
  const partySize = parsePartySize(String(data.partySize));
  if (!phone || partySize === null || !isValidQueueProfile(data)) return null;
  return {
    name: data.name.trim(),
    phone,
    partySize,
  };
}

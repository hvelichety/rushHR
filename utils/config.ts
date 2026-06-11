import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ✅ Environment detection
const IS_DEV = __DEV__;
const IS_SIMULATOR = Platform.OS === 'ios' ? !Constants.isDevice : false;
const IS_EMULATOR = Platform.OS === 'android' ? !Constants.isDevice : false;

// ✅  Development URLs (for simulator/emulator)
const DEV_URLS = {
  ios: 'http://localhost:5001', // iOS Simulator → localhost
  android: 'http://10.0.2.2:5001', // Android Emulator → special IP
  web: 'http://localhost:5001',
};

// Legacy Flask backend (wait-time /call, SSE stream) — optional
const LEGACY_API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://web-production-c18ab.up.railway.app';

// Queue + restaurant catalog live on the Node backend (Railway backend/)
const QUEUE_API_URL = process.env.EXPO_PUBLIC_QUEUE_API_URL?.replace(/\/$/, '');

/**
 * Restaurant list comes from the Node backend (curated, call-worthy only).
 * Falls back to legacy Flask URL if QUEUE_API_URL is unset.
 */
export const RESTAURANT_API_BASE_URL = QUEUE_API_URL || LEGACY_API_URL;

/** Manual test partner on Queue + Call & Ask (732-666-5066) */
export const TEST_RESTAURANT_ID = 1;

/** @deprecated Use RESTAURANT_API_BASE_URL for restaurants; kept for legacy /call and /stream */
export const API_BASE_URL = LEGACY_API_URL;
export const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

/** Must match backend: only applied when "Nearby Only" filter is on (query param radius=) */
export const NEARBY_RADIUS_MILES = 30;

// ✅ Validate API URL and key on app start
export function validateApiUrl(): boolean {
  if (!API_BASE_URL) {
    console.error('❌ API_BASE_URL is not configured!');
    return false;
  }

  if (!API_KEY) {
    console.error('❌ EXPO_PUBLIC_API_KEY is not set — /call requests will fail');
  }

  console.log(`✅ Restaurant API: ${RESTAURANT_API_BASE_URL}`);
  console.log(`   Legacy API: ${API_BASE_URL}`);
  console.log(`   Environment: ${IS_DEV ? 'Development' : 'Production'}`);
  console.log(`   Platform: ${Platform.OS} (${Constants.isDevice ? 'Device' : 'Simulator'})`);
  console.log(`   API key: ${API_KEY ? '✅ set' : '❌ missing'}`);

  return true;
}

// ✅ Export environment info for debugging
export const ENV_INFO = {
  isDev: IS_DEV,
  isSimulator: IS_SIMULATOR,
  isEmulator: IS_EMULATOR,
  platform: Platform.OS,
  isDevice: Constants.isDevice,
  apiUrl: API_BASE_URL,
  restaurantApiUrl: RESTAURANT_API_BASE_URL,
};

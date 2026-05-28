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

// ✅ Production URL (set this to your deployed backend)
// You can also use environment variables: process.env.EXPO_PUBLIC_API_URL
const PRODUCTION_URL = process.env.EXPO_PUBLIC_API_URL || 'https://web-production-c18ab.up.railway.app';

/**
 * Get the appropriate API URL based on environment
 */
function getApiUrl(): string {
  return PRODUCTION_URL;
}

export const API_BASE_URL = getApiUrl();
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

  console.log(`✅ API configured: ${API_BASE_URL}`);
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
};

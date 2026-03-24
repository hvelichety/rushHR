import * as Location from 'expo-location';

export type UserLocation = {
  latitude: number;
  longitude: number;
};

/**
 * Request location permissions from the user
 * @returns true if permission granted, false otherwise
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ Location permission denied');
      return false;
    }

    console.log('✅ Location permission granted');
    return true;
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return false;
  }
}

/**
 * Get the user's current location
 * @returns User location coordinates or null if unable to get location
 */
export async function getCurrentLocation(): Promise<UserLocation | null> {
  try {
    // Check if we have permission first
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('⚠️ Location permission not granted');
      return null;
    }

    // Get current position
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced, // Good balance between accuracy and battery
    });

    console.log('📍 Current location:', location.coords.latitude, location.coords.longitude);

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
}

/**
 * Open device settings to allow user to enable location permissions
 */
export async function openLocationSettings(): Promise<void> {
  try {
    await Location.enableNetworkProviderAsync();
  } catch (error) {
    console.error('Error opening location settings:', error);
  }
}

/**
 * Check if location services are enabled on the device
 */
export async function isLocationEnabled(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking location status:', error);
    return false;
  }
}

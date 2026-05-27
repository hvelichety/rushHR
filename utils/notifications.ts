import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { API_BASE_URL } from './config';

const DEVICE_ID_KEY = '@RushHR:deviceId';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Get or create a unique device ID
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Check if we already have a device ID stored
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
      // Generate a new unique device ID
      deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      console.log('📱 Generated new device ID:', deviceId);
    } else {
      console.log('📱 Retrieved existing device ID:', deviceId);
    }

    return deviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    // Fallback to a temporary ID
    return `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Request permissions and get push token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Check if running on a physical device
    if (!Device.isDevice) {
      console.warn('⚠️ Push notifications only work on physical devices');
      return null;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ Push notification permission denied');
      return null;
    }

    // Get the push token.
    // In EAS builds, this must match your Expo project's "projectId".
    // In Expo Go/dev, omit projectId if it's not configured to avoid hard failures.
    const projectId =
      (Constants.easConfig as any)?.projectId ||
      (Constants.expoConfig as any)?.extra?.eas?.projectId;

    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    const token = tokenData.data;
    console.log('🔔 Push token:', token);

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  } catch (error) {
    // Don't red-screen the app if Expo's push service is temporarily unavailable.
    console.warn('Push notifications unavailable:', error);
    return null;
  }
}

/**
 * Register push token with backend
 */
export async function registerPushToken(deviceId: string, pushToken: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/register-push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device_id: deviceId,
        push_token: pushToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to register push token:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ Push token registered with backend:', data);
  } catch (error) {
    console.error('Error registering push token with backend:', error);
  }
}

/**
 * Setup notification listeners
 * @param onNotificationTap - Callback when user taps a notification
 * @returns Cleanup function to remove listeners
 */
export function setupNotificationListeners(
  onNotificationTap: (data: any) => void
): () => void {
  // Handle notification received while app is in foreground
  const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('🔔 Notification received:', notification);
  });

  // Handle notification tapped/clicked
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('👆 Notification tapped:', response);
    const data = response.notification.request.content.data;
    onNotificationTap(data);
  });

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Check if push notifications are enabled
 */
export async function arePushNotificationsEnabled(): Promise<boolean> {
  if (!Device.isDevice) {
    return false;
  }

  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

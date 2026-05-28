import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { API_BASE_URL } from './config';

// In-memory device ID (AsyncStorage native module is unreliable in some Expo Go setups)
let cachedDeviceId: string | null = null;

function createDeviceId(): string {
  return `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

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
 * Get or create a unique device ID (session-stable, no native storage required)
 */
export async function getDeviceId(): Promise<string> {
  if (!cachedDeviceId) {
    cachedDeviceId = createDeviceId();
    if (__DEV__) console.log('📱 Device ID:', cachedDeviceId);
  }
  return cachedDeviceId;
}

/**
 * Request permissions and get push token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.warn('⚠️ Push notifications only work on physical devices');
      return null;
    }

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

    const projectId =
      (Constants.easConfig as { projectId?: string } | null)?.projectId ||
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
        ?.projectId;

    const tokenData =
      projectId && projectId !== 'YOUR_EAS_PROJECT_ID'
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();

    const token = tokenData.data;
    if (__DEV__) console.log('🔔 Push token:', token);

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
    if (__DEV__) console.log('✅ Push token registered with backend:', data);
  } catch (error) {
    console.error('Error registering push token with backend:', error);
  }
}

/**
 * Setup notification listeners
 */
export function setupNotificationListeners(
  onNotificationTap: (data: Record<string, unknown>) => void
): () => void {
  const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
    if (__DEV__) console.log('🔔 Notification received:', notification);
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    if (__DEV__) console.log('👆 Notification tapped:', response);
    const data = response.notification.request.content.data;
    onNotificationTap(data as Record<string, unknown>);
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

export async function arePushNotificationsEnabled(): Promise<boolean> {
  if (!Device.isDevice) {
    return false;
  }

  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

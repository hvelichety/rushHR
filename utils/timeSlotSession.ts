import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_BOOKING_KEY = 'rushhr_active_time_slot_booking';

export async function setActiveTimeSlotBooking(bookingId: number): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_BOOKING_KEY, String(bookingId));
}

export async function getActiveTimeSlotBookingId(): Promise<number | null> {
  const value = await AsyncStorage.getItem(ACTIVE_BOOKING_KEY);
  if (!value) return null;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

export async function clearActiveTimeSlotBooking(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_BOOKING_KEY);
}

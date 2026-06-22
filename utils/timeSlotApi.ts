import { QueueApiError } from './queueErrors';
import {
  BookTimeSlotPayload,
  CreateTimeSlotPayload,
  TimeSlot,
  TimeSlotBooking,
} from './timeSlotTypes';
import { QUEUE_API_BASE_URL, getQueueApiConfigError } from './queueApi';

async function timeSlotFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const configError = getQueueApiConfigError();
  if (configError) {
    throw new QueueApiError(configError);
  }

  const response = await fetch(`${QUEUE_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  let data: Record<string, unknown> = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const msg =
      (typeof data.error === 'string' && data.error) || `Request failed (${response.status})`;
    const existingBookingId =
      typeof data.existingBookingId === 'number' ? data.existingBookingId : undefined;
    const code = typeof data.code === 'string' ? data.code : undefined;
    throw new QueueApiError(msg, undefined, code, existingBookingId);
  }

  return data as T;
}

export async function fetchTimeSlots(locationId: number): Promise<TimeSlot[]> {
  return timeSlotFetch<TimeSlot[]>(`/locations/${locationId}/time-slots`);
}

export async function fetchActiveTimeSlotBooking(deviceId: string): Promise<TimeSlotBooking | null> {
  const booking = await timeSlotFetch<TimeSlotBooking | null>(
    `/time-slot-bookings/active?deviceId=${encodeURIComponent(deviceId)}`
  );
  return booking;
}

export async function fetchTimeSlotBooking(bookingId: number): Promise<TimeSlotBooking> {
  return timeSlotFetch<TimeSlotBooking>(`/time-slot-bookings/${bookingId}`);
}

export async function bookTimeSlot(
  slotId: number,
  payload: BookTimeSlotPayload
): Promise<TimeSlotBooking> {
  return timeSlotFetch<TimeSlotBooking>(`/time-slots/${slotId}/book`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function cancelTimeSlotBooking(
  bookingId: number,
  deviceId?: string
): Promise<TimeSlotBooking> {
  return timeSlotFetch<TimeSlotBooking>(`/time-slot-bookings/${bookingId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ deviceId }),
  });
}

export async function createTimeSlot(payload: CreateTimeSlotPayload): Promise<TimeSlot> {
  return timeSlotFetch<TimeSlot>('/time-slots', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTimeSlotCapacity(
  slotId: number,
  capacity: number
): Promise<TimeSlot> {
  return timeSlotFetch<TimeSlot>(`/time-slots/${slotId}`, {
    method: 'PATCH',
    body: JSON.stringify({ capacity }),
  });
}

export async function closeTimeSlot(slotId: number): Promise<TimeSlot> {
  return timeSlotFetch<TimeSlot>(`/time-slots/${slotId}/close`, { method: 'POST' });
}

export async function fetchSlotBookings(slotId: number): Promise<TimeSlotBooking[]> {
  return timeSlotFetch<TimeSlotBooking[]>(`/time-slots/${slotId}/bookings`);
}

export async function markSlotBookingArrived(bookingId: number): Promise<TimeSlotBooking> {
  return timeSlotFetch<TimeSlotBooking>(`/time-slot-bookings/${bookingId}/arrived`, {
    method: 'POST',
  });
}

export async function markSlotBookingNoShow(bookingId: number): Promise<TimeSlotBooking> {
  return timeSlotFetch<TimeSlotBooking>(`/time-slot-bookings/${bookingId}/no-show`, {
    method: 'POST',
  });
}

export function formatSlotTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatSlotDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatSlotRange(startIso: string, endIso: string): string {
  return `${formatSlotTime(startIso)} – ${formatSlotTime(endIso)}`;
}

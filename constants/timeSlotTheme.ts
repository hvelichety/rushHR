import { QUEUE_COLORS } from './queueTheme';
import { TimeSlotDisplayStatus, TimeSlotBookingStatus } from '@/utils/timeSlotTypes';

export const SLOT_STATUS_LABELS: Record<TimeSlotDisplayStatus, string> = {
  available: 'Available',
  almost_full: 'Almost Full',
  full: 'Full',
};

export const SLOT_STATUS_COLORS: Record<TimeSlotDisplayStatus, string> = {
  available: QUEUE_COLORS.success,
  almost_full: QUEUE_COLORS.warning,
  full: QUEUE_COLORS.danger,
};

export const BOOKING_STATUS_LABELS: Record<TimeSlotBookingStatus, string> = {
  booked: 'Booked',
  arrived: 'Arrived',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

export const BOOKING_STATUS_COLORS: Record<TimeSlotBookingStatus, string> = {
  booked: QUEUE_COLORS.info,
  arrived: QUEUE_COLORS.success,
  cancelled: QUEUE_COLORS.textMuted,
  no_show: QUEUE_COLORS.danger,
};

export { QUEUE_COLORS as SLOT_COLORS };

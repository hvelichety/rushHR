export type TimeSlotDisplayStatus = 'available' | 'almost_full' | 'full';

export type TimeSlotRecordStatus = 'open' | 'closed';

export type TimeSlotBookingStatus = 'booked' | 'arrived' | 'cancelled' | 'no_show';

export type TimeSlot = {
  id: number;
  restaurantId: number;
  restaurantName?: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  spotsAvailable: number;
  status: TimeSlotRecordStatus;
  displayStatus: TimeSlotDisplayStatus;
  arrivalWindowMinutes: number;
  createdAt?: string;
  updatedAt?: string;
};

export type TimeSlotBooking = {
  id: number;
  timeSlotId: number;
  restaurantId: number;
  customerName: string;
  phoneNumber: string;
  partySize: number;
  confirmationCode: string;
  status: TimeSlotBookingStatus;
  deviceId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  restaurantName?: string;
  slotStartTime?: string;
  slotEndTime?: string;
};

export type BookTimeSlotPayload = {
  customerName: string;
  phoneNumber: string;
  partySize: number;
  deviceId?: string;
};

export type CreateTimeSlotPayload = {
  restaurantId: number;
  startTime: string;
  endTime: string;
  capacity: number;
};

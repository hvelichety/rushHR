export type QueueStatus =
  | 'waiting'
  | 'fifth_in_line'
  | 'next_in_line'
  | 'called'
  | 'checked_in'
  | 'served'
  | 'no_show'
  | 'removed';

export type BusinessLocation = {
  id: number;
  name: string;
  address?: string;
  category?: string;
  isQueueOpen: boolean;
  averageServiceTimeMinutes: number;
  currentWaitTime: number;
  queueCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type QueueEntry = {
  id: number;
  locationId: number;
  customerName: string;
  customerContact: string;
  partySize: number;
  position: number;
  status: QueueStatus;
  notification5thSent: boolean;
  notificationNextSent: boolean;
  notificationTurnSent: boolean;
  extensionUsed: boolean;
  calledAt?: string | null;
  responseDeadline?: string | null;
  extensionDeadline?: string | null;
  checkInCode?: string | null;
  checkedInAt?: string | null;
  servedAt?: string | null;
  deviceId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  locationName?: string;
  peopleAhead?: number;
  estimatedWaitMinutes?: number;
};

export type JoinQueuePayload = {
  locationId: number;
  customerName: string;
  customerContact: string;
  partySize: number;
  deviceId?: string;
  pushToken?: string;
};

export type QueueNotification = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  entryId?: number;
  callId?: number;
  deviceId?: string;
  restaurantId?: number;
  restaurantName?: string;
  question?: string;
};

export type VerifyCodeResult = {
  verified: boolean;
  entry: QueueEntry | null;
};

export type LocationQueueResponse = {
  location: BusinessLocation;
  queue: QueueEntry[];
};

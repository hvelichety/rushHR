export type Restaurant = {
  id: number;
  name: string;
  cuisine: string;
  distanceMiles?: number;
  waitMinutes: number;
  lastUpdatedAt: number;
  image: string;
  phone: string;
  timezone?: string;
  openHour?: number;
  closeHour?: number;
  lastCalledAt?: string;
  // Location fields
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  state?: string;
  rating?: number;
  distance_miles?: number; // Calculated by backend
};
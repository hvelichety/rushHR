import { RESTAURANT_API_BASE_URL } from './config';
import { Restaurant } from './types';

export type RestaurantSearchResponse = {
  results: Record<string, unknown>[];
  yelpHits: number;
  imported: number;
  query: string;
};

export function mapApiRestaurant(r: Record<string, unknown>): Restaurant {
  return {
    id: r.id as number,
    name: (r.name as string) || 'Restaurant',
    cuisine: (r.cuisine as string) || 'Unknown',
    phone: r.phone as string,
    waitMinutes: (r.wait_minutes as number | undefined) ?? 0,
    lastUpdatedAt: r.last_updated_at
      ? (r.last_updated_at as number) < 1e12
        ? (r.last_updated_at as number) * 1000
        : (r.last_updated_at as number)
      : Date.now(),
    image: (r.image as string) || 'https://via.placeholder.com/150',
    timezone: r.timezone as string | undefined,
    openHour: r.open_hour as number | undefined,
    closeHour: r.close_hour as number | undefined,
    lastCalledAt: r.last_called_at as string | undefined,
    latitude: r.latitude as number | undefined,
    longitude: r.longitude as number | undefined,
    address: r.address as string | undefined,
    city: r.city as string | undefined,
    state: r.state as string | undefined,
    rating: r.rating as number | undefined,
    review_count: r.review_count as number | undefined,
    distance_miles: r.distance_miles as number | undefined,
  };
}

export async function searchRestaurantsLive(
  query: string,
  userLocation?: { latitude: number; longitude: number } | null
): Promise<Restaurant[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({ q });
  if (userLocation) {
    params.set('lat', String(userLocation.latitude));
    params.set('lng', String(userLocation.longitude));
  }

  const response = await fetch(`${RESTAURANT_API_BASE_URL}/restaurants/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Search failed (${response.status})`);
  }

  const data = (await response.json()) as RestaurantSearchResponse;
  return (data.results || []).map(mapApiRestaurant);
}

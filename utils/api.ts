import { API_BASE_URL, API_KEY } from "./config";
import { Restaurant } from "./types";

export type RequestWaitTimeOptions = {
  deviceId?: string;
  pushToken?: string;
  userLat?: number;
  userLng?: number;
};

export type CallTriggerResult = {
  call_sid: string;
  restaurant_id: number;
  recommendations?: unknown[];
};

/**
 * Request wait time for a restaurant (triggers Twilio call).
 * Sends force=true so the backend always places the call.
 */
export async function requestWaitTime(
  restaurant: Restaurant,
  partySize = 4,
  options?: RequestWaitTimeOptions
): Promise<CallTriggerResult> {
  const body: Record<string, unknown> = {
    restaurant_id: restaurant.id,
    party_size: partySize,
    phone: restaurant.phone,
    force: true,
  };

  if (options?.deviceId) body.device_id = options.deviceId;
  if (options?.pushToken) body.push_token = options.pushToken;
  if (options?.userLat !== undefined) body.user_lat = options.userLat;
  if (options?.userLng !== undefined) body.user_lng = options.userLng;

  const response = await fetch(`${API_BASE_URL}/call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
    },
    body: JSON.stringify(body),
  });

  let data: Record<string, unknown> = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const msg =
      (typeof data.error === "string" && data.error) ||
      `Request failed (${response.status})`;
    if (__DEV__) console.error(`HTTP error ${response.status}:`, data);
    throw new Error(msg);
  }

  if (typeof data.error === "string") {
    throw new Error(data.error);
  }

  if (typeof data.call_sid !== "string" || !data.call_sid) {
    if (__DEV__) console.error("Missing call_sid in /call response:", data);
    throw new Error("Call was not placed. No confirmation from server.");
  }

  if (__DEV__) console.log("✅ Wait time request success:", data);

  return {
    call_sid: data.call_sid,
    restaurant_id: Number(data.restaurant_id ?? restaurant.id),
    recommendations: data.recommendations as unknown[] | undefined,
  };
}

/**
 * Fetch a single restaurant by ID
 */
export async function fetchRestaurant(id: number): Promise<any | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/restaurants/${id}`);

    if (!response.ok) {
      const errorText = await response.text();
      if (__DEV__) console.error(`HTTP error ${response.status}:`, errorText);
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    if (__DEV__) console.error("❌ Failed to fetch restaurant:", err);
    return null;
  }
}

/**
 * Fetch all restaurants with optional location params
 */
export async function fetchAllRestaurants(
  lat?: number,
  lng?: number,
  radius?: number
): Promise<Restaurant[] | null> {
  try {
    let url = `${API_BASE_URL}/restaurants`;
    const params = new URLSearchParams();

    if (lat !== undefined && lng !== undefined) {
      params.append("lat", lat.toString());
      params.append("lng", lng.toString());
      if (radius !== undefined) {
        params.append("radius", radius.toString());
      }
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      if (__DEV__) console.error(`HTTP error ${response.status}:`, errorText);
      throw new Error(`HTTP error: ${response.status}`);
    }

    const raw = await response.json();
    const data: Restaurant[] = raw.map((r: any) => ({
      id: r.id,
      name: r.name,
      cuisine: r.cuisine || "Unknown",
      phone: r.phone,
      waitMinutes: r.wait_minutes,
      lastUpdatedAt:
        r.last_updated_at < 1e12
          ? r.last_updated_at * 1000
          : r.last_updated_at,
      image: r.image || "https://via.placeholder.com/150",
      timezone: r.timezone,
      openHour: r.open_hour,
      closeHour: r.close_hour,
      lastCalledAt: r.last_called_at,
      latitude: r.latitude,
      longitude: r.longitude,
      address: r.address,
      city: r.city,
      state: r.state,
      rating: r.rating,
      distance_miles: r.distance_miles,
    }));

    return data;
  } catch (err) {
    if (__DEV__) console.error("❌ Failed to fetch all restaurants:", err);
    return null;
  }
}

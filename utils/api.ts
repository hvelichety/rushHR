import { API_BASE_URL, API_KEY } from "./config";
import { Restaurant } from "./types";

/**
 * Request wait time for a restaurant (triggers Twilio call)
 */
export async function requestWaitTime(
  restaurant: Restaurant,
  partySize = 4
): Promise<any | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
      },
      body: JSON.stringify({
        restaurant_id: restaurant.id,
        party_size: partySize,
        phone: restaurant.phone,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (__DEV__) console.error(`HTTP error ${response.status}:`, errorText);
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();

    // Handle specific backend responses
    if (data.skipped && data.reason === "outside_call_window") {
      throw new Error("Restaurant is outside call window");
    }

    if (__DEV__) console.log("✅ Wait time request success:", data);
    return data;
  } catch (err) {
    if (__DEV__) console.error("❌ Failed to request wait time:", err);
    return null;
  }
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
      params.append('lat', lat.toString());
      params.append('lng', lng.toString());
      if (radius !== undefined) {
        params.append('radius', radius.toString());
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
      isClosed: r.is_closed,
      lastCalledAt: r.last_called_at,
      cooldownMinutes: r.cooldown_minutes,
      // Location fields
      latitude: r.latitude,
      longitude: r.longitude,
      address: r.address,
      city: r.city,
      state: r.state,
      rating: r.rating,
      price_level: r.price_level,
      distance_miles: r.distance_miles,
    }));

    return data;
  } catch (err) {
    if (__DEV__) console.error("❌ Failed to fetch all restaurants:", err);
    return null;
  }
}

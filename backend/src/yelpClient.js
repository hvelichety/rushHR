const YELP_API_BASE = 'https://api.yelp.com/v3';

function getApiKey() {
  const key = process.env.YELP_API_KEY?.trim();
  if (!key) {
    throw new Error('YELP_API_KEY is not set — add it in Railway Variables to auto-discover restaurants');
  }
  return key;
}

export function isYelpConfigured() {
  return Boolean(process.env.YELP_API_KEY?.trim());
}

async function yelpFetch(path, searchParams = {}) {
  const url = new URL(`${YELP_API_BASE}${path}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      Accept: 'application/json',
    },
  });

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const detail =
      (typeof body.error?.description === 'string' && body.error.description) ||
      (typeof body.error === 'string' && body.error) ||
      `Yelp API error (${response.status})`;
    throw new Error(detail);
  }

  return body;
}

/**
 * Search sit-down restaurants near coordinates or a city name.
 * Yelp max radius is 40,000 meters (~25 mi).
 */
export async function searchRestaurants({
  latitude,
  longitude,
  location,
  radiusMeters = 40000,
  limit = 50,
  offset = 0,
}) {
  const params = {
    categories: 'restaurants',
    sort_by: 'distance',
    limit: Math.min(Math.max(limit, 1), 50),
    offset: Math.max(offset, 0),
  };

  if (latitude != null && longitude != null) {
    params.latitude = latitude;
    params.longitude = longitude;
    params.radius = Math.min(Math.max(radiusMeters, 1000), 40000);
  } else if (location) {
    params.location = location;
  } else {
    throw new Error('latitude/longitude or location is required for Yelp search');
  }

  return yelpFetch('/businesses/search', params);
}

export async function getBusinessDetails(businessId) {
  return yelpFetch(`/businesses/${encodeURIComponent(businessId)}`);
}

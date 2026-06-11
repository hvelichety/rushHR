import { query } from './db.js';
import { isCallEligibleRestaurant } from './restaurantCatalog.js';
import { syncRestaurantsFromYelp, searchAndImportByTerm } from './restaurantDiscovery.js';
import { compareByPopularity } from './restaurantPopularity.js';
import { matchesSearchQuery } from './restaurantSearch.js';

export function mapRestaurantRow(row, { userLat, userLng } = {}) {
  let distanceMiles = null;
  if (
    userLat !== null &&
    userLng !== null &&
    row.latitude != null &&
    row.longitude != null
  ) {
    distanceMiles = haversineMiles(
      userLat,
      userLng,
      Number(row.latitude),
      Number(row.longitude)
    );
    distanceMiles = Math.round(distanceMiles * 10) / 10;
  }

  const lastUpdatedAt = row.last_updated_at
    ? row.last_updated_at instanceof Date
      ? row.last_updated_at.getTime()
      : Number(row.last_updated_at)
    : null;

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    cuisine: row.cuisine || 'Unknown',
    wait_minutes: row.wait_minutes ?? row.current_wait_time ?? null,
    last_updated_at: lastUpdatedAt,
    image: row.image || null,
    timezone: row.timezone || 'America/New_York',
    open_hour: row.open_hour ?? 0,
    close_hour: row.close_hour ?? 24,
    last_called_at: row.last_called_at || null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    address: row.address || null,
    city: row.city || null,
    state: row.state || null,
    rating: row.rating != null ? Number(row.rating) : null,
    review_count: row.review_count != null ? Number(row.review_count) : null,
    distance_miles: distanceMiles,
    call_eligible: row.call_eligible !== false,
  };
}

const EARTH_RADIUS_MILES = 3959;

function parseCoord(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchesSearch(row, q) {
  return matchesSearchQuery(q, {
    name: row.name,
    cuisine: row.cuisine,
    city: row.city,
    state: row.state,
    address: row.address,
  });
}

function sortRestaurants(rows, { userLat, userLng, sort }) {
  const withDistance = rows.map((row) => {
    const mapped = mapRestaurantRow(row, { userLat, userLng });
    return { row, mapped };
  });

  if (sort === 'name') {
    withDistance.sort((a, b) => a.mapped.name.localeCompare(b.mapped.name));
  } else if (sort === 'distance' && userLat !== null && userLng !== null) {
    withDistance.sort((a, b) => {
      const da = a.mapped.distance_miles;
      const db = b.mapped.distance_miles;
      if (da == null && db == null) return a.mapped.name.localeCompare(b.mapped.name);
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  } else {
    withDistance.sort((a, b) => compareByPopularity(a.mapped, b.mapped));
  }

  return withDistance.map(({ mapped }) => mapped);
}

function wantsSync(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'force';
  }
  return false;
}

function wantsFetch(value) {
  return wantsSync(value);
}

async function maybeFetchSearchResults(options) {
  if (!wantsFetch(options.fetch)) return null;

  const q = typeof options.q === 'string' ? options.q.trim() : '';
  if (q.length < 2) return null;

  try {
    return await searchAndImportByTerm({
      term: q,
      lat: options.lat,
      lng: options.lng,
      location: options.location,
    });
  } catch (err) {
    console.error('Search fetch failed:', err.message);
    return { error: err.message };
  }
}

async function maybeDiscoverRestaurants(options) {
  if (!wantsSync(options.sync)) return null;

  const force =
    options.sync === 'force' ||
    (typeof options.sync === 'string' && options.sync.trim().toLowerCase() === 'force');

  const location =
    (typeof options.location === 'string' && options.location.trim()) ||
    (typeof options.city === 'string' && options.city.trim()) ||
    '';

  try {
    const hasCoords =
      options.lat != null &&
      options.lng != null &&
      Number.isFinite(Number(options.lat)) &&
      Number.isFinite(Number(options.lng));

    return await syncRestaurantsFromYelp({
      lat: options.lat,
      lng: options.lng,
      location: location || undefined,
      force,
      includeExtraMarkets: hasCoords && !location,
    });
  } catch (err) {
    console.error('Restaurant discovery failed:', err.message);
    return { error: err.message };
  }
}

/**
 * List call-worthy restaurants from Postgres.
 * - Always returns every eligible restaurant unless radius is set (nearby filter).
 * - lat/lng only affect distance_miles and sort order, not visibility.
 */
export async function listRestaurants(options = {}) {
  const searchFetch = await maybeFetchSearchResults(options);
  const discovery = await maybeDiscoverRestaurants(options);

  const userLat = parseCoord(options.lat);
  const userLng = parseCoord(options.lng);
  const radius = parseCoord(options.radius);
  const q = typeof options.q === 'string' ? options.q : '';
  const city = typeof options.city === 'string' ? options.city.trim() : '';
  const cuisine = typeof options.cuisine === 'string' ? options.cuisine.trim() : '';
  const sort =
    options.sort === 'name'
      ? 'name'
      : options.sort === 'distance'
        ? 'distance'
        : 'popularity';

  const conditions = ['r.phone IS NOT NULL', "TRIM(r.phone) <> ''"];
  const params = [];
  let paramIndex = 1;

  if (city) {
    conditions.push(`LOWER(r.city) LIKE LOWER($${paramIndex})`);
    params.push(`%${city}%`);
    paramIndex += 1;
  }

  if (cuisine && cuisine.toLowerCase() !== 'all') {
    conditions.push(`LOWER(r.cuisine) = LOWER($${paramIndex})`);
    params.push(cuisine);
    paramIndex += 1;
  }

  const { rows } = await query(
    `SELECT r.*
     FROM restaurants r
     WHERE ${conditions.join(' AND ')}
     ORDER BY r.name`,
    params
  );

  let eligible = rows.filter(isCallEligibleRestaurant);
  eligible = eligible.filter((row) => matchesSearch(row, q));

  let mapped = sortRestaurants(eligible, { userLat, userLng, sort });

  if (radius !== null && userLat !== null && userLng !== null) {
    mapped = mapped.filter(
      (r) => r.distance_miles != null && r.distance_miles <= radius
    );
  }

  return { restaurants: mapped, discovery, searchFetch };
}

export async function getRestaurantById(id, { lat, lng } = {}) {
  const userLat = parseCoord(lat);
  const userLng = parseCoord(lng);

  const { rows } = await query('SELECT * FROM restaurants WHERE id = $1', [id]);
  const row = rows[0];
  if (!row) return null;

  const mapped = mapRestaurantRow(row, { userLat, userLng });
  if (!isCallEligibleRestaurant(row)) {
    mapped.call_eligible = false;
  }

  return mapped;
}

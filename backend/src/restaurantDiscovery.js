import { query } from './db.js';
import {
  hasCallablePhone,
  isCallEligibleRestaurant,
  isChainName,
  isExcludedYelpCategory,
} from './restaurantCatalog.js';
import { formatPhoneE164 } from './phone.js';
import { getBusinessDetails, isYelpConfigured, searchRestaurants } from './yelpClient.js';

const SYNC_TTL_MS =
  (Number(process.env.YELP_SYNC_TTL_HOURS) || 24) * 60 * 60 * 1000;
const MAX_RESULTS_PER_SYNC = Number(process.env.YELP_SYNC_MAX_RESULTS) || 200;
const DEFAULT_RADIUS_METERS = Number(process.env.YELP_SYNC_RADIUS_METERS) || 40000;
const EXTRA_SYNC_LOCATIONS = (process.env.YELP_SYNC_EXTRA_LOCATIONS || 'Princeton, NJ,New Brunswick, NJ')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const STATE_TIMEZONES = {
  NJ: 'America/New_York',
  NY: 'America/New_York',
  PA: 'America/New_York',
  CT: 'America/New_York',
  MA: 'America/New_York',
  CA: 'America/Los_Angeles',
  TX: 'America/Chicago',
  IL: 'America/Chicago',
  FL: 'America/New_York',
  WA: 'America/Los_Angeles',
};

function regionKeyFromCoords(lat, lng) {
  const roundedLat = Math.round(Number(lat) * 10) / 10;
  const roundedLng = Math.round(Number(lng) * 10) / 10;
  return `geo:${roundedLat},${roundedLng}`;
}

function regionKeyFromLocation(location) {
  return `loc:${location.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

function timezoneForState(state) {
  if (!state) return 'America/New_York';
  return STATE_TIMEZONES[state.toUpperCase()] || 'America/New_York';
}

function primaryCuisine(categories = []) {
  const restaurantCategory = categories.find((c) => c.alias === 'restaurants');
  const primary =
    categories.find((c) => c.alias !== 'restaurants') || restaurantCategory || categories[0];
  return primary?.title || 'Restaurant';
}

function mapYelpBusiness(business, phoneOverride) {
  const phone = formatPhoneE164(phoneOverride || business.display_phone || business.phone);
  if (!phone) return null;

  const { location = {}, coordinates = {} } = business;
  const addressParts = [location.address1, location.address2, location.address3].filter(Boolean);

  const row = {
    yelp_id: business.id,
    name: business.name,
    phone,
    cuisine: primaryCuisine(business.categories),
    latitude: coordinates.latitude ?? null,
    longitude: coordinates.longitude ?? null,
    address: addressParts.join(', ') || null,
    city: location.city || null,
    state: location.state || null,
    zip_code: location.zip_code || null,
    image: business.image_url || null,
    rating: business.rating ?? null,
    review_count: business.review_count ?? null,
    source: 'yelp',
    call_eligible: true,
    timezone: timezoneForState(location.state),
    open_hour: 0,
    close_hour: 24,
    last_updated_at: Date.now(),
  };

  if (business.is_closed) return null;
  if (isChainName(row.name)) return null;
  if ((business.categories || []).some((c) => isExcludedYelpCategory(c.alias))) return null;
  if (!isCallEligibleRestaurant(row)) return null;

  return row;
}

async function upsertRestaurant(row) {
  const values = [
    row.yelp_id,
    row.name,
    row.phone,
    row.cuisine,
    row.latitude,
    row.longitude,
    row.address,
    row.city,
    row.state,
    row.zip_code,
    row.image,
    row.rating,
    row.review_count,
    row.source,
    row.call_eligible,
    row.timezone,
    row.open_hour,
    row.close_hour,
    row.last_updated_at,
  ];

  try {
    await query(
      `INSERT INTO restaurants (
        yelp_id, name, phone, cuisine, latitude, longitude,
        address, city, state, zip_code, image, rating, review_count, source,
        call_eligible, timezone, open_hour, close_hour, last_updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19
      )
      ON CONFLICT (yelp_id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        cuisine = EXCLUDED.cuisine,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        zip_code = EXCLUDED.zip_code,
        image = COALESCE(EXCLUDED.image, restaurants.image),
        rating = EXCLUDED.rating,
        review_count = EXCLUDED.review_count,
        source = EXCLUDED.source,
        call_eligible = EXCLUDED.call_eligible,
        timezone = EXCLUDED.timezone,
        last_updated_at = EXCLUDED.last_updated_at`,
      values
    );
  } catch (err) {
    if (err.code !== '23505') throw err;

    await query(
      `UPDATE restaurants SET
        yelp_id = COALESCE(yelp_id, $1),
        name = $2,
        cuisine = $3,
        latitude = $4,
        longitude = $5,
        address = $6,
        city = $7,
        state = $8,
        zip_code = $9,
        image = COALESCE($10, image),
        rating = $11,
        review_count = $12,
        source = $13,
        call_eligible = $14,
        timezone = $15,
        last_updated_at = $16
       WHERE phone = $17`,
      [
        row.yelp_id,
        row.name,
        row.cuisine,
        row.latitude,
        row.longitude,
        row.address,
        row.city,
        row.state,
        row.zip_code,
        row.image,
        row.rating,
        row.review_count,
        row.source,
        row.call_eligible,
        row.timezone,
        row.last_updated_at,
        row.phone,
      ]
    );
  }
}

async function shouldSyncRegion(regionKey, force) {
  if (force) return true;

  const { rows } = await query(
    'SELECT last_synced_at FROM restaurant_sync_regions WHERE region_key = $1',
    [regionKey]
  );
  if (!rows[0]) return true;

  const age = Date.now() - new Date(rows[0].last_synced_at).getTime();
  return age >= SYNC_TTL_MS;
}

async function markRegionSynced(regionKey, importedCount) {
  await query(
    `INSERT INTO restaurant_sync_regions (region_key, last_synced_at, imported_count)
     VALUES ($1, NOW(), $2)
     ON CONFLICT (region_key)
     DO UPDATE SET last_synced_at = NOW(), imported_count = EXCLUDED.imported_count`,
    [regionKey, importedCount]
  );
}

async function enrichPhoneIfMissing(business) {
  if (hasCallablePhone(business.display_phone || business.phone)) {
    return business.display_phone || business.phone;
  }

  try {
    const details = await getBusinessDetails(business.id);
    return details.display_phone || details.phone || null;
  } catch {
    return null;
  }
}

async function importYelpPage(businesses) {
  let imported = 0;

  for (const business of businesses) {
    let phone = business.display_phone || business.phone;
    if (!hasCallablePhone(phone)) {
      phone = await enrichPhoneIfMissing(business);
    }

    const row = mapYelpBusiness(business, phone);
    if (!row) continue;

    await upsertRestaurant(row);
    imported += 1;
  }

  return imported;
}

/**
 * Pull call-worthy restaurants from Yelp into Postgres.
 * Cached per ~0.1° grid or city string for YELP_SYNC_TTL_HOURS (default 24h).
 * When syncing by lat/lng, also syncs nearby town markets (Princeton, etc.).
 */
export async function syncRestaurantsFromYelp({
  lat,
  lng,
  location,
  force = false,
  radiusMeters = DEFAULT_RADIUS_METERS,
  includeExtraMarkets = false,
} = {}) {
  if (!isYelpConfigured()) {
    return { skipped: true, reason: 'YELP_API_KEY not configured', imported: 0 };
  }

  const latitude = lat != null ? Number(lat) : null;
  const longitude = lng != null ? Number(lng) : null;
  const locationText = typeof location === 'string' ? location.trim() : '';

  let regionKey;
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    regionKey = regionKeyFromCoords(latitude, longitude);
  } else if (locationText) {
    regionKey = regionKeyFromLocation(locationText);
  } else {
    return { skipped: true, reason: 'lat/lng or location required', imported: 0 };
  }

  if (!(await shouldSyncRegion(regionKey, force))) {
    if (!includeExtraMarkets || !EXTRA_SYNC_LOCATIONS.length) {
      return { skipped: true, reason: 'recently synced', imported: 0, regionKey };
    }
  } else {
    let totalImported = 0;
    let offset = 0;

    while (offset < MAX_RESULTS_PER_SYNC) {
      const limit = Math.min(50, MAX_RESULTS_PER_SYNC - offset);
      const result = await searchRestaurants({
        latitude: Number.isFinite(latitude) ? latitude : undefined,
        longitude: Number.isFinite(longitude) ? longitude : undefined,
        location: Number.isFinite(latitude) ? undefined : locationText,
        radiusMeters,
        limit,
        offset,
        sortBy: 'review_count',
      });

      const businesses = result.businesses || [];
      if (businesses.length === 0) break;

      totalImported += await importYelpPage(businesses);
      offset += businesses.length;

      if (businesses.length < limit) break;
    }

    await markRegionSynced(regionKey, totalImported);
    console.log(`✅ Yelp sync ${regionKey}: imported ${totalImported} restaurants`);

    if (includeExtraMarkets && EXTRA_SYNC_LOCATIONS.length) {
      for (const market of EXTRA_SYNC_LOCATIONS) {
        const sub = await syncRestaurantsFromYelp({
          location: market,
          force,
          radiusMeters,
          includeExtraMarkets: false,
        });
        totalImported += sub.imported || 0;
      }
    }

    return { skipped: false, imported: totalImported, regionKey };
  }

  let extraImported = 0;
  for (const market of EXTRA_SYNC_LOCATIONS) {
    const sub = await syncRestaurantsFromYelp({
      location: market,
      force,
      radiusMeters,
      includeExtraMarkets: false,
    });
    extraImported += sub.imported || 0;
  }

  return {
    skipped: extraImported === 0,
    reason: extraImported === 0 ? 'recently synced' : undefined,
    imported: extraImported,
    regionKey,
  };
}

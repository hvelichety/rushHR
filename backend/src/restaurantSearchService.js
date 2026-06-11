import { isYelpConfigured, searchRestaurants } from './yelpClient.js';
import { importYelpBusinesses } from './restaurantDiscovery.js';
import { mapRestaurantRow } from './restaurantService.js';
import { rankSearchResults } from './restaurantSearch.js';

const SEARCH_MARKETS = (
  process.env.YELP_SEARCH_MARKETS ||
  process.env.YELP_SYNC_EXTRA_LOCATIONS ||
  'Princeton, NJ,New Brunswick, NJ,Edison, NJ,Jersey City, NJ'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function buildYelpSearchPasses(term, lat, lng) {
  const passes = [];
  const latitude = lat != null ? Number(lat) : null;
  const longitude = lng != null ? Number(lng) : null;

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    passes.push({
      term,
      latitude,
      longitude,
      radiusMeters: 40000,
    });
  }

  for (const location of SEARCH_MARKETS) {
    passes.push({ term, location });
  }

  passes.push({ term, location: 'New Jersey' });

  return passes;
}

/**
 * Dedicated restaurant search: multi-market Yelp lookup → import → relevance rank.
 * Separate from the browse catalog so name searches are not buried in a huge list.
 */
export async function findRestaurantsBySearch({ q, lat, lng, limit = 40 } = {}) {
  const term = typeof q === 'string' ? q.trim() : '';
  if (term.length < 2) {
    return { results: [], yelpHits: 0, imported: 0 };
  }

  if (!isYelpConfigured()) {
    throw new Error('YELP_API_KEY is not set');
  }

  const userLat = lat != null && Number.isFinite(Number(lat)) ? Number(lat) : null;
  const userLng = lng != null && Number.isFinite(Number(lng)) ? Number(lng) : null;

  const seen = new Map();
  const passes = buildYelpSearchPasses(term, userLat, userLng);

  for (const pass of passes) {
    try {
      const result = await searchRestaurants({
        ...pass,
        limit: 50,
        sortBy: 'best_match',
      });
      for (const business of result.businesses || []) {
        if (!seen.has(business.id)) seen.set(business.id, business);
      }
    } catch (err) {
      console.warn('Yelp search pass failed:', pass.location || 'geo', err.message);
    }
  }

  const yelpHits = seen.size;
  const savedRows = await importYelpBusinesses([...seen.values()], { relaxed: true });

  const mapped = savedRows.map((row) =>
    mapRestaurantRow(row, { userLat, userLng })
  );

  const ranked = rankSearchResults(term, mapped).slice(0, limit);

  console.log(`🔍 Search "${term}": ${yelpHits} Yelp hits → ${savedRows.length} saved → ${ranked.length} shown`);

  return {
    results: ranked,
    yelpHits,
    imported: savedRows.length,
    query: term,
  };
}

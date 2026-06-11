/** Score how well a restaurant matches the user's search query. */
export function searchScore(query, restaurant) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const name = (restaurant.name || '').toLowerCase();
  const city = (restaurant.city || '').toLowerCase();
  const cuisine = (restaurant.cuisine || '').toLowerCase();
  const address = (restaurant.address || '').toLowerCase();
  const blob = `${name} ${city} ${cuisine} ${address}`;

  let score = 0;

  if (name === q) score += 2000;
  else if (name.startsWith(q)) score += 1000;
  else if (name.includes(q)) score += 500;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 0) {
    const matchedTokens = tokens.filter((t) => blob.includes(t)).length;
    score += matchedTokens * 200;
    if (matchedTokens === tokens.length) score += 300;
  }

  score += Math.min(Number(restaurant.review_count) || 0, 800) / 4;
  score += (Number(restaurant.rating) || 0) * 10;

  if (restaurant.distance_miles != null) {
    score -= Math.min(restaurant.distance_miles, 50) * 2;
  }

  return score;
}

export function matchesSearchQuery(query, restaurant) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const name = (restaurant.name || '').toLowerCase();
  const blob = [restaurant.name, restaurant.cuisine, restaurant.city, restaurant.state, restaurant.address]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (name.includes(q) || blob.includes(q)) return true;

  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => blob.includes(t));
}

export function rankSearchResults(query, restaurants) {
  return [...restaurants]
    .filter((r) => matchesSearchQuery(query, r))
    .sort((a, b) => searchScore(query, b) - searchScore(query, a));
}

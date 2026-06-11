/** Higher = more popular (Yelp review volume, then rating, then closer). */
export function compareByPopularity(a, b) {
  const reviewsA = Number(a.review_count) || 0;
  const reviewsB = Number(b.review_count) || 0;
  if (reviewsB !== reviewsA) return reviewsB - reviewsA;

  const ratingA = Number(a.rating) || 0;
  const ratingB = Number(b.rating) || 0;
  if (ratingB !== ratingA) return ratingB - ratingA;

  const distA = a.distance_miles ?? Number.POSITIVE_INFINITY;
  const distB = b.distance_miles ?? Number.POSITIVE_INFINITY;
  if (distA !== distB) return distA - distB;

  return String(a.name || '').localeCompare(String(b.name || ''));
}

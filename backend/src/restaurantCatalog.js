/** Chains / fast food people rarely call for wait times or custom questions */
export const CHAIN_BLOCKLIST = [
  'mcdonald',
  'burger king',
  'wendy',
  'taco bell',
  'chipotle',
  'subway',
  'starbucks',
  'dunkin',
  'chick-fil-a',
  'chick fil a',
  'five guys',
  'shake shack',
  'in-n-out',
  'popeyes',
  'kfc',
  'domino',
  'pizza hut',
  'papa john',
  'little caesars',
  'panera',
  'qdoba',
  "moe's",
  'jersey mike',
  'firehouse sub',
  'jimmy john',
  'panda express',
  'raising cane',
  'whataburger',
  'culver',
  'sonic drive',
  'jack in the box',
  "carl's jr",
  'hardee',
  'arbys',
  'checkers',
  "rally's",
  'white castle',
  'zaxby',
  'bojangles',
  'el pollo loco',
  'del taco',
  "steak 'n shake",
  'cava',
  'sweetgreen',
  'pret a manger',
  'jollibee',
  'tim hortons',
  'noodles & company',
  'potbelly',
  'waffle house',
  'ihop',
  "denny's",
  'applebee',
  'olive garden',
  'outback',
  'red lobster',
  "chili's",
  'tgi friday',
  'buffalo wild wings',
  'wingstop',
  'boston market',
  'nathans famous',
  'auntie anne',
  'cinnabon',
  'dairy queen',
  'baskin-robbins',
  'cold stone',
  'smoothie king',
  'jamba',
  'tropical smoothie',
  'mod pizza',
  'blaze pizza',
  'pieology',
  'wawa',
  'sheetz',
  '7-eleven',
  'costco food court',
];

const EXCLUDED_CUISINE = new Set([
  'fast food',
  'fast casual',
  'quick service',
  'food court',
  'convenience store',
]);

/** Yelp category aliases that are not worth calling (fast food, snacks, etc.) */
const YELP_EXCLUDED_CATEGORIES = new Set([
  'hotdogs',
  'hotdog',
  'foodstands',
  'food_court',
  'foodcourt',
  'convenience',
  'gasstations',
  'donuts',
  'icecream',
  'juicebars',
  'bubbletea',
  'foodtrucks',
  'streetvendors',
  'pretzels',
  'popcorn',
  'bagels',
  'coffeeroasteries',
  'cafes',
  'coffee',
  'desserts',
  'candy',
  'churros',
  'gelato',
  'shavedice',
  'smoothies',
  'tea',
  'winetastingroom',
  'breweries',
  'brewpubs',
  'sportsbars',
  'divebars',
  'cocktailbars',
  'wine_bars',
  'beerbar',
  'pubs',
  'lounges',
  'karaoke',
  'nightlife',
]);

/** Yelp aliases for full-service Indian / South Asian restaurants */
const INDIAN_CATEGORY_ALIASES = new Set([
  'indpak',
  'indian',
  'himalayan',
  'pakistani',
  'bangladeshi',
  'srilankan',
]);

export function isIndianRestaurant(categories = [], name = '') {
  const aliases = categories.map((c) => (c.alias || '').toLowerCase());
  if (aliases.some((alias) => INDIAN_CATEGORY_ALIASES.has(alias))) return true;
  return /\bindian\b|\bveg restaurant\b|\bsouth indian\b/i.test(name || '');
}

export function deriveCuisineFromYelp(categories = [], name = '') {
  if (isIndianRestaurant(categories, name)) return 'Indian';

  const restaurantCategory = categories.find((c) => c.alias === 'restaurants');
  const primary =
    categories.find((c) => c.alias !== 'restaurants') || restaurantCategory || categories[0];
  return primary?.title || 'Restaurant';
}

export function shouldExcludeYelpBusiness(categories = [], name = '') {
  if (isIndianRestaurant(categories, name)) return false;

  const restaurantCategory = categories.find((c) => c.alias === 'restaurants');
  const primary =
    categories.find((c) => c.alias !== 'restaurants') || restaurantCategory || categories[0];
  return isExcludedYelpCategory(primary?.alias);
}

export function isExcludedYelpCategory(alias) {
  if (!alias) return false;
  return YELP_EXCLUDED_CATEGORIES.has(alias.toLowerCase());
}

export function isChainName(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return CHAIN_BLOCKLIST.some((chain) => lower.includes(chain));
}

export function hasCallablePhone(phone) {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10;
}

export function isCallEligibleRestaurant(row) {
  if (row.call_eligible === false) return false;
  if (!hasCallablePhone(row.phone)) return false;
  if (isChainName(row.name)) return false;

  const cuisine = (row.cuisine || '').trim().toLowerCase();
  if (cuisine && EXCLUDED_CUISINE.has(cuisine)) return false;

  return true;
}

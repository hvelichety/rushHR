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

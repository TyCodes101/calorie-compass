export type ProductFamily = {
  id: string;
  canonicalTokens: string[];
  aliases: string[];
  typoAliases: string[];
  incompatibleFamilies: string[];
  requiredTokens: string[];
  allowedModifiers: string[];
  restaurant?: string | null;
  brand?: string | null;
};

const burgerFamilies = [
  'wendys_baconator',
  'wendys_son_of_baconator',
  'mcdonalds_mcdouble',
  'mcdonalds_big_mac',
  'mcdonalds_double_cheeseburger',
];

const chickenSandwichFamilies = [
  'wendys_spicy_chicken',
  'wendys_homestyle_chicken',
  'mcdonalds_mcchicken',
];

export const productFamilies: ProductFamily[] = [
  {
    id: 'wendys_baconator',
    canonicalTokens: ['wendys', 'baconator'],
    aliases: ["wendy's baconator", 'wendys baconator', 'baconator'],
    typoAliases: ["wendy's baconnator", 'wendys baconnator', 'baconnator'],
    incompatibleFamilies: chickenSandwichFamilies,
    requiredTokens: ['baconator'],
    allowedModifiers: ['no cheese', 'extra cheese', 'no mayo', 'no ketchup'],
    restaurant: "Wendy's",
    brand: "Wendy's",
  },
  {
    id: 'wendys_son_of_baconator',
    canonicalTokens: ['wendys', 'son', 'baconator'],
    aliases: ["wendy's son of baconator", 'wendys son of baconator', 'son of baconator'],
    typoAliases: ["wendy's son of baconnator", 'wendys son of baconnator', 'son of baconnator'],
    incompatibleFamilies: chickenSandwichFamilies,
    requiredTokens: ['baconator'],
    allowedModifiers: ['no cheese', 'extra cheese', 'no mayo', 'no ketchup'],
    restaurant: "Wendy's",
    brand: "Wendy's",
  },
  {
    id: 'wendys_spicy_chicken',
    canonicalTokens: ['wendys', 'spicy', 'chicken'],
    aliases: ["wendy's spicy chicken sandwich", 'wendys spicy chicken sandwich', 'spicy chicken sandwich'],
    typoAliases: [],
    incompatibleFamilies: ['wendys_baconator', 'wendys_son_of_baconator'],
    requiredTokens: ['spicy', 'chicken'],
    allowedModifiers: ['grilled', 'no mayo', 'extra mayo'],
    restaurant: "Wendy's",
    brand: "Wendy's",
  },
  {
    id: 'wendys_homestyle_chicken',
    canonicalTokens: ['wendys', 'homestyle', 'chicken'],
    aliases: [
      "wendy's homestyle chicken fillet sandwich",
      'wendys homestyle chicken fillet sandwich',
      "wendy's homestyle chicken sandwich",
      'wendys homestyle chicken sandwich',
      'homestyle chicken fillet sandwich',
      'homestyle chicken sandwich',
      'classic chicken sandwich',
    ],
    typoAliases: [],
    incompatibleFamilies: ['wendys_baconator', 'wendys_son_of_baconator'],
    requiredTokens: ['chicken'],
    allowedModifiers: ['grilled', 'no mayo', 'extra mayo'],
    restaurant: "Wendy's",
    brand: "Wendy's",
  },
  {
    id: 'mcdonalds_mcdouble',
    canonicalTokens: ['mcdonalds', 'mcdouble'],
    aliases: ["mcdonald's mcdouble", 'mcdonalds mcdouble', 'mcdouble', 'mc double', 'mcdoubles'],
    typoAliases: ['mcduble', 'mc duble'],
    incompatibleFamilies: ['mcdonalds_mcchicken', 'wendys_spicy_chicken', 'wendys_homestyle_chicken'],
    requiredTokens: ['mcdouble'],
    allowedModifiers: ['no cheese', 'without cheese', 'extra cheese', 'no pickle', 'no ketchup', 'no mustard'],
    restaurant: "McDonald's",
    brand: "McDonald's",
  },
  {
    id: 'mcdonalds_mcchicken',
    canonicalTokens: ['mcdonalds', 'mcchicken'],
    aliases: ["mcdonald's mcchicken", 'mcdonalds mcchicken', 'mcchicken', 'mc chicken'],
    typoAliases: [],
    incompatibleFamilies: burgerFamilies,
    requiredTokens: ['mcchicken'],
    allowedModifiers: ['no mayo', 'extra mayo', 'no lettuce'],
    restaurant: "McDonald's",
    brand: "McDonald's",
  },
  {
    id: 'mcdonalds_big_mac',
    canonicalTokens: ['mcdonalds', 'big', 'mac'],
    aliases: ["mcdonald's big mac", 'mcdonalds big mac', 'big mac', 'bigmac'],
    typoAliases: [],
    incompatibleFamilies: ['mcdonalds_mcchicken'],
    requiredTokens: ['big', 'mac'],
    allowedModifiers: ['no cheese', 'extra cheese', 'no sauce', 'extra sauce'],
    restaurant: "McDonald's",
    brand: "McDonald's",
  },
  {
    id: 'mcdonalds_double_cheeseburger',
    canonicalTokens: ['mcdonalds', 'double', 'cheeseburger'],
    aliases: ["mcdonald's double cheeseburger", 'mcdonalds double cheeseburger', 'double cheeseburger'],
    typoAliases: [],
    incompatibleFamilies: ['mcdonalds_mcchicken'],
    requiredTokens: ['double', 'cheeseburger'],
    allowedModifiers: ['no cheese', 'without cheese', 'extra cheese'],
    restaurant: "McDonald's",
    brand: "McDonald's",
  },
  {
    id: 'subway_meatball_marinara',
    canonicalTokens: ['subway', 'meatball', 'marinara'],
    aliases: [
      'subway meatball marinara',
      'subway meatball marinara sub',
      'subway meatball',
      'meatball marinara',
      'meatball marinara sub',
      'meatball sub',
      'subway meatball footlong',
      'meatball footlong',
    ],
    typoAliases: [],
    incompatibleFamilies: ['arbys_roast_beef'],
    requiredTokens: ['meatball'],
    allowedModifiers: ['footlong', '6 inch', 'six inch', 'cheese', 'no cheese'],
    restaurant: 'Subway',
    brand: 'Subway',
  },
  {
    id: 'arbys_roast_beef',
    canonicalTokens: ['arbys', 'roast', 'beef'],
    aliases: [
      "arby's classic roast beef",
      'arbys classic roast beef',
      "arby's roast beef",
      'arbys roast beef',
      'classic roast beef sandwich',
      'roast beef sandwich',
    ],
    typoAliases: ['arby roast beef'],
    incompatibleFamilies: ['subway_meatball_marinara', 'wendys_spicy_chicken', 'wendys_homestyle_chicken', 'mcdonalds_mcchicken'],
    requiredTokens: ['roast', 'beef'],
    allowedModifiers: ['classic', 'double'],
    restaurant: "Arby's",
    brand: "Arby's",
  },
  {
    id: 'chipotle_bowl',
    canonicalTokens: ['chipotle', 'bowl'],
    aliases: ['chipotle bowl', 'chipotle chicken bowl', 'chipotle burrito bowl', 'burrito bowl'],
    typoAliases: ['chipolte bowl'],
    incompatibleFamilies: [],
    requiredTokens: ['chipotle'],
    allowedModifiers: ['rice', 'beans', 'chicken', 'steak', 'cheese', 'salsa', 'lettuce', 'guac'],
    restaurant: 'Chipotle',
    brand: 'Chipotle',
  },
  {
    id: 'generic_grilled_chicken_breast',
    canonicalTokens: ['grilled', 'chicken', 'breast'],
    aliases: ['grilled chicken breast', 'chicken breast', 'grilled chicken'],
    typoAliases: [],
    incompatibleFamilies: ['mcdonalds_mcdouble', 'wendys_baconator', 'wendys_son_of_baconator'],
    requiredTokens: ['chicken'],
    allowedModifiers: ['grilled', 'skinless'],
  },
  {
    id: 'generic_asparagus',
    canonicalTokens: ['asparagus'],
    aliases: ['asparagus', 'asparagus spears'],
    typoAliases: [],
    incompatibleFamilies: [],
    requiredTokens: ['asparagus'],
    allowedModifiers: ['steamed', 'cooked', 'grilled', 'raw'],
  },
  {
    id: 'generic_corn_on_the_cob',
    canonicalTokens: ['corn', 'cob'],
    aliases: ['corn on the cob', 'buttered corn on the cob', 'corn cob'],
    typoAliases: [],
    incompatibleFamilies: ['chipotle_bowl'],
    requiredTokens: ['corn'],
    allowedModifiers: ['buttered', 'no butter', 'plain'],
  },
];

export function normalizeProductFamilyText(text: string | null | undefined) {
  return (text ?? '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/\bbaconnator\b/g, 'baconator')
    .replace(/\bmc\s*double\b/g, 'mcdouble')
    .replace(/\bmc\s*chicken\b/g, 'mcchicken')
    .replace(/\bbigmac\b/g, 'big mac')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedAliases(family: ProductFamily) {
  return [...family.aliases, ...family.typoAliases].map(normalizeProductFamilyText);
}

function containsPhrase(text: string, phrase: string) {
  return Boolean(phrase) && new RegExp(`(?:^| )${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: |$)`).test(text);
}

export function getProductFamily(id: string | null | undefined) {
  if (!id) return null;
  return productFamilies.find((family) => family.id === id) ?? null;
}

export function detectProductFamilies(text: string | null | undefined): ProductFamily[] {
  const normalized = normalizeProductFamilyText(text);
  if (!normalized) return [];

  return productFamilies
    .map((family) => {
      const alias = normalizedAliases(family)
        .filter((candidate) => containsPhrase(normalized, candidate))
        .sort((left, right) => right.length - left.length)[0];
      return alias ? { family, aliasLength: alias.length } : null;
    })
    .filter((entry): entry is { family: ProductFamily; aliasLength: number } => Boolean(entry))
    .sort((left, right) => right.aliasLength - left.aliasLength)
    .map((entry) => entry.family);
}

export function inferProductFamilyId(...texts: Array<string | null | undefined>) {
  const family = detectProductFamilies(texts.filter(Boolean).join(' '))[0];
  return family?.id ?? null;
}

export function productFamilyHasToken(family: ProductFamily, text: string, token: string) {
  return normalizeProductFamilyText(text).split(' ').includes(normalizeProductFamilyText(token));
}

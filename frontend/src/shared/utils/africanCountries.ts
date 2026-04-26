/**
 * All 54 African countries with region, ISO code, currency code,
 * currency name and IANA timezone.
 * Grouped by AU region for use in dropdowns, filters and region scoping.
 */

export type AfricanRegion =
  | 'East Africa'
  | 'West Africa'
  | 'North Africa'
  | 'Central Africa'
  | 'Southern Africa';

export interface AfricanCountry {
  code: string;          // ISO 3166-1 alpha-3
  name: string;
  region: AfricanRegion;
  currency: string;      // ISO 4217 currency code
  currencyName: string;
  timezone: string;      // IANA timezone
}

export const AFRICAN_COUNTRIES: AfricanCountry[] = [
  // ── East Africa (18) ──────────────────────────────────────────────────────
  { code: 'BDI', name: 'Burundi',       region: 'East Africa', currency: 'BIF', currencyName: 'Burundian Franc',       timezone: 'Africa/Bujumbura' },
  { code: 'COM', name: 'Comoros',       region: 'East Africa', currency: 'KMF', currencyName: 'Comorian Franc',        timezone: 'Indian/Comoro' },
  { code: 'DJI', name: 'Djibouti',      region: 'East Africa', currency: 'DJF', currencyName: 'Djiboutian Franc',      timezone: 'Africa/Djibouti' },
  { code: 'ERI', name: 'Eritrea',       region: 'East Africa', currency: 'ERN', currencyName: 'Eritrean Nakfa',        timezone: 'Africa/Asmara' },
  { code: 'ETH', name: 'Ethiopia',      region: 'East Africa', currency: 'ETB', currencyName: 'Ethiopian Birr',        timezone: 'Africa/Addis_Ababa' },
  { code: 'KEN', name: 'Kenya',         region: 'East Africa', currency: 'KES', currencyName: 'Kenyan Shilling',       timezone: 'Africa/Nairobi' },
  { code: 'MDG', name: 'Madagascar',    region: 'East Africa', currency: 'MGA', currencyName: 'Malagasy Ariary',       timezone: 'Indian/Antananarivo' },
  { code: 'MWI', name: 'Malawi',        region: 'East Africa', currency: 'MWK', currencyName: 'Malawian Kwacha',       timezone: 'Africa/Blantyre' },
  { code: 'MUS', name: 'Mauritius',     region: 'East Africa', currency: 'MUR', currencyName: 'Mauritian Rupee',       timezone: 'Indian/Mauritius' },
  { code: 'MOZ', name: 'Mozambique',    region: 'East Africa', currency: 'MZN', currencyName: 'Mozambican Metical',    timezone: 'Africa/Maputo' },
  { code: 'RWA', name: 'Rwanda',        region: 'East Africa', currency: 'RWF', currencyName: 'Rwandan Franc',         timezone: 'Africa/Kigali' },
  { code: 'SYC', name: 'Seychelles',    region: 'East Africa', currency: 'SCR', currencyName: 'Seychellois Rupee',     timezone: 'Indian/Mahe' },
  { code: 'SOM', name: 'Somalia',       region: 'East Africa', currency: 'SOS', currencyName: 'Somali Shilling',       timezone: 'Africa/Mogadishu' },
  { code: 'SSD', name: 'South Sudan',   region: 'East Africa', currency: 'SSP', currencyName: 'South Sudanese Pound',  timezone: 'Africa/Juba' },
  { code: 'TZA', name: 'Tanzania',      region: 'East Africa', currency: 'TZS', currencyName: 'Tanzanian Shilling',    timezone: 'Africa/Dar_es_Salaam' },
  { code: 'UGA', name: 'Uganda',        region: 'East Africa', currency: 'UGX', currencyName: 'Ugandan Shilling',      timezone: 'Africa/Kampala' },
  { code: 'ZMB', name: 'Zambia',        region: 'East Africa', currency: 'ZMW', currencyName: 'Zambian Kwacha',        timezone: 'Africa/Lusaka' },
  { code: 'ZWE', name: 'Zimbabwe',      region: 'East Africa', currency: 'ZWL', currencyName: 'Zimbabwean Dollar',     timezone: 'Africa/Harare' },

  // ── West Africa (16) ──────────────────────────────────────────────────────
  { code: 'BEN', name: 'Benin',         region: 'West Africa', currency: 'XOF', currencyName: 'West African CFA Franc', timezone: 'Africa/Porto-Novo' },
  { code: 'BFA', name: 'Burkina Faso',  region: 'West Africa', currency: 'XOF', currencyName: 'West African CFA Franc', timezone: 'Africa/Ouagadougou' },
  { code: 'CPV', name: 'Cabo Verde',    region: 'West Africa', currency: 'CVE', currencyName: 'Cape Verdean Escudo',    timezone: 'Atlantic/Cape_Verde' },
  { code: 'CIV', name: "Côte d'Ivoire", region: 'West Africa', currency: 'XOF', currencyName: 'West African CFA Franc', timezone: 'Africa/Abidjan' },
  { code: 'GMB', name: 'Gambia',        region: 'West Africa', currency: 'GMD', currencyName: 'Gambian Dalasi',         timezone: 'Africa/Banjul' },
  { code: 'GHA', name: 'Ghana',         region: 'West Africa', currency: 'GHS', currencyName: 'Ghanaian Cedi',          timezone: 'Africa/Accra' },
  { code: 'GIN', name: 'Guinea',        region: 'West Africa', currency: 'GNF', currencyName: 'Guinean Franc',          timezone: 'Africa/Conakry' },
  { code: 'GNB', name: 'Guinea-Bissau', region: 'West Africa', currency: 'XOF', currencyName: 'West African CFA Franc', timezone: 'Africa/Bissau' },
  { code: 'LBR', name: 'Liberia',       region: 'West Africa', currency: 'LRD', currencyName: 'Liberian Dollar',        timezone: 'Africa/Monrovia' },
  { code: 'MLI', name: 'Mali',          region: 'West Africa', currency: 'XOF', currencyName: 'West African CFA Franc', timezone: 'Africa/Bamako' },
  { code: 'MRT', name: 'Mauritania',    region: 'West Africa', currency: 'MRU', currencyName: 'Mauritanian Ouguiya',    timezone: 'Africa/Nouakchott' },
  { code: 'NER', name: 'Niger',         region: 'West Africa', currency: 'XOF', currencyName: 'West African CFA Franc', timezone: 'Africa/Niamey' },
  { code: 'NGA', name: 'Nigeria',       region: 'West Africa', currency: 'NGN', currencyName: 'Nigerian Naira',         timezone: 'Africa/Lagos' },
  { code: 'SEN', name: 'Senegal',       region: 'West Africa', currency: 'XOF', currencyName: 'West African CFA Franc', timezone: 'Africa/Dakar' },
  { code: 'SLE', name: 'Sierra Leone',  region: 'West Africa', currency: 'SLL', currencyName: 'Sierra Leonean Leone',   timezone: 'Africa/Freetown' },
  { code: 'TGO', name: 'Togo',          region: 'West Africa', currency: 'XOF', currencyName: 'West African CFA Franc', timezone: 'Africa/Lome' },

  // ── North Africa (6) ──────────────────────────────────────────────────────
  { code: 'DZA', name: 'Algeria',       region: 'North Africa', currency: 'DZD', currencyName: 'Algerian Dinar',   timezone: 'Africa/Algiers' },
  { code: 'EGY', name: 'Egypt',         region: 'North Africa', currency: 'EGP', currencyName: 'Egyptian Pound',   timezone: 'Africa/Cairo' },
  { code: 'LBY', name: 'Libya',         region: 'North Africa', currency: 'LYD', currencyName: 'Libyan Dinar',     timezone: 'Africa/Tripoli' },
  { code: 'MAR', name: 'Morocco',       region: 'North Africa', currency: 'MAD', currencyName: 'Moroccan Dirham',  timezone: 'Africa/Casablanca' },
  { code: 'SDN', name: 'Sudan',         region: 'North Africa', currency: 'SDG', currencyName: 'Sudanese Pound',   timezone: 'Africa/Khartoum' },
  { code: 'TUN', name: 'Tunisia',       region: 'North Africa', currency: 'TND', currencyName: 'Tunisian Dinar',   timezone: 'Africa/Tunis' },

  // ── Central Africa (9) ────────────────────────────────────────────────────
  { code: 'AGO', name: 'Angola',                   region: 'Central Africa', currency: 'AOA', currencyName: 'Angolan Kwanza',           timezone: 'Africa/Luanda' },
  { code: 'CMR', name: 'Cameroon',                 region: 'Central Africa', currency: 'XAF', currencyName: 'Central African CFA Franc', timezone: 'Africa/Douala' },
  { code: 'CAF', name: 'Central African Republic', region: 'Central Africa', currency: 'XAF', currencyName: 'Central African CFA Franc', timezone: 'Africa/Bangui' },
  { code: 'TCD', name: 'Chad',                     region: 'Central Africa', currency: 'XAF', currencyName: 'Central African CFA Franc', timezone: 'Africa/Ndjamena' },
  { code: 'COG', name: 'Congo (Republic)',          region: 'Central Africa', currency: 'XAF', currencyName: 'Central African CFA Franc', timezone: 'Africa/Brazzaville' },
  { code: 'COD', name: 'Congo (DRC)',               region: 'Central Africa', currency: 'CDF', currencyName: 'Congolese Franc',           timezone: 'Africa/Kinshasa' },
  { code: 'GNQ', name: 'Equatorial Guinea',         region: 'Central Africa', currency: 'XAF', currencyName: 'Central African CFA Franc', timezone: 'Africa/Malabo' },
  { code: 'GAB', name: 'Gabon',                     region: 'Central Africa', currency: 'XAF', currencyName: 'Central African CFA Franc', timezone: 'Africa/Libreville' },
  { code: 'STP', name: 'São Tomé and Príncipe',     region: 'Central Africa', currency: 'STN', currencyName: 'São Tomé Dobra',            timezone: 'Africa/Sao_Tome' },

  // ── Southern Africa (5) ───────────────────────────────────────────────────
  { code: 'BWA', name: 'Botswana',     region: 'Southern Africa', currency: 'BWP', currencyName: 'Botswana Pula',      timezone: 'Africa/Gaborone' },
  { code: 'SWZ', name: 'Eswatini',    region: 'Southern Africa', currency: 'SZL', currencyName: 'Swazi Lilangeni',    timezone: 'Africa/Mbabane' },
  { code: 'LSO', name: 'Lesotho',     region: 'Southern Africa', currency: 'LSL', currencyName: 'Lesotho Loti',       timezone: 'Africa/Maseru' },
  { code: 'NAM', name: 'Namibia',     region: 'Southern Africa', currency: 'NAD', currencyName: 'Namibian Dollar',    timezone: 'Africa/Windhoek' },
  { code: 'ZAF', name: 'South Africa',region: 'Southern Africa', currency: 'ZAR', currencyName: 'South African Rand', timezone: 'Africa/Johannesburg' },
];

/** All 5 AU regions */
export const AFRICAN_REGIONS: AfricanRegion[] = [
  'East Africa',
  'West Africa',
  'North Africa',
  'Central Africa',
  'Southern Africa',
];

/** Countries grouped by region — useful for grouped dropdowns */
export const COUNTRIES_BY_REGION: Record<AfricanRegion, AfricanCountry[]> =
  AFRICAN_REGIONS.reduce((acc, region) => {
    acc[region] = AFRICAN_COUNTRIES.filter(c => c.region === region);
    return acc;
  }, {} as Record<AfricanRegion, AfricanCountry[]>);

/** Quick lookup by ISO code */
export const COUNTRY_BY_CODE: Record<string, AfricanCountry> =
  AFRICAN_COUNTRIES.reduce((acc, c) => { acc[c.code] = c; return acc; }, {} as Record<string, AfricanCountry>);

/** Quick lookup by name */
export const COUNTRY_BY_NAME: Record<string, AfricanCountry> =
  AFRICAN_COUNTRIES.reduce((acc, c) => { acc[c.name] = c; return acc; }, {} as Record<string, AfricanCountry>);

/** Get currency for a country name (used in payment forms) */
export function getCurrencyForCountry(countryName: string): string {
  return COUNTRY_BY_NAME[countryName]?.currency ?? 'USD';
}

/** Get currency name for a country name */
export function getCurrencyNameForCountry(countryName: string): string {
  return COUNTRY_BY_NAME[countryName]?.currencyName ?? 'US Dollar';
}

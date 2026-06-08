import { Product } from "@/shared/types";

export type MarketplaceCurrency = Product["currency"];

export interface CountryCurrency {
  code: MarketplaceCurrency;
  label: string;
  symbol: string;
}

const DEFAULT_CURRENCY: CountryCurrency = {
  code: "USD",
  label: "USD ($)",
  symbol: "$",
};

const CURRENCY_META: Record<MarketplaceCurrency, Omit<CountryCurrency, "code">> = {
  USD: { label: "USD ($)", symbol: "$" },
  EUR: { label: "EUR (€)", symbol: "€" },
  GBP: { label: "GBP (£)", symbol: "£" },
  GHS: { label: "GHS (₵)", symbol: "₵" },
  NGN: { label: "NGN (₦)", symbol: "₦" },
  KES: { label: "KES (KSh)", symbol: "KSh" },
  ZAR: { label: "ZAR (R)", symbol: "R" },
  XOF: { label: "XOF (CFA)", symbol: "CFA" },
  XAF: { label: "XAF (FCFA)", symbol: "FCFA" },
};

/** Country name or ISO code → marketplace currency (signup location). */
const COUNTRY_CURRENCY_MAP: Record<string, MarketplaceCurrency> = {
  ghana: "GHS",
  gh: "GHS",
  nigeria: "NGN",
  ng: "NGN",
  kenya: "KES",
  ke: "KES",
  "south africa": "ZAR",
  za: "ZAR",
  senegal: "XOF",
  sn: "XOF",
  "ivory coast": "XOF",
  "côte d'ivoire": "XOF",
  "cote d'ivoire": "XOF",
  ci: "XOF",
  benin: "XOF",
  bj: "XOF",
  "burkina faso": "XOF",
  bf: "XOF",
  mali: "XOF",
  ml: "XOF",
  niger: "XOF",
  ne: "XOF",
  togo: "XOF",
  tg: "XOF",
  cameroon: "XAF",
  cm: "XAF",
  "central african republic": "XAF",
  cf: "XAF",
  chad: "XAF",
  td: "XAF",
  congo: "XAF",
  cg: "XAF",
  gabon: "XAF",
  ga: "XAF",
  "equatorial guinea": "XAF",
  gq: "XAF",
  ethiopia: "USD",
  et: "USD",
  tanzania: "USD",
  tz: "USD",
  uganda: "USD",
  ug: "USD",
  rwanda: "USD",
  rw: "USD",
  egypt: "USD",
  eg: "USD",
  morocco: "USD",
  ma: "USD",
  "united states": "USD",
  us: "USD",
  "united states of america": "USD",
  "united kingdom": "GBP",
  gb: "GBP",
  uk: "GBP",
  canada: "USD",
  ca: "USD",
  france: "EUR",
  fr: "EUR",
  germany: "EUR",
  de: "EUR",
};

function normalizeCountryKey(country: string): string {
  return country.trim().toLowerCase().replace(/\./g, "");
}

export function getCurrencyForCountry(
  country: string | null | undefined
): CountryCurrency {
  if (!country?.trim()) {
    return DEFAULT_CURRENCY;
  }

  const code =
    COUNTRY_CURRENCY_MAP[normalizeCountryKey(country)] ?? DEFAULT_CURRENCY.code;
  const meta = CURRENCY_META[code];

  return { code, ...meta };
}

export function formatCurrencyDisplay(currency: MarketplaceCurrency): string {
  return CURRENCY_META[currency]?.label ?? currency;
}

// Billing helpers shared by the upgrade modal, checkout and subscription
// settings. The API decides who pays where; these only read its answers.

export const BILLING_CURRENCIES = [
  "NGN",
  "USD",
  "KES",
  "GHS",
  "UGX",
  "MWK",
  "RWF",
  "TZS",
  "XAF",
  "XOF",
  "ZMW",
] as const

export type BillingCurrency = (typeof BILLING_CURRENCIES)[number]
export type BillingProvider = "paystack" | "dodo" | "bachs"

export interface BillingOption {
  provider: BillingProvider
  currency: BillingCurrency
}

/** Where a church pays, and the card option offered beside mobile money. */
export interface BillingRoute extends BillingOption {
  fallback: BillingOption | null
}

/** Shape of `GET /app-config/geo`. `provider`/`fallback` are absent on older APIs. */
export interface GeoResponse {
  country?: string | null
  currency?: string | null
  provider?: string | null
  fallback?: { provider?: string | null; currency?: string | null } | null
}

export const DEFAULT_BILLING_ROUTE: BillingRoute = {
  provider: "dodo",
  currency: "USD",
  fallback: null,
}

const PROVIDERS: readonly string[] = ["paystack", "dodo", "bachs"]

export const isBillingCurrency = (value: unknown): value is BillingCurrency =>
  typeof value === "string" &&
  (BILLING_CURRENCIES as readonly string[]).includes(value)

export const isBillingProvider = (value: unknown): value is BillingProvider =>
  typeof value === "string" && PROVIDERS.includes(value)

/**
 * The provider that collects a currency: NGN on Paystack, USD on Dodo, every
 * mobile-money currency on Bachs. Used where only a currency is known (an
 * older API, a signup deep link, a dev override).
 */
export const providerForCurrency = (
  currency: BillingCurrency
): BillingProvider => {
  if (currency === "NGN") return "paystack"
  if (currency === "USD") return "dodo"
  return "bachs"
}

const optionFor = (currency: BillingCurrency): BillingRoute => ({
  provider: providerForCurrency(currency),
  currency,
  fallback: null,
})

/**
 * Turns the geo response into a route. `timeZone` covers a failed lookup, and
 * a visitor Cloudflare couldn't place: Nigeria (Africa/Lagos) still pays NGN.
 * Anything unreadable falls back to Dodo in USD.
 */
export const resolveBillingRoute = (
  geo: GeoResponse | null | undefined,
  timeZone?: string
): BillingRoute => {
  const inLagos = timeZone === "Africa/Lagos"

  if (!geo || !isBillingCurrency(geo.currency)) {
    return inLagos ? optionFor("NGN") : { ...DEFAULT_BILLING_ROUTE }
  }

  const provider = isBillingProvider(geo.provider)
    ? geo.provider
    : providerForCurrency(geo.currency)

  const fallback =
    geo.fallback &&
    isBillingProvider(geo.fallback.provider) &&
    isBillingCurrency(geo.fallback.currency)
      ? { provider: geo.fallback.provider, currency: geo.fallback.currency }
      : null

  // No country and nothing better than the default: the timezone decides.
  if (!geo.country && provider === "dodo" && !fallback && inLagos) {
    return optionFor("NGN")
  }

  return { provider, currency: geo.currency, fallback }
}

/** A route forced by the dev-only `test_currency` override. */
export const routeForCurrency = (currency: BillingCurrency): BillingRoute =>
  optionFor(currency)

/**
 * Formats a price in its own currency: `$69.99`, `₦49,999.99`, `KES 499`,
 * `USh 15,500`. Whole amounts drop their `.00` unless `keepDecimals` is set.
 */
export const formatPrice = (
  amount: number,
  currency: string,
  { keepDecimals = false }: { keepDecimals?: boolean } = {}
): string => {
  const options: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }
  if (!keepDecimals && Number.isInteger(amount)) {
    options.minimumFractionDigits = 0
    options.maximumFractionDigits = 0
  }
  try {
    return new Intl.NumberFormat("en", options).format(amount)
  } catch {
    // An engine without narrowSymbol or this currency: show the code.
    return `${currency} ${amount.toLocaleString("en")}`
  }
}

/**
 * True when the church has to pay again by hand to keep Teams: mobile money,
 * Paystack bank transfers and admin-granted plans. A card subscription
 * renews itself, so it gets no Renew prompt.
 */
export const needsManualRenewal = (
  subscription:
    | { status?: string | null; canUpdatePaymentMethod?: boolean }
    | null
    | undefined
): boolean =>
  subscription?.status === "active" &&
  subscription.canUpdatePaymentMethod !== true

/**
 * The API sends the period end as `currentPeriodEnd`; the app reads
 * `expiresAt`. Copies one onto the other so every screen sees the date.
 */
export const normalizeSubscriptionDetails = <
  T extends {
    activeSubscription?: Record<string, any> | null
    billingHistory?: Record<string, any>[]
  } | null,
>(
  details: T
): T => {
  if (!details) return details
  const withExpiry = (record: Record<string, any>) => ({
    ...record,
    expiresAt: record.expiresAt ?? record.currentPeriodEnd ?? null,
  })
  return {
    ...details,
    activeSubscription: details.activeSubscription
      ? withExpiry(details.activeSubscription)
      : (details.activeSubscription ?? null),
    ...(Array.isArray(details.billingHistory)
      ? { billingHistory: details.billingHistory.map(withExpiry) }
      : {}),
  }
}

/**
 * Hosts that serve Bachs checkouts: live, and sandbox. The checkout URL comes
 * from our API; this keeps the overlay from opening a page anywhere else.
 */
const BACHS_CHECKOUT_ORIGINS: readonly string[] = [
  "https://checkout.bachs.io",
  "https://sandbox-checkout.bachs.io",
]

/** The Bachs checkout origin a checkout URL lives on, or null if it isn't one. */
export const bachsCheckoutOrigin = (checkoutUrl: string): string | null => {
  try {
    const origin = new URL(checkoutUrl).origin
    return BACHS_CHECKOUT_ORIGINS.includes(origin) ? origin : null
  } catch {
    return null
  }
}

/** Dev only: a country to send as `cf-ipcountry`, set in localStorage. */
export const readTestCountry = (raw: string | null | undefined) =>
  typeof raw === "string" && /^[A-Za-z]{2}$/.test(raw.trim())
    ? raw.trim().toUpperCase()
    : null

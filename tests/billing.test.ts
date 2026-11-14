import { describe, expect, it } from "vitest"
import {
  bachsCheckoutOrigin,
  formatPrice as format,
  needsManualRenewal,
  normalizeSubscriptionDetails,
  providerForCurrency,
  readTestCountry,
  resolveBillingRoute,
} from "~/utils/billing"

describe("resolveBillingRoute", () => {
  it("trusts the API's provider, currency and card fallback", () => {
    expect(
      resolveBillingRoute({
        country: "KE",
        currency: "KES",
        provider: "bachs",
        fallback: { provider: "dodo", currency: "USD" },
      })
    ).toEqual({
      provider: "bachs",
      currency: "KES",
      fallback: { provider: "dodo", currency: "USD" },
    })
  })

  it("keeps an existing church on the provider the API names", () => {
    expect(
      resolveBillingRoute({ country: "KE", currency: "USD", provider: "dodo", fallback: null })
    ).toEqual({ provider: "dodo", currency: "USD", fallback: null })
  })

  it("derives the provider from the currency on an older API", () => {
    expect(resolveBillingRoute({ country: "NG", currency: "NGN" })).toEqual({
      provider: "paystack",
      currency: "NGN",
      fallback: null,
    })
    expect(resolveBillingRoute({ country: "GB", currency: "USD" })).toEqual({
      provider: "dodo",
      currency: "USD",
      fallback: null,
    })
  })

  it("ignores an unknown currency, provider or fallback", () => {
    expect(resolveBillingRoute({ country: "KE", currency: "EUR", provider: "bachs" })).toEqual({
      provider: "dodo",
      currency: "USD",
      fallback: null,
    })
    expect(
      resolveBillingRoute({
        country: "KE",
        currency: "KES",
        provider: "stripe",
        fallback: { provider: "dodo", currency: "EUR" },
      })
    ).toEqual({ provider: "bachs", currency: "KES", fallback: null })
  })

  it("uses the timezone when the lookup fails or Cloudflare has no country", () => {
    expect(resolveBillingRoute(null, "Africa/Lagos")).toMatchObject({ provider: "paystack", currency: "NGN" })
    expect(resolveBillingRoute(null, "Europe/London")).toMatchObject({ provider: "dodo", currency: "USD" })
    expect(
      resolveBillingRoute({ country: null, currency: "USD", provider: "dodo", fallback: null }, "Africa/Lagos")
    ).toMatchObject({ provider: "paystack", currency: "NGN" })
  })

  it("never lets the timezone override a country Cloudflare knows", () => {
    expect(
      resolveBillingRoute({ country: "GB", currency: "USD", provider: "dodo", fallback: null }, "Africa/Lagos")
    ).toMatchObject({ provider: "dodo", currency: "USD" })
  })
})

describe("providerForCurrency", () => {
  it("maps NGN to Paystack, USD to Dodo and mobile money to Bachs", () => {
    expect(providerForCurrency("NGN")).toBe("paystack")
    expect(providerForCurrency("USD")).toBe("dodo")
    expect(providerForCurrency("KES")).toBe("bachs")
    expect(providerForCurrency("XOF")).toBe("bachs")
  })
})

describe("formatPrice", () => {
  // Intl separates a code from the number with a non-breaking space.
  const formatPrice = (...args: Parameters<typeof format>) => format(...args).replace(/[\u00a0\u202f]/g, " ")

  it("shows each currency's own symbol, never a bare $", () => {
    expect(formatPrice(69.99, "USD")).toBe("$69.99")
    expect(formatPrice(49999.99, "NGN")).toBe("₦49,999.99")
    expect(formatPrice(499, "KES")).toBe("KES 499")
    expect(formatPrice(45, "GHS")).toBe("GH₵45")
    expect(formatPrice(15500, "UGX")).toBe("UGX 15,500")
    expect(formatPrice(2250, "XOF")).toBe("F CFA 2,250")
  })

  it("keeps the decimals when asked", () => {
    expect(formatPrice(0, "USD", { keepDecimals: true })).toBe("$0.00")
    expect(formatPrice(0, "UGX", { keepDecimals: true })).toBe("UGX 0")
  })
})

describe("needsManualRenewal", () => {
  it("is true for an active subscription with no card to charge", () => {
    expect(needsManualRenewal({ status: "active", canUpdatePaymentMethod: false })).toBe(true)
    expect(needsManualRenewal({ status: "active" })).toBe(true)
  })

  it("is false for card subscriptions and anything not active", () => {
    expect(needsManualRenewal({ status: "active", canUpdatePaymentMethod: true })).toBe(false)
    expect(needsManualRenewal({ status: "canceled", canUpdatePaymentMethod: false })).toBe(false)
    expect(needsManualRenewal(null)).toBe(false)
  })
})

describe("normalizeSubscriptionDetails", () => {
  it("exposes the API's currentPeriodEnd as expiresAt", () => {
    const details = normalizeSubscriptionDetails({
      activeSubscription: { status: "active", currentPeriodEnd: "2026-12-13T00:00:00.000Z" },
      billingHistory: [{ id: "s1", currentPeriodEnd: "2026-11-13T00:00:00.000Z" }],
    })
    expect(details.activeSubscription?.expiresAt).toBe("2026-12-13T00:00:00.000Z")
    expect(details.billingHistory?.[0]?.expiresAt).toBe("2026-11-13T00:00:00.000Z")
  })

  it("leaves a missing subscription alone", () => {
    expect(normalizeSubscriptionDetails(null)).toBeNull()
    expect(normalizeSubscriptionDetails({ activeSubscription: null }).activeSubscription).toBeNull()
  })
})

describe("readTestCountry", () => {
  it("accepts a two-letter country only", () => {
    expect(readTestCountry(" ke ")).toBe("KE")
    expect(readTestCountry("Kenya")).toBeNull()
    expect(readTestCountry(null)).toBeNull()
  })
})

describe("bachsCheckoutOrigin", () => {
  it("accepts the live and sandbox Bachs checkouts", () => {
    expect(bachsCheckoutOrigin("https://checkout.bachs.io/c/AbC123")).toBe("https://checkout.bachs.io")
    expect(bachsCheckoutOrigin("https://sandbox-checkout.bachs.io/c/AbC123")).toBe(
      "https://sandbox-checkout.bachs.io"
    )
  })

  it("rejects any other host", () => {
    expect(bachsCheckoutOrigin("https://checkout.bachs.io.evil.net/c/AbC123")).toBeNull()
    expect(bachsCheckoutOrigin("http://checkout.bachs.io/c/AbC123")).toBeNull()
    expect(bachsCheckoutOrigin("not a url")).toBeNull()
  })
})

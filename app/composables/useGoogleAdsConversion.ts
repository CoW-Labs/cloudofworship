// Fires the Google Ads "Sign-up" conversion, set up for the switcher campaign
// targeting ProPresenter/EasyWorship/Proclaim users. Only acts in production,
// matching the google-ads-tag plugin's load condition.
export const useGoogleAdsConversion = () => {
  const trackSignupConversion = () => {
    if (typeof window === "undefined") return
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    if (isLocal) return

    window.gtag?.("event", "conversion", {
      send_to: "AW-18593474794/k38DCIPYsr8dEOrRh6JF",
    })
  }

  return { trackSignupConversion }
}

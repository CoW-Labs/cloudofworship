// Loads the Google tag so Google Ads can measure conversions (e.g. signups)
// from campaigns run on app.cloudofworship.com. Not loaded on localhost so
// dev traffic never pollutes conversion data.
const GOOGLE_ADS_TAG_ID = "AW-18593474794"

export default defineNuxtPlugin(() => {
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  if (isLocal) return

  const script = document.createElement("script")
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_TAG_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments)
  }
  window.gtag("js", new Date())
  window.gtag("config", GOOGLE_ADS_TAG_ID)
})

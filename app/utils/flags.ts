// Country flag images keyed by lowercase ISO 3166-1 alpha-2 code (e.g. "gh").
// Bundled with the app so they work offline and on Windows, which has no emoji flags.
const flagFiles = import.meta.glob("~/assets/flags/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>

export const countryFlags: Record<string, string> = Object.fromEntries(
  Object.entries(flagFiles).map(([path, url]) => [
    path.split("/").pop()!.replace(".svg", ""),
    url,
  ])
)

// Country for every Bible version id. The API sends the same data as `country` /
// `countryName`; this covers a version list cached before the API sent it, or an API not yet updated.
export const bibleVersionCountries: Record<string, { country: string; countryName: string; language: string }> = {
  KJV: { country: "gb", countryName: "United Kingdom", language: "English" },
  YLT: { country: "gb", countryName: "United Kingdom", language: "English" },
  ASV: { country: "us", countryName: "United States", language: "English" },
  WEB: { country: "us", countryName: "United States", language: "English" },
  NKJV: { country: "us", countryName: "United States", language: "English" },
  NIV: { country: "us", countryName: "United States", language: "English" },
  AMP: { country: "us", countryName: "United States", language: "English" },
  AMPC: { country: "us", countryName: "United States", language: "English" },
  NLT: { country: "us", countryName: "United States", language: "English" },
  CEV: { country: "us", countryName: "United States", language: "English" },
  MSG: { country: "us", countryName: "United States", language: "English" },
  NASB: { country: "us", countryName: "United States", language: "English" },
  GNT: { country: "us", countryName: "United States", language: "English" },
  HCSB: { country: "us", countryName: "United States", language: "English" },
  TPT: { country: "us", countryName: "United States", language: "English" },
  ESV: { country: "us", countryName: "United States", language: "English" },
  YBCV: { country: "ng", countryName: "Nigeria", language: "Yoruba" },
  SRK: { country: "ng", countryName: "Nigeria", language: "Hausa" },
  BIU: { country: "ng", countryName: "Nigeria", language: "Igbo" },
  PCM: { country: "ng", countryName: "Nigeria", language: "Nigerian Pidgin" },
  AKNA: { country: "gh", countryName: "Ghana", language: "Twi (Akuapem)" },
  ASNA: { country: "gh", countryName: "Ghana", language: "Twi (Asante)" },
  ASWDC: { country: "gh", countryName: "Ghana", language: "Twi (Asante)" },
  EB14: { country: "gh", countryName: "Ghana", language: "Ewe" },
  AL: { country: "gh", countryName: "Ghana", language: "Ewe" },
  RVR09: { country: "es", countryName: "Spain", language: "Spanish" },
  NTV: { country: "es", countryName: "Spain", language: "Spanish" },
  RVA2015: { country: "es", countryName: "Spain", language: "Spanish" },
  TB: { country: "id", countryName: "Indonesia", language: "Indonesian" },
  AMHARIC: { country: "et", countryName: "Ethiopia", language: "Amharic" },
  SVD: { country: "sa", countryName: "Saudi Arabia", language: "Arabic" },
  CUNPSS: { country: "cn", countryName: "China", language: "Chinese (Simplified)" },
  CUVT: { country: "tw", countryName: "Taiwan", language: "Chinese (Traditional)" },
  LSG: { country: "fr", countryName: "France", language: "French" },
  DELUT: { country: "de", countryName: "Germany", language: "German" },
  CO1955: { country: "jp", countryName: "Japan", language: "Japanese" },
  KRV: { country: "kr", countryName: "South Korea", language: "Korean" },
  ARA: { country: "br", countryName: "Brazil", language: "Portuguese" },
  RUSSYNODAL: { country: "ru", countryName: "Russia", language: "Russian" },
  SRUV: { country: "ke", countryName: "Kenya", language: "Swahili" },
}

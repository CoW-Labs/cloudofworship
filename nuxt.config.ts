// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },

  app: {
    head: {
      charset: "utf-8",
      htmlAttrs: {
        lang: "en",
      },
      viewport: "initial-scale=1",
      title: "Cloud of Worship - Your church's powerpoint",
      meta: [
        {
          name: "description",
          content:
            "Simple and easy to use church presentation software that grows with your church needs. Cloud of Worship is your church's power point.",
        },
        { name: "format-detection", content: "telephone=no" },
        { hid: "og:type", property: "og:type", content: "website" },
        {
          hid: "og-url",
          name: "og:url",
          content: "https://cloudofworship.com",
        },
        {
          hid: "og:image",
          property: "og:image",
          content: "https://revaise.s3.us-east-2.amazonaws.com/clouw-og.webp",
        },
        {
          hid: "twitter:image",
          name: "twitter:image",
          content: "https://revaise.s3.us-east-2.amazonaws.com/clouw-og.webp",
        },
        {
          hid: "twitter:domain",
          name: "twitter:domain",
          content: "cloudofworship.com",
        },
        {
          hid: "twitter:description",
          name: "twitter:description",
          content:
            "Simple and easy to use church presentation software that grows with your church needs. Cloud of Worship is your church's power point.",
        },
        {
          hid: "twitter:url",
          name: "twitter:url",
          content: "https://cloudofworship.com",
        },
      ],
      link: [
        {
          rel: "preconnect",
          crossorigin: "anonymous",
          href: "https://fonts.googleapis.com",
        },
        {
          rel: "preconnect",
          crossorigin: "anonymous",
          href: "https://fonts.gstatic.com",
        },
        {
          rel: "stylesheet",
          crossorigin: "anonymous",
          href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Dancing+Script:wght@400..700&family=EB+Garamond:ital,wght@0,400..800;1,400..800&family=Great+Vibes&family=IBM+Plex+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=IBM+Plex+Serif:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=Inter:wght@100..900&family=Jersey+25&family=Jost:ital,wght@0,100..900;1,100..900&family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Overpass:wght@100..900&family=Playball&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Raleway:ital,wght@0,100..900;1,100..900&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&family=Saira+Extra+Condensed:wght@100;200;300;400;500;600;700;800;900&family=Sedan:ital@0;1&family=Slabo+27px&display=swap",
        },
      ],
    },
    pageTransition: { name: "page", mode: "out-in" },
    layoutTransition: { name: "layout", mode: "out-in" },
  },

  ssr: false,

  nitro: {
    prerender: {
      routes: ["/"],
    },
  },

  runtimeConfig: {
    public: {
      BASE_URL: process.env.BASE_URL || "http://localhost:4500/api/v1",
      // BASE_URL:
      //   process.env.BASE_URL ||
      //   "https://worshipcloud-api-6xak8.ondigitalocean.app/api/v1",
      ASSETS_BASE_URL:
        process.env.ASSETS_BASE_URL || "https://worshipcloud.favourfelix.com",
      AWS_BUCKET_NAME: process.env.CLOUD_AWS_BUCKET_NAME,
      AWS_BUCKET_REGION: process.env.CLOUD_AWS_BUCKET_REGION,
      NODE_ENV: process.env.NODE_ENV || 'production'
    },
  },

  css: ["~/assets/css/main.css"],

  modules: [
    "@nuxt/ui",
    "@vite-pwa/nuxt",
    "nuxt-tiptap-editor",
    "@pinia/nuxt",
    "pinia-plugin-persistedstate/nuxt",
    "nuxt-gtag",
    "@nuxthub/core"
  ],

  ui: {
    global: true,
    icons: ["mdi", "bx", "bxs", "bi", "mingcute", "tabler", "ph"],
  },

  colorMode: {
    preference: "system",
    fallback: "light",
  },

  vue: {
    compilerOptions: {
      isCustomElement: (tag: string) => false,
    },
  },

  tiptap: {
    prefix: "Tiptap",
  },

  pinia: {
    storesDirs: ["./stores/**"],
  },

  gtag: {
    id: 'G-Z23FTMP6WE'
  },

  pwa: {
    registerType: "prompt",
    injectRegister: false,

    pwaAssets: {
      disabled: false,
      config: true,
    },

    manifest: {
      name: "Cloud of Worship",
      short_name: "CoW",
      description: "Cloud of Worship",
      theme_color: "#a855f7",
      start_url: "/",
      display: "fullscreen",
      icons: [
        {
          src: "/cloud-w-144.png",
          sizes: "144x144",
          type: "image/png",
        },
        {
          src: "/cloud-w-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/cloud-w-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },

    workbox: {
      globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
    },

    devOptions: {
      enabled: false,
      suppressWarnings: true,
      navigateFallback: "/",
      navigateFallbackAllowlist: [/^\/$/],
      type: "module",
    },

    registerWebManifestInRouteRules: true,

    client: {
      installPrompt: true,
    },
  },
});
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
          rel: "preload",
          href: "/css/fonts.css",
          as: "style",
          onload: "this.onload=null;this.rel='stylesheet'"
        },
        {
          rel: "prefetch",
          href: "/css/main.css",
          as: "style",
          onload: "this.onload=null;this.rel='stylesheet'"
        }
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
      NODE_ENV: process.env.NODE_ENV || "production",
    },
  },

  spaLoadingTemplate: "public/loading.html",

  modules: [
    "@nuxt/ui",
    "@vite-pwa/nuxt",
    "nuxt-tiptap-editor",
    "@pinia/nuxt",
    "pinia-plugin-persistedstate/nuxt",
    "nuxt-gtag",
    "@nuxthub/core",
  ],

  components: [
    {
      path: "~/components",
      pathPrefix: false,
    },
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
    id: "G-Z23FTMP6WE",
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
})

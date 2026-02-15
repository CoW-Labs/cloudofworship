// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },

  imports: {
    autoImport: true,
  },

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
          content: "https://cloudofworship.com/images/cow-og-image.jpeg",
        },
        {
          hid: "twitter:image",
          name: "twitter:image",
          content: "https://cloudofworship.com/images/cow-og-image.jpeg",
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

  vite: {
    // Tauri expects a fixed port for the dev server
    server: {
      strictPort: true,
      port: 3000,
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 3000,
      },
    },
    // Prevent vite from obscuring rust errors
    clearScreen: false,
    // Enable environment variables
    envPrefix: ['VITE_', 'TAURI_'],
  },

  runtimeConfig: {
    public: {
      BASE_URL: process.env.BASE_URL || "https://api.cloudofworship.com/api/v1",
      NODE_ENV: process.env.NODE_ENV || "production",
      GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
      GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
      PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY,
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
    // "@nuxthub/core",
  ],

  components: [
    {
      path: "~/components",
      pathPrefix: false,
    },
  ],

  ui: {
    global: true,
    icons: ["mdi", "bx", "bxs", "bi", "mingcute", "tabler", "ph", "lucide"],
  },

  icon: {
    clientBundle: {
      scan: true,
      // All icons used throughout the application
      icons: [
        // Boxicons (bx)
        'bx:bible',
        'bx:bell',
        'bx:bold',
        'bx:book-open',
        'bx:bookmarks',
        'bx:calendar-plus',
        'bx:check',
        'bx:check-circle',
        'bx:chevron-left',
        'bx:chevron-right',
        'bx:chevron-down',
        'bx:chevron-up',
        'bx:church',
        'bx:circle',
        'bx:clipboard',
        'bx:code',
        'bx:code-curly',
        'bx:cog',
        'bx:copy',
        'bx:dots-vertical-rounded',
        'bx:edit',
        'bx:error',
        'bx:error-circle',
        'bx:expand-alt',
        'bx:film',
        'bx:folder-open',
        'bx:font-family',
        'bx:grid-alt',
        'bx:heart',
        'bx:history',
        'bx:image',
        'bx:image-add',
        'bx:info-circle',
        'bx:italic',
        'bx:library',
        'bx:link',
        'bx:list-ol',
        'bx:list-ul',
        'bx:loader-alt',
        'bx:microphone',
        'bx:moon',
        'bx:movie',
        'bx:music',
        'bx:palette',
        'bx:paragraph',
        'bx:play',
        'bx:play-circle',
        'bx:plus',
        'bx:save',
        'bx:search',
        'bx:send',
        'bx:shield',
        'bx:slider',
        'bx:slideshow',
        'bx:stop',
        'bx:strikethrough',
        'bx:text',
        'bx:time',
        'bx:trash',
        'bx:user-plus',
        'bx:x',
        // Boxicons Solid (bxs)
        'bxs:heart',
        'bxs:keyboard',
        'bxs:quote-right',
        // Lucide
        'lucide:chevron-down',
        'lucide:music-2',
        // Material Design Icons (mdi)
        'mdi:account',
        'mdi:alert-circle-outline',
        'mdi:arrow-expand-vertical',
        'mdi:chevron-left',
        'mdi:close',
        'mdi:format-annotation-minus',
        'mdi:format-annotation-plus',
        'mdi:format-letter-case-upper',
        'mdi:square-rounded',
        // Bootstrap Icons (bi)
        'bi:gear',
        'bi:text-center',
        'bi:text-left',
        'bi:text-right',
        // Tabler Icons
        'tabler:cloud-off',
        'tabler:cloud-search',
        'tabler:device-desktop-plus',
        'tabler:download',
        'tabler:eye',
        'tabler:eye-off',
        'tabler:layout-grid',
        'tabler:line-height',
        'tabler:list-numbers',
        'tabler:pause',
        'tabler:play',
        'tabler:player-skip-forward',
        'tabler:refresh',
        'tabler:repeat',
        'tabler:search',
        'tabler:skip-back',
        'tabler:trash',
        'tabler:volume',
        'tabler:volume-off',
        'mdi:youtube',
        'mdi:vimeo',
        // Phosphor
        'ph:file-ppt',
        // Mingcute
        'mingcute:layout-3-line',
        // Material Symbols
        'material-symbols:speech-to-text',
      ]
    },
    serverBundle: false
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
    registerType: "autoUpdate",
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

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr: false,

  nitro: {
    prerender: {
      routes: ['/'],
    },
  },

  runtimeConfig: {
    public: {
      BASE_URL: process.env.BASE_URL || 'https://worshipcloud-api-6xak8.ondigitalocean.app/api/v1',
      ASSETS_BASE_URL: process.env.ASSETS_BASE_URL || 'https://worshipcloud.favourfelix.com',
      AWS_BUCKET_NAME: process.env.CLOUD_AWS_BUCKET_NAME,
      AWS_BUCKET_REGION: process.env.CLOUD_AWS_BUCKET_REGION,
      AWS_ACCESS_KEY_ID: process.env.CLOUD_AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.CLOUD_AWS_SECRET_ACCESS_KEY
    }
  },

  css: [
    '~/assets/css/main.css',
  ],

  modules: [
    '@nuxt/ui',
    '@vite-pwa/nuxt',
    'nuxt-tiptap-editor',
    '@pinia/nuxt',
    '@pinia-plugin-persistedstate/nuxt',
  ],

  ui: {
    global: true,
    icons: ['mdi', 'bx', 'bxs', 'bi', 'mingcute', 'tabler', 'ph'],
  },

  colorMode: {
    preference: 'light',
  },

  vue: {
    compilerOptions: {
      isCustomElement: (tag: string) => false
    }
  },

  tiptap: {
    prefix: "Tiptap",
  },

  pinia: {
    storesDirs: ['./stores/**']
  },

  pwa: {
    registerType: 'prompt',
    injectRegister: false,

    pwaAssets: {
      disabled: false,
      config: true,
    },

    manifest: {
      "name": "Cloud of Worshippers",
      "short_name": "CoW",
      "description": "Cloud of Worshippers",
      "theme_color": "#a855f7",
      "start_url": "/",
      "display": "fullscreen",
      "icons": [
        {
          "src": "/cloud-w-144.png",
          "sizes": "144x144",
          "type": "image/png"
        },
        {
          "src": "/cloud-w-192.png",
          "sizes": "192x192",
          "type": "image/png"
        },
        {
          "src": "/cloud-w-512.png",
          "sizes": "512x512",
          "type": "image/png"
        }
      ]
    },

    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
    },

    devOptions: {
      enabled: true,
      suppressWarnings: true,
      navigateFallback: '/',
      navigateFallbackAllowlist: [/^\/$/],
      type: 'module',
    },

    registerWebManifestInRouteRules: true,

    client: {
      installPrompt: true,
    },
  },
})
export default defineNuxtConfig({
  experimental: {
    renderJsonPayloads: false
  },
  app: {
    head: {
      link: [
        {
          rel: 'manifest',
          href: '/manifest.json'
        },
        {
          rel: 'preconnect',
          crossorigin: 'anonymous',
          href: 'https://fonts.googleapis.com'
        },
        {
          rel: 'preconnect',
          crossorigin: 'anonymous',
          href: 'https://fonts.gstatic.com'
        },
        {
          rel: 'stylesheet',
          crossorigin: 'anonymous',
          href: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Dancing+Script:wght@400..700&family=EB+Garamond:ital,wght@0,400..800;1,400..800&family=Great+Vibes&family=IBM+Plex+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=IBM+Plex+Serif:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=Inter:wght@100..900&family=Jersey+25&family=Jost:ital,wght@0,100..900;1,100..900&family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Overpass:wght@100..900&family=Playball&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Raleway:ital,wght@0,100..900;1,100..900&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&family=Saira+Extra+Condensed:wght@100;200;300;400;500;600;700;800;900&family=Sedan:ital@0;1&family=Slabo+27px&display=swap'
        }
      ]
    },
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' }
  },
  ssr: false,
  colorMode: {
    preference: 'light',
  },
  runtimeConfig: {
    public: {
      BASE_URL: process.env.BASE_URL || 'https://worshipcloud-api-6xak8.ondigitalocean.app/api/v1',
      ASSETS_BASE_URL: process.env.ASSETS_BASE_URL || 'https://worshipcloud.favourfelix.com',
      AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
      AWS_BUCKET_REGION: process.env.AWS_BUCKET_REGION,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY
    }
  },
  modules: [
    '@nuxt/ui',
    'nuxt-tiptap-editor',
    '@pinia/nuxt',
    '@pinia-plugin-persistedstate/nuxt',
  ],
  css: [
    '~/assets/css/main.css',
  ],
  ui: {
    global: true,
    icons: ['mdi', 'bx', 'bxs', 'bi', 'mingcute', 'tabler', 'ph'],
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
  }
})

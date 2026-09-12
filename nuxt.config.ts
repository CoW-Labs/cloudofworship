import { execSync } from 'child_process'

// The API is on a separate origin, so the browser cannot start its DNS/TCP/TLS
// handshake until the entry bundle has executed and fired the first request —
// roughly a second into the load. Preconnecting moves that handshake to HTML
// parse time. Derived from BASE_URL so non-production builds warm their own API
// rather than opening an unused socket to production.
const API_ORIGIN = new URL(
  process.env.BASE_URL || "https://api.cloudofworship.com/api/v1"
).origin

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",

  sourcemap: {
    client: true,
  },

  hooks: {
    // Stamp every client chunk with a chunkId and ship the matching .map to
    // PostHog, so Error Tracking shows real source lines instead of minified
    // bundle offsets. Runs straight after Nitro copies the public assets, which
    // is the only moment the .js and its .js.map sit side by side in the output.
    //
    // The directory MUST come from Nitro rather than being hardcoded: the local
    // build writes to `.output/public`, but the Vercel preset writes to
    // `.vercel/output/static`, so a hardcoded `.output` silently injects nothing
    // on the deploys that actually serve users.
    'nitro:build:public-assets': (nitro: { options: { output: { publicDir: string } } }) => {
      const publicDir = nitro.options.output.publicDir

      // The CLI reads these from the process env. Without them it exits 1, and
      // a build that "succeeded" would quietly ship unsymbolicated stack traces
      // — the exact failure this check exists to make audible.
      if (!process.env.POSTHOG_CLI_API_KEY || !process.env.POSTHOG_CLI_PROJECT_ID) {
        console.warn(
          '[posthog] Skipping sourcemap upload: POSTHOG_CLI_API_KEY / POSTHOG_CLI_PROJECT_ID are not set. ' +
            'Stack traces from this build will NOT be symbolicated in PostHog Error Tracking.'
        )
        return
      }

      // Ties each symbol set to a release. Auto-derivation from git is unreliable
      // on CI checkouts, so prefer the SHA the platform hands us.
      const releaseVersion =
        process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || ''
      const release = releaseVersion
        ? ` --release-name cloud-of-worship --release-version ${releaseVersion}`
        : ''

      console.log(`[posthog] Injecting and uploading sourcemaps from ${publicDir}`)
      try {
        execSync(`posthog-cli sourcemap inject --directory "${publicDir}"`, {
          stdio: 'inherit',
        })
        execSync(
          `posthog-cli sourcemap upload --directory "${publicDir}" --delete-after --skip-on-conflict${release}`,
          { stdio: 'inherit' }
        )
        console.log('[posthog] Sourcemap upload completed successfully')
      } catch (error) {
        // Deliberately non-fatal — a PostHog outage should not block a deploy —
        // but loud enough to grep for in build logs.
        console.error(
          '\n[posthog] !!! SOURCEMAP UPLOAD FAILED !!! Stack traces from this build ' +
            'will NOT be symbolicated in PostHog Error Tracking.\n',
          error
        )
      }
    },
  },
  devtools: { enabled: false },

  experimental: {
    // Nuxt's own chunk-error handling ('automatic', the default) only reloads
    // from router.onError, so it fires when a dead chunk aborts a *navigation*.
    // The operator console sits on one route for hours, so its chunk failures
    // are lazy imports inside the page and never reach the router. 'manual'
    // keeps the app:chunkError hook but installs no built-in reload plugin;
    // app/plugins/chunk-error.client.ts owns the policy for both cases.
    emitRouteChunkError: 'manual',

    // Nuxt fetches /_nuxt/builds/meta/<buildId>.json on every route navigation
    // to check for a newer deployment. The service worker is network-first and
    // this URL is never in its cache (it is only ever requested at navigation
    // time), so every offline navigation threw an uncaught "Failed to fetch".
    // We ship no route rules and run our own version check in public/sw.js, so
    // the manifest buys us nothing but broken offline navigation.
    appManifest: false,
  },

  // Explicitly enable the pages system so Nuxt's dev-mode detection doesn't
  // raise a false-positive "NuxtPage not used" warning when <NuxtPage /> is
  // slotted inside <NuxtLayout> (a known static-analysis limitation in Nuxt 4).
  pages: true,

  imports: {
    autoImport: true,
  },

  app: {
    head: {
      charset: "utf-8",
      htmlAttrs: {
        lang: "en",
      },
      // `viewport-fit=cover` is what makes `env(safe-area-inset-*)` resolve to
      // anything other than 0. Every surface that sits against a screen edge
      // (the navbar, the mobile action bar) pads itself with those insets, so
      // this has to be on the document, not just the /mobile route.
      viewport: "initial-scale=1, viewport-fit=cover",
      title: "Cloud of Worship - Your church's powerpoint",
      meta: [
        {
          name: "description",
          content:
            "Simple and easy to use church presentation software that grows with your church needs. Cloud of Worship is your church's power point.",
        },
        { name: "format-detection", content: "telephone=no" },
        // Installed-PWA chrome on iOS. `default` keeps the status bar opaque
        // and sized, which is what stops the navbar rendering underneath the
        // notch / Dynamic Island; `black-translucent` would put it back there.
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "apple-mobile-web-app-title", content: "Cloud of Worship" },
        // The status-bar strip the OS paints above the app. The manifest can
        // only carry one colour, so it is declared per colour scheme here —
        // otherwise a dark-mode install gets a white band over a dark navbar.
        {
          name: "theme-color",
          media: "(prefers-color-scheme: light)",
          content: "#f3f4f6",
        },
        {
          name: "theme-color",
          media: "(prefers-color-scheme: dark)",
          content: "#111722",
        },
        // Social card. This app is `ssr: false` and only `/` is prerendered, so
        // every route serves the same shell and therefore the same tags — there
        // is no per-route card here. The image is a static file in this repo so
        // previews do not depend on the marketing site's deploy; it is rendered
        // from the shared template in cow-labs-website (app/utils/ogCards.ts,
        // key `app`) and copied here, so regenerate it there.
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Cloud of Worship" },
        {
          property: "og:url",
          content: "https://app.cloudofworship.com",
        },
        {
          property: "og:title",
          content: "Cloud of Worship - Your church's powerpoint",
        },
        {
          property: "og:description",
          content:
            "Simple and easy to use church presentation software that grows with your church needs. Cloud of Worship is your church's power point.",
        },
        {
          property: "og:image",
          content: "https://app.cloudofworship.com/images/og/app.jpg",
        },
        { property: "og:image:type", content: "image/jpeg" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        {
          property: "og:image:alt",
          content:
            "Cloud of Worship - prepare once, use everywhere. Scriptures. Songs. Slides. Sermons - everything.",
        },
        // Without this, X renders the 1200x630 image as a small square crop
        // instead of a full-width card.
        { name: "twitter:card", content: "summary_large_image" },
        {
          name: "twitter:image",
          content: "https://app.cloudofworship.com/images/og/app.jpg",
        },
        {
          name: "twitter:title",
          content: "Cloud of Worship - Your church's powerpoint",
        },
        {
          name: "twitter:domain",
          content: "app.cloudofworship.com",
        },
        {
          name: "twitter:description",
          content:
            "Simple and easy to use church presentation software that grows with your church needs. Cloud of Worship is your church's power point.",
        },
        {
          name: "twitter:url",
          content: "https://app.cloudofworship.com",
        },
      ],
      link: [
        {
          // Requests carry a Bearer header, not cookies, so they travel on the
          // anonymous connection pool — this must match or the socket is unused.
          rel: "preconnect",
          href: API_ORIGIN,
          crossorigin: "anonymous",
        },
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
    publicAssets: [
      {
        dir: 'public',
        maxAge: 0 // Prevents caching issues during updates
      }
    ],
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
    build: {},
  },

  runtimeConfig: {
    public: {
      BASE_URL: process.env.BASE_URL || "https://api.cloudofworship.com/api/v1",
      NODE_ENV: process.env.NODE_ENV || "production",
      DEV_TOKEN: process.env.DEV_ACCESS_TOKEN || "",
      GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
      GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
      PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY,
    },
  },

  spaLoadingTemplate: "spa-loading-template.html",

  modules: [
    "@nuxt/ui",
    "nuxt-tiptap-editor",
    "@pinia/nuxt",
    "pinia-plugin-persistedstate/nuxt",
    "nuxt-gtag",
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
        'tabler:highlight',
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
        // 'material-symbols:speech-to-text',
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
    storesDirs: ["./app/stores/**"],
  },

  gtag: {
    id: "G-Z23FTMP6WE",
  },

  // PWA and Workbox config removed for custom service worker
})

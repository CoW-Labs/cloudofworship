# Cloud of Worship

![Cloud of Worship: open to every church](https://cloudofworship.com/images/og/open-source.jpg)

Cloud of Worship is simple presentation software for churches. Show song lyrics, scripture, hymns, media and custom slides on your projector, from your browser or the desktop app.

Use it at [app.cloudofworship.com](https://app.cloudofworship.com).

## Features

**Free**

- **Bible**: display any verse or search the whole Bible, in several translations.
- **Hymns**: a built-in hymnal.
- **Songs**: add your own songs, keep them in your library and build setlists.
- **Text and media slides**: images, videos, PDFs and your own text.
- **Schedules**: plan each service ahead and reuse recent ones.
- **Live output**: a second window for your projector, with blank screen, overlays and slide styles.
- **Works offline**: Bibles, hymns, songs and media are cached on your device.

**Teams**

- **Song search**: search a shared catalogue of worship songs by title or lyrics. Free churches get 50 songs a month.
- **Sermon transcription**: live captions of the sermon. Free churches get 10 minutes to try it.
- **Team collaboration**: invite your team and edit the same schedule in real time.
- **Stage display**: a confidence monitor with the next slide, clock and countdown, also viewable over the network.
- **Livestream link**: share your slides as a link for online viewers.
- **More slide types**: alerts and banners, countdowns, clock, interludes, slide pairs, YouTube and Vimeo.

See [cloudofworship.com/pricing](https://www.cloudofworship.com/pricing) for plans.

## Desktop app

The desktop app is built with [Tauri 2](https://tauri.app). It adds things the browser can't do, like sending your live output over NDI.

## Development

You need Node.js 22 or later.

```bash
npm install
```

```bash
npm run dev
```

The app runs at http://localhost:3000 and talks to the production API by default. Set `BASE_URL` in `.env` to point at another API.

Other commands:

| Command | What it does |
|---------|--------------|
| `npm test` | Run the test suite (Vitest) |
| `npm run build` | Build the static site (`nuxt generate`) |
| `npm run tauri:dev` | Run the desktop app in development |
| `npm run tauri:build` | Build the desktop app |

### Tech stack

Nuxt 4 (SPA), Vue 3, TypeScript, Pinia, Nuxt UI, TailwindCSS, Dexie (IndexedDB), Socket.IO and Tauri 2.

### Project structure

```bash
├── app
│   ├── components    # Vue components
│   ├── composables   # Shared logic (API, slides, songs, Bible, sockets, Tauri)
│   ├── layouts       # default, auth, app (operator) and live (projector)
│   ├── middleware    # Route guards, including auth
│   ├── pages         # Routes: operator, /live, /stage, /mobile, /livestream
│   ├── plugins       # PostHog, Tauri, shared state and more
│   ├── store         # Pinia stores (app, auth, template)
│   ├── types         # TypeScript types
│   └── utils         # Constants and helpers
├── public            # Static assets, service worker, hymns
├── src-tauri         # Desktop app (Rust)
├── docs              # Developer notes
└── tests             # Vitest tests
```

See [CLAUDE.md](./CLAUDE.md) for a deeper look at the architecture.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) to get set up. Open pull requests against the `staging` branch.

## Report an issue or give feedback

Report bugs and request features on [GitHub Issues](https://github.com/cow-labs/cloudofworship/issues). Tell us how Cloud of Worship has helped your church [here](https://senja.io/p/cloudofworship/r/9XMjTH), or email [hello@cloudofworship.com](mailto:hello@cloudofworship.com).

## Community

Join us on [WhatsApp](https://chat.whatsapp.com/DeQX11igCSU6YaOoTqY7GY) and [Instagram](https://instagram.com/cloudofworshipapp).

## License

Cloud of Worship is open source under the [GNU Affero General Public License v3.0](./LICENSE) (AGPL-3.0-only). Copyright (C) 2024-2026 Favour Felix. See [NOTICE](./NOTICE).

- **You can** read, change and run the code, including for your own church or ministry, for free.
- **If you share a changed version, or run it for people to use over a network**, you must release your full source code under the same license.

The name and logo are not part of the license. See [TRADEMARKS.md](./TRADEMARKS.md).

Want to use it under different terms? Email [hello@cloudofworship.com](mailto:hello@cloudofworship.com).

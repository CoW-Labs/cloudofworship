# Cloud of Worship

![Cloud of Worship](https://revaise.s3.us-east-2.amazonaws.com/cow-og.webp)

Cloud of Worship is a free, minimalist, browser-based presentation software tailored for churches. It allows you to display song lyrics, scriptures, videos, and customizable slides with ease. This software is designed to be offline-ready, browser-ready, and supports team collaboration.

## Features

- **Offline Ready**: Access and display your slides even without an internet connection.
- **Browser-Based**: No installation required. Simply open your browser and start presenting.
- **Customizable Layout**: Easily modify and structure the app interface.
- **Bible Search and Version Support**: Integrated Bible with support for various public domain translations, and other versions.
- **Global Song Sharing**: Access a growing library of over 7,000 worship songs shared by churches worldwide (Cloud functionality).
- **Team Workflow (Multiplayer Mode)**: Collaborate with your church team in real-time (Cloud functionality).
- **Stream Live Content via WebSocket (WS)**: Seamless live streaming of content (Cloud functionality).

## Support Us

Cloud of Worship is free to install locally and also accessible via the cloud. If you'd like to support us so we can keep doing this, please consider donating through our [website](https://www.cloudofworship.com/pricing) or [sending an email](mailto:hello@cloudofworship.com).

## Report an Issue, Request a Feature or Give Feedback

If you encounter any issues or have suggestions for improvements, please feel free to report them on our [GitHub Issues Page](https://github.com/felixfavour/minimalist-church-presentation-software/issues). We would also love to know how this software has been useful, feel free to send feedback [here](https://senja.io/p/cloudofworship/r/9XMjTH).

## Join our Growing Community

We have a growing community of users and contributors on [Whatsapp](https://chat.whatsapp.com/DeQX11igCSU6YaOoTqY7GY) and [Instagram](https://instagram.com/cloudofworshipapp).

## Tech Stack

Vue (Nuxt 3), Tauri (Desktop App), TypeScript, Pinia, TailwindCSS

## Desktop App

Cloud of Worship is now available as a desktop application! See [TAURI_README.md](./TAURI_README.md) for details on running and building the desktop version.

**Quick Start:**

```bash
# Development mode
npm run tauri:dev

# Build desktop app
npm run tauri:build
```

## Contributing

Contributions are welcome! To get started on your local development environment, please follow the steps below:

1. Fork the repository and clone it to your local machine.
2. Install the required dependencies using `yarn install` or `npm install`.
3. Start the development server using `yarn dev` or `npm run dev`.
4. Make your changes and test them locally.
5. Commit your changes and push them to your forked repository.
6. Create a pull request to the main repository.

## License

Cloud of Worship is licensed under the [GNU](https://github.com/felixfavour/minimalist-church-presentation-software/blob/master/LICENSE).

## Project Structure

```bash
├── assets/css             # Stylesheets and related files
├── components             # Reusable Vue components
├── composables            # Functions and utilities for Vue composition API
├── layouts                # Application layout templates
├── middleware             # Custom middleware for routing and auth
├── pages                  # Page components
├── plugins                # Vue.js plugins, including Bible version and song features
├── public                 # Static assets and icons
├── server                 # Backend server setup (Node.js and Express)
├── store                  # Vuex store for state management
├── types                  # TypeScript types
├── utils                  # Utility functions for handling WebSocket streams
└── src-tauri              # Tauri integration (for lightweight desktop builds)

```

## License

Cloud of Worship is licensed under the [GNU General Public License v3.0](https://github.com/felixfavour/minimalist-church-presentation-software/blob/master/LICENSE).

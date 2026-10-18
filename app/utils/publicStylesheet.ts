/**
 * A stylesheet in public/css, versioned by this build.
 *
 * public/ files are served under fixed names, and Cloudflare gives them a
 * 4-hour browser cache. Without the build id in the URL, a browser that loaded
 * the app shortly before a deploy pairs the new (hashed) JS with the old CSS,
 * so any rule added in that deploy, like the purple song translation, is
 * missing until the cache runs out. sw.js still finds it offline: its cache
 * fallback ignores the query string.
 */
export const publicStylesheet = (path: string) => {
  const buildId = useRuntimeConfig().public.BUILD_ID
  return buildId ? `${path}?v=${buildId}` : path
}

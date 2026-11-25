// Writes the starter template backgrounds to public/templates/bg/*.svg.
//
// Each is a small, self-contained vector (a few KB): it scales to any
// projector, has nothing to decode, and uses no filters or web fonts, which
// are the costly parts on a weak GPU. Run with `npm run templates:bg` after
// changing one, and commit the files it writes.
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "templates", "bg")
mkdirSync(out, { recursive: true })

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice">${body}</svg>\n`
const dots = (pts, fill = "#fff") =>
  `<g fill="${fill}">${pts.map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" opacity="${o}"/>`).join("")}</g>`
const stars = (pts) => dots(pts.map(([x, y], i) => [x, y, 0.45, 0.3 + (i % 3) * 0.2]))

const files = {
  welcome: svg(`<defs><radialGradient id="a" cx=".18" cy="1.05" r=".95"><stop offset="0" stop-color="#a855f7" stop-opacity=".9"/><stop offset=".5" stop-color="#6b21a8" stop-opacity=".28"/><stop offset="1" stop-color="#0f0a1a" stop-opacity="0"/></radialGradient><radialGradient id="b"><stop offset="0" stop-color="#ff8980" stop-opacity=".42"/><stop offset="1" stop-color="#ff8980" stop-opacity="0"/></radialGradient></defs>
<rect width="160" height="90" fill="#0f0a1a"/><rect width="160" height="90" fill="url(#a)"/><circle cx="142" cy="8" r="40" fill="url(#b)"/>
${dots([[20, 20, 0.35, 0.3], [60, 12, 0.55, 0.4], [96, 30, 0.35, 0.5], [128, 52, 0.55, 0.3], [40, 44, 0.35, 0.4], [110, 14, 0.55, 0.5], [150, 70, 0.35, 0.3], [78, 60, 0.55, 0.4]])}
<rect x="36" y="74.5" width="114" height=".25" fill="#fff" opacity=".2"/>`),

  series: svg(`<rect width="160" height="90" fill="#a855f7"/><g fill="none" stroke="#0c0f19"><circle cx="128" cy="44" r="34" stroke-opacity=".22" stroke-width=".5" stroke-dasharray="1.2 2.2"/><circle cx="128" cy="44" r="48" stroke-opacity=".16" stroke-width=".5" stroke-dasharray="6 3"/><circle cx="128" cy="44" r="62" stroke-opacity=".1" stroke-width=".5"/></g>
<circle cx="128" cy="44" r="22" fill="#c084fc"/><circle cx="8" cy="96" r="40" fill="#8a41c9" opacity=".6"/>`),

  verse: svg(`<rect width="160" height="90" fill="#fbf7ff"/>
<g fill="#ede0fb"><circle cx="15" cy="30" r="7.5"/><circle cx="35" cy="30" r="7.5"/><path d="M8 30 Q8 46 20 50 L20 44 Q15 42 15 36Z"/><path d="M28 30 Q28 46 40 50 L40 44 Q35 42 35 36Z"/></g>
<circle cx="150" cy="86" r="32" fill="#f3e8ff"/><circle cx="150" cy="86" r="22" fill="none" stroke="#e1cdf7" stroke-width=".5"/><circle cx="146" cy="10" r="4" fill="#e9d5ff"/>`),

  point: svg(`<rect width="160" height="90" fill="#0c0f19"/><rect width="60" height="90" fill="#f5a524"/><clipPath id="c"><rect width="60" height="90"/></clipPath>
<g clip-path="url(#c)"><circle cx="14" cy="88" r="44" fill="#ffd27a" opacity=".5"/><circle cx="14" cy="88" r="30" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width=".5"/></g>`),

  sidepanel: svg(`<rect width="160" height="90" fill="#0c0f19"/><rect width="60" height="90" fill="#a855f7"/><clipPath id="c"><rect width="60" height="90"/></clipPath>
<g clip-path="url(#c)"><circle cx="14" cy="88" r="44" fill="#c084fc" opacity=".42"/><circle cx="14" cy="88" r="30" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".5"/></g>`),

  announce: svg(`<rect width="160" height="90" fill="#fdefd4"/><circle cx="134" cy="22" r="22" fill="none" stroke="#f3c47e" stroke-width=".6" stroke-dasharray="1.4 1.8"/><circle cx="134" cy="22" r="17" fill="#ffd9a0"/><circle cx="6" cy="92" r="26" fill="#fbe2b3"/>
<rect x="46" y="57" width="104" height=".35" fill="#0c0f19" opacity=".22"/><rect x="46" y="76" width="104" height=".35" fill="#0c0f19" opacity=".22"/>
<rect x="9.2" y="36.2" width="36" height="45" rx="2.4" fill="#0c0f19" opacity=".1"/><rect x="8" y="35" width="36" height="45" rx="2.4" fill="#fffaf0"/><path d="M8 47V37.4Q8 35 10.4 35H41.6Q44 35 44 37.4V47Z" fill="#9a3f06"/>
<rect x="15.2" y="32.4" width="1.6" height="5.6" rx=".8" fill="#fffaf0" stroke="#9a3f06" stroke-width=".4"/><rect x="35.2" y="32.4" width="1.6" height="5.6" rx=".8" fill="#fffaf0" stroke="#9a3f06" stroke-width=".4"/>`),

  prayer: svg(`<defs><radialGradient id="a" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#1b2447"/><stop offset=".7" stop-color="#0c0f19"/></radialGradient></defs>
<rect width="160" height="90" fill="url(#a)"/><g fill="none" stroke="#c084fc" stroke-width=".3"><circle cx="80" cy="45" r="20" stroke-opacity=".26"/><circle cx="80" cy="45" r="34" stroke-opacity=".16"/><circle cx="80" cy="45" r="50" stroke-opacity=".1"/><circle cx="80" cy="45" r="68" stroke-opacity=".06"/></g>
${stars([[22, 16], [140, 20], [132, 72], [64, 10], [104, 82], [150, 50]])}`),

  give: svg(`<rect width="160" height="90" fill="#e3f5e9"/><circle cx="12" cy="96" r="40" fill="#bfe6cb"/><circle cx="148" cy="10" r="24" fill="#cdeed8"/><circle cx="156" cy="84" r="16" fill="#cdeed8"/><path d="M0 90 Q30 60 64 70 L64 90Z" fill="#a9dcb9" opacity=".65"/>
${[35.5, 55.4, 75.2].map((y) => `<circle cx="85" cy="${y}" r="3.6" fill="#0c0f19"/>`).join("")}`),

  soon: svg(`<rect width="160" height="90" fill="#a855f7"/><circle cx="132" cy="18" r="46" fill="#c084fc" opacity=".6"/><g fill="none" stroke="#0c0f19" stroke-width=".5"><circle cx="132" cy="18" r="30" stroke-opacity=".25" stroke-dasharray="1.2 2"/><circle cx="132" cy="18" r="56" stroke-opacity=".14" stroke-dasharray="5 3"/></g><circle cx="18" cy="98" r="42" fill="#8a41c9" opacity=".6"/>`),

  lyric: svg(`<defs><radialGradient id="a" cx=".5" cy="1.15" r=".9"><stop offset="0" stop-color="#6b2fa8" stop-opacity=".85"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
<rect width="160" height="90" fill="#000"/><rect width="160" height="90" fill="url(#a)"/><ellipse cx="40" cy="92" rx="50" ry="12" fill="#a855f7" opacity=".18"/><ellipse cx="124" cy="94" rx="56" ry="14" fill="#60a5fa" opacity=".12"/>`),

  versions: svg(`<rect width="160" height="90" fill="#101224"/><circle cx="0" cy="0" r="44" fill="#3b0764" opacity=".6"/><rect x="79.7" y="14" width=".6" height="62" fill="#c084fc" opacity=".35"/>`),

  glowverse: svg(`<defs><radialGradient id="a" cx=".5" cy="1.1" r=".9"><stop offset="0" stop-color="#ff943a" stop-opacity=".55"/><stop offset=".45" stop-color="#963e18" stop-opacity=".22"/><stop offset="1" stop-color="#0b0705" stop-opacity="0"/></radialGradient><radialGradient id="b" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient></defs>
<rect width="160" height="90" fill="#0b0705"/><rect width="160" height="90" fill="url(#a)"/><rect width="160" height="90" fill="url(#b)"/>`),

  posterverse: svg(`<rect width="160" height="90" fill="#a855f7"/><circle cx="150" cy="8" r="52" fill="#c084fc" opacity=".55"/><circle cx="150" cy="8" r="34" fill="none" stroke="#0c0f19" stroke-opacity=".2" stroke-width=".5" stroke-dasharray="1.2 2"/><circle cx="6" cy="96" r="40" fill="#8a41c9" opacity=".6"/>`),

  paper: svg(`<rect width="160" height="90" fill="#e6cfa6"/><rect x="6.2" y="5.4" width="150" height="82" rx="1" fill="#0c0f19" opacity=".12"/><rect x="5" y="4" width="150" height="82" rx="1" fill="#fff7e4"/>
<path d="M143 4H155V16Z" fill="#ecd7aa"/><path d="M143 4V16H155Z" fill="#f6e6c0"/><path d="M143 4V16H155" fill="none" stroke="#d9bd86" stroke-width=".3"/>`),

  celebrate: (() => {
    const c = ["#ff8980", "#a855f7", "#ffc94d", "#60a5fa"]
    let s = '<rect width="160" height="90" fill="#ffe9e8"/>'
    for (let i = 0; i < 24; i++) {
      const x = ((i * 37) % 158) + 1, y = ((i * 29) % 88) + 1, col = c[i % 4]
      s += i % 2
        ? `<rect x="${x}" y="${y}" width="3.6" height="1.3" rx=".6" fill="${col}" transform="rotate(${(i * 47) % 180} ${x + 1.8} ${y + 0.6})"/>`
        : `<circle cx="${x}" cy="${y}" r="1.1" fill="${col}"/>`
    }
    return svg(s)
  })(),

  risen: svg(`<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14091f"/><stop offset=".6" stop-color="#4b1f7a"/><stop offset="1" stop-color="#c27cf4"/></linearGradient></defs>
<rect width="160" height="90" fill="url(#a)"/><circle cx="80" cy="72" r="58" fill="#ffe7a8" opacity=".07"/><circle cx="80" cy="72" r="40" fill="#ffe7a8" opacity=".16"/><circle cx="80" cy="72" r="25" fill="#ffe7a8" opacity=".95"/>
<path d="M0 74 Q40 62 80 72 T160 70 V90 H0Z" fill="#2a1143"/><path d="M0 80 Q50 70 100 80 T160 78 V90 H0Z" fill="#14091f"/>
${dots([[18, 14, 0.5, 0.7], [44, 8, 0.5, 0.7], [120, 12, 0.5, 0.7], [146, 24, 0.5, 0.7], [96, 6, 0.5, 0.7]])}`),
}

// The projector draws and moves the circles of these three itself, so it uses
// these copies of the same art without them. Cards and previews keep the full
// pictures above.
Object.assign(files, {
  "series-base": svg(`<rect width="160" height="90" fill="#a855f7"/>`),
  "soon-base": svg(`<rect width="160" height="90" fill="#a855f7"/>`),
  // Only the middle glow and the stars move; the rest stays put.
  "risen-base": svg(`<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14091f"/><stop offset=".6" stop-color="#4b1f7a"/><stop offset="1" stop-color="#c27cf4"/></linearGradient></defs>
<rect width="160" height="90" fill="url(#a)"/><circle cx="80" cy="72" r="58" fill="#ffe7a8" opacity=".07"/><circle cx="80" cy="72" r="25" fill="#ffe7a8" opacity=".95"/>`),
  "give-base": svg(`<rect width="160" height="90" fill="#e3f5e9"/><path d="M0 90 Q30 60 64 70 L64 90Z" fill="#a9dcb9" opacity=".65"/>
${[35.5, 55.4, 75.2].map((y) => `<circle cx="85" cy="${y}" r="3.6" fill="#0c0f19"/>`).join("")}`),
  "sidepanel-base": svg(`<rect width="160" height="90" fill="#0c0f19"/><rect width="60" height="90" fill="#a855f7"/><clipPath id="c"><rect width="60" height="90"/></clipPath>
<g clip-path="url(#c)"><circle cx="14" cy="88" r="44" fill="#c084fc" opacity=".42"/></g>`),
})

for (const [name, body] of Object.entries(files)) {
  writeFileSync(join(out, `${name}.svg`), body)
}
console.log(`Wrote ${Object.keys(files).length} template backgrounds to ${out}`)

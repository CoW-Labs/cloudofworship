// Builds design-system/tokens.css from design-system/tokens.json.
// Run with: npm run tokens:build
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'design-system')
const T = JSON.parse(readFileSync(join(dir, 'tokens.json'), 'utf8'))

const val = (v) => (typeof v === 'string' && v.startsWith('{') ? `var(--ds-${v.slice(1, -1)})` : v)
const colors = (theme) =>
  T.color.tokens
    .filter((t) => theme === 'light' || (typeof t.value !== 'string' && t.value.dark !== t.value.light))
    .map((t) => {
      const v = typeof t.value === 'string' ? t.value : (t.value[theme] ?? t.value.light)
      return `  --ds-${t.name}: ${val(v)};`
    })
    .join('\n')

const uppercase = new Set(['text-eyebrow', 'text-badge', 'text-meta', 'text-fineprint'])
const css = [
  '/* Cloud of Worship design system — tokens.',
  ' * Generated from design-system/tokens.json. Edit the JSON, then regenerate; do not hand-edit values here.',
  ' * Every token is a CSS variable named --ds-<token-name>. Dark values apply under .dark (Nuxt color mode) or [data-theme="dark"]. */',
  '',
  ':root {',
  colors('light'),
  ...T.shadow.tokens.map((t) => `  --ds-${t.name}: ${t.value};`),
  ...[...T.spacing.tokens, ...T.radius.tokens].map((t) => `  --ds-${t.name}: ${t.value};`),
  ...Object.entries(T.type.families).map(([k, v]) => `  --ds-font-${k}: ${v};`),
  '}',
  '',
  '.dark,',
  '[data-theme="dark"] {',
  colors('dark'),
  '}',
  '',
  '/* Type styles: one class per style in tokens.json */',
]
for (const g of T.type.groups) {
  for (const s of g.styles) {
    const decl = [
      `font-family: var(--ds-font-${s.family ?? g.family})`,
      `font-size: ${s.fontSize}`,
      `line-height: ${s.lineHeight}`,
      `font-weight: ${s.fontWeight}`,
    ]
    if (s.letterSpacing) decl.push(`letter-spacing: ${s.letterSpacing}`)
    if (uppercase.has(s.name)) decl.push('text-transform: uppercase')
    if (s.name === 'display-stat') decl.push('font-variant-numeric: tabular-nums')
    css.push(`.ds-${s.name} { ${decl.join('; ')}; }`)
  }
}
writeFileSync(join(dir, 'tokens.css'), css.join('\n') + '\n')
console.log('design-system/tokens.css written')

const target = process.argv[2] || '606493259e725b96'
const t = await fetch(`https://scrumhub.com.br/_next/static/chunks/${target}.js`).then((r) => r.text())
const patterns = [
  /["'](\/api[^"']+)["']/g,
  /fetch\(["']([^"']+)["']/g,
  /axios\.[a-z]+\(["']([^"']+)["']/g,
  /TicketPublico[a-zA-Z]*/g,
  /ticket-externo[a-zA-Z/-]*/g,
]
for (const p of patterns) {
  const hits = [...t.matchAll(p)].map((m) => m[1] || m[0])
  const uniq = [...new Set(hits)]
  if (uniq.length) {
    console.log('\n', p, '\n', uniq.slice(0, 50).join('\n'))
  }
}

const idx = t.indexOf('TicketPublicoPorSlug')
if (idx >= 0) console.log('\nCTX:\n', t.slice(Math.max(0, idx - 200), idx + 600))

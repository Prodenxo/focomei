const chunks = [
  '0fcfcdc15958f88c',
  '2b441f5f4566a41c',
  '75065424fe252615',
  'c76a1791917093c0',
  '606493259e725b96',
  'd96012bcfc98706a',
]

for (const c of chunks) {
  const res = await fetch(`https://scrumhub.com.br/_next/static/chunks/${c}.js`)
  if (!res.ok) continue
  const t = await res.text()
  const apis = [...t.matchAll(/["'](\/api[^"']{3,120})["']/g)].map((m) => m[1])
  const uniq = [...new Set(apis)]
  if (uniq.length) console.log(c, uniq.join('\n  '))
  if (/ticket-externo|apiKey|api-key|x-api-key|formulario|ticketExterno/i.test(t)) {
    console.log(c, 'HAS KEYWORDS')
    const snippets = [...t.matchAll(/ticket[a-zA-Z0-9_/-]{0,40}/gi)].slice(0, 15).map((m) => m[0])
    console.log('  snippets:', [...new Set(snippets)].join(', '))
  }
}

const probes = [
  'https://scrumhub.com.br/api/tickets',
  'https://scrumhub.com.br/api/ticket-externo',
  'https://scrumhub.com.br/api/public/tickets',
  'https://scrumhub.com.br/api/v1/tickets',
  'https://api.scrumhub.com.br/tickets',
]
for (const url of probes) {
  try {
    const r = await fetch(url, { method: 'OPTIONS' })
    console.log('PROBE', url, r.status, r.headers.get('allow'))
  } catch (e) {
    console.log('PROBE', url, 'ERR', e.message)
  }
}

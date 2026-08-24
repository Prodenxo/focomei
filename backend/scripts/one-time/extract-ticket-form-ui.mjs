const t = await fetch('https://scrumhub.com.br/_next/static/chunks/2b441f5f4566a41c.js').then((r) => r.text())
const idx = t.indexOf('TicketExternoForm')
console.log(t.slice(idx, idx + 5000))

const chunks = ['606493259e725b96', '2b441f5f4566a41c']
for (const target of chunks) {
  const t = await fetch(`https://scrumhub.com.br/_next/static/chunks/${target}.js`).then((r) => r.text())
  for (const needle of [
    'public/tickets',
    'formulario-config',
    'tickets-pai',
    'ticket-anexos',
    'fetchTicketPublicoPorSlug',
    'createTicket',
    'criarTicket',
  ]) {
    let start = 0
    while (true) {
      const idx = t.indexOf(needle, start)
      if (idx < 0) break
      console.log(`\n=== ${target} @ ${needle} ===`)
      console.log(t.slice(Math.max(0, idx - 120), idx + 400))
      start = idx + needle.length
      if (start - idx > 5000) break
    }
  }
}

const t = await fetch('https://scrumhub.com.br/_next/static/chunks/606493259e725b96.js').then((r) => r.text())
const idx = t.indexOf('ra=async')
console.log(t.slice(idx, idx + 2500))

const idx2 = t.indexOf('re=async')
console.log('\n\nFORM CONFIG:\n', t.slice(idx2, idx2 + 800))

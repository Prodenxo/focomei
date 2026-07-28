import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../../..')
const src = path.join(root, 'apps/meiinfinito/docs/ops/openclaw-midas-SOUL.md')
const dst = path.join(__dirname, 'SOUL.md')

let t = fs.readFileSync(src, 'utf8')

const voceIdx = t.indexOf('Você é um **Consultor')
if (voceIdx < 0) {
  throw new Error('Marcador "Você é um **Consultor" não encontrado no SOUL MeiInfinito')
}
t = t.slice(voceIdx)

const header = [
  '# SOUL — FocoMEI (OpenClaw)',
  '',
  '**Não coles este ficheiro inteiro no console EasyPanel** — o terminal corta ~4 KB.',
  '',
  'Deploy: ver `README.md` nesta pasta (`OPENCLAW_SOUL_RAW_URL` / curl Git Raw).',
  'Destino: `/home/node/.openclaw/workspace/SOUL.md`',
  '',
  'Portado de `apps/meiinfinito/docs/ops/openclaw-midas-SOUL.md` (paridade de fluxo).',
  '',
  '---',
  '',
  '',
].join('\n')

t = header + t

t = t.replace(/Meu Financeiro/g, 'FocoMEI')
t = t.replace(/MEI Infinito/g, 'FocoMEI')
t = t.replace(/\bMidas\b/g, 'FocoMEI')
t = t.replace(/midas-kb\.md/g, 'MF-API.md')
t = t.replace(/openclaw-midas-knowledge-base\.md/g, 'MF-API.md')
t = t.replace(/\*\*FocoMEI\*\* e no \*\*FocoMEI\*\*/g, '**FocoMEI** (focomei.com.br)')
t = t.replace(/\*\*FocoMEI\*\* e o \*\*FocoMEI\*\*/g, '**FocoMEI**')
t = t.replace(/o FocoMEI e o FocoMEI/g, 'o FocoMEI')
t = t.replace(/somente o FocoMEI e o FocoMEI/g, 'somente o FocoMEI')
t = t.replace(/Sou o FocoMEI, assistente do FocoMEI/g, 'Sou o assistente do FocoMEI')

fs.writeFileSync(dst, t)
console.log('OK', dst)
console.log('bytes', Buffer.byteLength(t))
console.log('lines', t.split('\n').length)

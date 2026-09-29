import { badRequest } from '../utils/errors.js';

const DOCUMENT_TYPE_NFE = 'NFE';

/** Padrões Code 128 (larguras barra/espaço). Índice 103–105 são os inícios; 106 é o fim. */
const CODE128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122122', '122221', '132212', '221213',
  '221312', '321212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const UF_POR_CODIGO = {
  11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO',
  21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA',
  31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP',
  41: 'PR', 42: 'SC', 43: 'RS',
  50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
};

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '');

const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);

const firstText = (...values) => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

const formatDoc = (digits) => {
  const doc = onlyDigits(digits);
  if (doc.length === 14) {
    return `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
  }
  if (doc.length === 11) {
    return `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  }
  return doc;
};

const formatChave = (chave) => chave.replace(/(\d{4})(?=\d)/g, '$1 ').trim();

const formatMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return text.slice(0, 10);
};

/** IE de verdade é numérica. "ISENTO" é só o texto que a etiqueta usa quando não há número. */
const inscricaoNumerica = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw || /^isento$/i.test(raw)) return '';
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 2 ? digits : '';
};

const chaveFromValue = (value) => {
  const digits = onlyDigits(value);
  return digits.length === 44 ? digits : '';
};

const findNamed = (root, names, depth = 0) => {
  if (!root || depth > 8) return '';
  if (Array.isArray(root)) {
    for (const item of root) {
      const found = findNamed(item, names, depth + 1);
      if (found) return found;
    }
    return '';
  }
  const object = asObject(root);
  if (!object) return '';
  for (const name of names) {
    if (object[name] != null && object[name] !== '') return object[name];
  }
  for (const value of Object.values(object)) {
    const found = findNamed(value, names, depth + 1);
    if (found) return found;
  }
  return '';
};

const partyFrom = (source, role) => {
  const root = asObject(source) || {};
  const party = asObject(root[role]) || asObject(root[role === 'emitente' ? 'prestador' : 'tomador']) || {};
  const endereco = asObject(party.endereco) || {};
  return {
    nome: firstText(party.razaoSocial, party.nome, party.nomeFantasia),
    documento: onlyDigits(party.cpfCnpj || party.cnpj || party.cpf),
    ie: firstText(party.inscricaoEstadual, party.ie),
    uf: firstText(endereco.estado, endereco.uf, party.uf).toUpperCase().slice(0, 2),
  };
};

const totalFrom = (payload, response) => {
  const named = Number(findNamed(response, ['valor', 'valorTotal', 'valorNota']));
  if (Number.isFinite(named) && named > 0) return named;
  const itens = Array.isArray(payload?.itens) ? payload.itens : [];
  const sum = itens.reduce((acc, item) => {
    const valor = Number(item?.valor ?? item?.valorTotal);
    return acc + (Number.isFinite(valor) ? valor : 0);
  }, 0);
  return sum > 0 ? sum : null;
};

/**
 * Dados mínimos da etiqueta a partir da nota já autorizada.
 * A chave de 44 dígitos é obrigatória: sem ela a nota ainda não foi autorizada.
 */
export const buildDanfeEtiquetaDados = (record) => {
  const documentType = String(record?.document_type || record?.documentType || '').toUpperCase();
  if (documentType && documentType !== DOCUMENT_TYPE_NFE) {
    throw badRequest('A etiqueta simplificada existe só para nota de produto (NF-e).');
  }
  const payload = asObject(record?.payload_json) || asObject(record?.payload) || {};
  const response = asObject(record?.response_json) || asObject(record?.response) || {};
  const chave = chaveFromValue(findNamed({ response, payload }, [
    'chave', 'chaveAcesso', 'chaveNfe', 'chNFe',
  ]));
  if (!chave) {
    throw badRequest('Esta nota ainda não tem chave de acesso. A etiqueta sai depois que a nota for autorizada.');
  }

  const emitente = partyFrom(payload, 'emitente');
  const cadastro = asObject(record?.emitenteCadastro) || {};
  if (!emitente.nome) emitente.nome = firstText(cadastro.razaoSocial, cadastro.nomeFantasia);
  if (!emitente.documento) emitente.documento = chave.slice(6, 20);
  if (!emitente.uf) emitente.uf = firstText(cadastro.uf, UF_POR_CODIGO[Number(chave.slice(0, 2))]);
  if (!inscricaoNumerica(emitente.ie)) {
    const doCadastro = inscricaoNumerica(firstText(cadastro.inscricaoEstadual, cadastro.ie));
    if (doCadastro) emitente.ie = doCadastro;
  }
  const destinatario = partyFrom(payload, 'destinatario');
  const serie = String(Number(chave.slice(22, 25)));
  const numero = String(Number(chave.slice(25, 34)));
  const data = formatDate(firstText(
    findNamed(response, ['dataAutorizacao', 'emissao', 'dataEmissao', 'dhEmi']),
    findNamed(payload, ['dataEmissao', 'emissao']),
  ));
  const protocolo = firstText(findNamed(response, ['protocolo', 'protocol', 'nProt']));

  return {
    chave,
    emitente,
    destinatario,
    serie,
    numero,
    data,
    protocolo,
    valor: totalFrom(payload, response),
    saida: true,
  };
};

/** Código de barras Code 128 C (só dígitos, quantidade par). Cada item é 1 (barra) ou 0 (espaço). */
export const code128Modules = (digits) => {
  const text = onlyDigits(digits);
  if (!text || text.length % 2 !== 0) {
    throw badRequest('A chave da nota precisa ter 44 dígitos para o código de barras.');
  }
  const codes = [105];
  for (let i = 0; i < text.length; i += 2) codes.push(Number(text.slice(i, i + 2)));
  const sum = codes.reduce((acc, code, index) => acc + code * (index === 0 ? 1 : index), 0);
  codes.push(sum % 103);
  codes.push(106);
  const modules = [];
  for (const code of codes) {
    const pattern = CODE128[code];
    let bar = true;
    for (const width of pattern) {
      const size = Number(width);
      for (let i = 0; i < size; i += 1) modules.push(bar ? 1 : 0);
      bar = !bar;
    }
  }
  return modules;
};

const pdfText = (value) => String(value ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')
  .replace(/ã/g, '\\343').replace(/á/g, '\\341').replace(/à/g, '\\340').replace(/â/g, '\\342')
  .replace(/é/g, '\\351').replace(/ê/g, '\\352').replace(/í/g, '\\355')
  .replace(/ó/g, '\\363').replace(/ô/g, '\\364').replace(/õ/g, '\\365')
  .replace(/ú/g, '\\372').replace(/ç/g, '\\347')
  .replace(/Ã/g, '\\303').replace(/Á/g, '\\301').replace(/É/g, '\\311')
  .replace(/Í/g, '\\315').replace(/Ó/g, '\\323').replace(/Ú/g, '\\332').replace(/Ç/g, '\\307');

/** Larguras oficiais (em milésimos do tamanho) da Helvetica, para centralizar de verdade. */
const HELVETICA_WIDTHS = {
  regular: [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
  ],
  bold: [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
    611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
  ],
};

const charWidth = (char, bold) => {
  const table = bold ? HELVETICA_WIDTHS.bold : HELVETICA_WIDTHS.regular;
  if (char === 'º' || char === 'ª') return 365;
  if (char === '·') return 278;
  const base = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const code = base.charCodeAt(0);
  if (code >= 32 && code <= 126) return table[code - 32];
  return 556;
};

const textWidth = (text, size, bold) => {
  let total = 0;
  for (const char of String(text || '')) total += charWidth(char, bold);
  return (total * size) / 1000;
};

const wrapText = (text, size, bold, maxWidth) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && textWidth(next, size, bold) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
};

/** Diminui a letra até caber na largura; texto que nunca cabe é quebrado em linhas. */
const fitLines = (text, { size, bold, maxWidth, minSize = 6, maxLines = 2 }) => {
  if (!text) return [];
  for (let s = size; s >= minSize; s -= 0.5) {
    const lines = wrapText(text, s, bold, maxWidth);
    if (lines.length <= maxLines && lines.every((l) => textWidth(l, s, bold) <= maxWidth)) {
      return lines.map((l) => ({ text: l, size: s, bold }));
    }
  }
  return wrapText(text, minSize, bold, maxWidth).map((l) => ({ text: l, size: minSize, bold }));
};

/** Largura de 80 mm (226 pt), a mais comum nas impressoras de etiqueta e cupom. */
const PAGE_WIDTH = 226;
const FRAME = 6;
const PADDING = 12;
const CONTENT_WIDTH = PAGE_WIDTH - (FRAME + PADDING) * 2;
const LABEL_GRAY = '0.42';

const label = (text) => [{ text, size: 6, bold: false, gray: true }];

const line = (text, size, bold = false, maxLines = 1) => (
  fitLines(text, { size, bold, maxWidth: CONTENT_WIDTH, maxLines })
);

export const buildDanfeEtiquetaPdf = (record) => {
  const dados = buildDanfeEtiquetaDados(record);
  const modules = code128Modules(dados.chave);
  const barcodeWidth = CONTENT_WIDTH;
  const moduleWidth = barcodeWidth / modules.length;
  const barcodeHeight = 44;
  const barcodeX = FRAME + PADDING;
  const destinatarioDoc = dados.destinatario.documento
    ? `${dados.destinatario.documento.length > 11 ? 'CNPJ' : 'CPF'} ${formatDoc(dados.destinatario.documento)}`
    : '';
  const juntar = (...parts) => parts.filter(Boolean).join('  ·  ');

  /** Cada bloco é separado por uma linha, com o mesmo respiro em cima e embaixo. */
  const blocks = [
    [
      ...line('DANFE SIMPLIFICADO', 10, true),
      ...line('ETIQUETA', 7),
    ],
    [
      { barcode: true },
      ...line(formatChave(dados.chave), 6.5),
      ...line(dados.protocolo ? `Protocolo ${dados.protocolo}` : '', 7),
    ],
    [
      ...label('EMITENTE'),
      ...line(dados.emitente.nome, 9, true, 2),
      ...line(juntar(`CNPJ ${formatDoc(dados.emitente.documento)}`, dados.emitente.uf), 7),
      ...line(dados.emitente.ie ? `IE ${dados.emitente.ie}` : 'IE ISENTO', 7),
    ],
    [
      ...line(juntar(dados.saida ? 'SAÍDA' : 'ENTRADA', `SÉRIE ${dados.serie}`, `Nº ${dados.numero}`), 8.5, true),
      ...line(dados.data ? `Emissão ${dados.data}` : '', 7.5),
    ],
    [
      ...label('DESTINATÁRIO'),
      ...line(dados.destinatario.nome, 9, true, 2),
      ...line(juntar(destinatarioDoc, dados.destinatario.uf), 7),
      ...line(dados.destinatario.ie ? `IE ${dados.destinatario.ie}` : '', 7),
    ],
    dados.valor != null
      ? [...label('VALOR TOTAL'), ...line(formatMoney(dados.valor), 13, true)]
      : [],
  ].filter((block) => block.length);

  const ops = [];
  const texts = [];
  const rules = [];
  let y = FRAME + PADDING;
  blocks.forEach((block, index) => {
    if (index > 0) {
      y += 7;
      rules.push(y);
      y += 8;
    }
    for (const item of block) {
      if (item.barcode) {
        let x = barcodeX;
        let start = null;
        for (const bit of modules) {
          if (bit && start === null) start = x;
          if (!bit && start !== null) {
            ops.push({ kind: 'bar', x: start, w: x - start, top: y });
            start = null;
          }
          x += moduleWidth;
        }
        if (start !== null) ops.push({ kind: 'bar', x: start, w: x - start, top: y });
        y += barcodeHeight + 5;
        continue;
      }
      const baseline = y + item.size * 0.78;
      const width = textWidth(item.text, item.size, item.bold);
      const x = FRAME + PADDING + (CONTENT_WIDTH - width) / 2;
      texts.push({ ...item, x, baseline });
      y += item.size * 1.32;
    }
  });
  const pageHeight = y + PADDING + FRAME;

  const content = [
    '0 g 0 G 0.7 w',
    `${FRAME} ${FRAME} ${PAGE_WIDTH - FRAME * 2} ${(pageHeight - FRAME * 2).toFixed(2)} re S`,
    '0.5 w',
    ...rules.map((ry) => {
      const pdfY = (pageHeight - ry).toFixed(2);
      return `${FRAME} ${pdfY} m ${PAGE_WIDTH - FRAME} ${pdfY} l S`;
    }),
    ...ops.map((bar) => {
      const pdfY = pageHeight - bar.top - barcodeHeight;
      return `${bar.x.toFixed(3)} ${pdfY.toFixed(2)} ${bar.w.toFixed(3)} ${barcodeHeight} re f`;
    }),
    ...texts.map((t) => {
      const color = t.gray ? `${LABEL_GRAY} g` : '0 g';
      const pdfY = (pageHeight - t.baseline).toFixed(2);
      return `BT ${color} /F${t.bold ? '2' : '1'} ${t.size} Tf ${t.x.toFixed(2)} ${pdfY} Td (${pdfText(t.text)}) Tj ET`;
    }),
  ].join('\n');
  const pageWidth = PAGE_WIDTH;

  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const font1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const font2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const stream = Buffer.from(content, 'latin1');
  const contents = add(`<< /Length ${stream.length} >>\nstream\n${content}\nendstream`);
  const page = add(`<< /Type /Page /Parent 5 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${contents} 0 R >>`);
  const pages = add(`<< /Type /Pages /Count 1 /Kids [${page} 0 R] >>`);
  const catalog = add(`<< /Type /Catalog /Pages ${pages} 0 R >>`);
  if (pages !== 5 || catalog !== 6) {
    throw new Error('montagem do PDF da etiqueta ficou fora de ordem');
  }

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
};

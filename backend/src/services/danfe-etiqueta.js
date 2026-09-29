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
  if (!emitente.documento) emitente.documento = chave.slice(6, 20);
  if (!emitente.uf) emitente.uf = UF_POR_CODIGO[Number(chave.slice(0, 2))] || '';
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

const line = (parts, dados) => {
  const text = parts.filter(Boolean).join(' ');
  return text || '';
};

export const buildDanfeEtiquetaPdf = (record) => {
  const dados = buildDanfeEtiquetaDados(record);
  const pageWidth = 227;
  const margin = 10;
  const modules = code128Modules(dados.chave);
  const inner = pageWidth - margin * 2;
  const moduleWidth = inner / (modules.length + 20);
  const barcodeWidth = moduleWidth * modules.length;
  const barcodeX = margin + (inner - barcodeWidth) / 2;
  const barcodeHeight = 42;

  const rows = [
    { text: 'DANFE SIMPLIFICADO - ETIQUETA', size: 8, bold: true, center: true },
    { barcode: true },
    { text: formatChave(dados.chave), size: 6, center: true },
    { text: dados.protocolo ? `Protocolo ${dados.protocolo}` : '', size: 7, center: true },
    { text: 'EMITENTE', size: 7, bold: true },
    { text: line([dados.emitente.nome, dados.emitente.uf]), size: 7 },
    { text: `CNPJ ${formatDoc(dados.emitente.documento)}`, size: 7 },
    { text: dados.emitente.ie ? `IE ${dados.emitente.ie}` : 'IE ISENTO', size: 7 },
    { text: `NF-e ${dados.saida ? 'SAIDA' : 'ENTRADA'}  Serie ${dados.serie}  Numero ${dados.numero}`, size: 7 },
    { text: dados.data ? `Emissao ${dados.data}` : '', size: 7 },
    { text: 'DESTINATARIO', size: 7, bold: true },
    { text: line([dados.destinatario.nome, dados.destinatario.uf]), size: 7 },
    { text: dados.destinatario.documento ? `CPF/CNPJ ${formatDoc(dados.destinatario.documento)}` : '', size: 7 },
    { text: dados.destinatario.ie ? `IE ${dados.destinatario.ie}` : '', size: 7 },
    { text: dados.valor != null ? `Valor total ${formatMoney(dados.valor)}` : '', size: 8, bold: true },
  ].filter((row) => row.barcode || row.text);

  let y = 14;
  const bars = [];
  for (const row of rows) {
    if (row.barcode) {
      y += 6;
      row.barTop = y;
      let x = barcodeX;
      let drawing = false;
      let start = x;
      for (const bit of modules) {
        if (bit && !drawing) {
          start = x;
          drawing = true;
        } else if (!bit && drawing) {
          bars.push({ x: start, w: x - start });
          drawing = false;
        }
        x += moduleWidth;
      }
      if (drawing) bars.push({ x: start, w: x - start, top: y });
      bars.forEach((bar) => { bar.top = y; });
      y += barcodeHeight + 10;
      continue;
    }
    y += row.size + 3;
    row.y = y;
  }
  const pageHeight = Math.max(y + 16, 240);
  const content = [
    ...bars.map((bar) => {
      const pdfY = pageHeight - bar.top - barcodeHeight;
      return `${bar.x.toFixed(2)} ${pdfY.toFixed(2)} ${bar.w.toFixed(2)} ${barcodeHeight} re f`;
    }),
    ...rows.filter((row) => row.text).map((row) => {
      const size = row.size;
      const text = pdfText(row.text);
      const approx = row.text.length * size * 0.5;
      const x = row.center ? Math.max(margin, (pageWidth - approx) / 2) : margin;
      const pdfY = pageHeight - row.y;
      return `BT /F${row.bold ? '2' : '1'} ${size} Tf ${x.toFixed(2)} ${pdfY.toFixed(2)} Td (${text}) Tj ET`;
    }),
  ].join('\n');

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

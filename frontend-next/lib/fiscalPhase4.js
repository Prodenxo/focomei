function asObjects(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === 'object');
  return typeof value === 'object' ? [value] : [];
}

function collectFiscalErrorText(value, depth = 0) {
  if (depth > 5 || value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => collectFiscalErrorText(item, depth + 1)).join(' ');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => /codigo|code|descricao|mensagem|message|erro|error|retorno/i.test(key))
      .map(([, item]) => collectFiscalErrorText(item, depth + 1))
      .join(' ');
  }
  return String(value);
}

/** Detecta a rejeição de RPS duplicado sem depender de um formato único da PlugNotas. */
export function isE0014RejectedRecord(record) {
  const status = String(record?.status || record?.situacao || '').toLowerCase();
  if (!status.includes('rejeit') && !status.includes('interromp')) return false;
  if (record?.metadata_json?.nfseRejectionCode === 'E0014') return true;
  const text = [
    ...asObjects(record?.response_json),
    ...asObjects(record?.payload_json),
  ].map((item) => collectFiscalErrorText(item)).join(' ');
  return /\bE0014\b/i.test(text)
    || /rps[\s\S]{0,80}(duplicad|j[aá]\s+(?:foi\s+)?informad|utilizad)/i.test(text);
}

/** IDs que podem ser autoarquivados; ignora linhas já arquivadas e repetidas. */
export function getE0014AutoArchiveIds(records, attemptedIds = new Set()) {
  return (Array.isArray(records) ? records : [])
    .filter((record) => (
      record?.id
      && !record.archived_at
      && !record.archived
      && !attemptedIds.has(record.id)
      && isE0014RejectedRecord(record)
    ))
    .map((record) => record.id);
}

export function normalizeCnaeOptions(lookup) {
  const source = Array.isArray(lookup?.cnaes)
    ? lookup.cnaes
    : [
      ...(lookup?.cnaePrincipal ? [{ ...lookup.cnaePrincipal, principal: true }] : []),
      ...(Array.isArray(lookup?.cnaesSecundarios) ? lookup.cnaesSecundarios : []),
    ];
  const unique = new Map();
  for (const item of source) {
    const codigo = String(item?.codigo || item?.cnae || '').replace(/\D/g, '').slice(0, 7);
    if (codigo.length !== 7 || unique.has(codigo)) continue;
    unique.set(codigo, {
      codigo,
      descricao: String(item?.descricao || '').trim() || null,
      principal: item?.principal === true,
    });
  }
  return [...unique.values()];
}

export function buildCnaeImportPayload(cnaes, selectedCodes, serviceByCnae = {}) {
  const selected = selectedCodes instanceof Set ? selectedCodes : new Set(selectedCodes || []);
  return {
    documentType: 'NFSE',
    items: (Array.isArray(cnaes) ? cnaes : [])
      .filter((item) => selected.has(item.codigo))
      .map((item) => ({
        codigo: item.codigo,
        descricao: item.descricao,
        principal: item.principal === true,
        ...(serviceByCnae[item.codigo]?.codigo
          ? { codigoServico: serviceByCnae[item.codigo].codigo }
          : {}),
      })),
  };
}

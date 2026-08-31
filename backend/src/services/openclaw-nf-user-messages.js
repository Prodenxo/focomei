/** Mensagens para o utilizador final (WhatsApp) — sem payload, action nem JSON. */

export const formatValorBr = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '').trim() || '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const tipoNotaLabel = (documentType) => {
  const dt = String(documentType || '').toUpperCase();
  if (dt === 'NFE') return 'NF-e (produto)';
  if (dt === 'NFCE') return 'NFC-e (varejo)';
  return 'NFS-e (serviço)';
};

/**
 * Pedido de confirmação antes de emitir.
 * @param {{ documentType?: string, tomadorRazaoSocial?: string, destinatarioRazaoSocial?: string, discriminacao?: string, produtoDescricao?: string, valorServico?: number, valorTotal?: number }} preview
 */
const formatNfPreviewItensBlock = (preview = {}) => {
  const dt = String(preview.documentType || '').toUpperCase();
  const label = dt === 'NFE' || dt === 'NFCE' ? 'Produtos' : 'Serviço';
  const itens = Array.isArray(preview.itens) ? preview.itens : [];
  if (itens.length > 1) {
    const lines = itens.map((row, index) => {
      const nome = String(row.produtoDescricao || row.descricao || row.discriminacao || 'Item').trim();
      const qtd = row.quantidade != null ? ` × ${row.quantidade}` : '';
      const valor = formatValorBr(row.valorTotal ?? row.valor ?? row.valorUnitario);
      return `  ${index + 1}. ${nome}${qtd} — ${valor}`;
    });
    return [`• ${label}:`, ...lines].join('\n');
  }
  const item = String(
    preview.discriminacao || preview.produtoDescricao || preview.codigoServico || 'Item',
  ).trim();
  return `• ${label === 'Produtos' ? 'Produto' : label}: ${item}`;
};

export const buildNfConfirmRequestUserMessage = (preview = {}) => {
  const cliente = String(
    preview.tomadorRazaoSocial || preview.destinatarioRazaoSocial || 'Cliente',
  ).trim();
  const valor = formatValorBr(preview.valorServico ?? preview.valorTotal);
  const tipo = tipoNotaLabel(preview.documentType);
  const itensBlock = formatNfPreviewItensBlock(preview);

  return [
    'Resumo da nota fiscal:',
    `• Tipo: ${tipo}`,
    `• Cliente: ${cliente}`,
    itensBlock,
    `• Valor total: ${valor}`,
    '',
    'Posso emitir? Responda *sim* ou *confirmo* que eu envio a nota.',
  ].join('\n');
};

/**
 * @param {object} preview
 * @param {{ status?: string, pdfSent?: boolean, pdfPending?: boolean }} opts
 */
export const normalizeNfStatusKey = (status) => {
  const ascii = String(status || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  if (ascii.includes('concluid') || ascii.includes('autoriz')) return 'concluido';
  if (ascii.includes('rejeit')) return 'rejeitado';
  if (ascii.includes('cancel')) return 'cancelado';
  if (ascii.includes('process')) return 'processando';
  return ascii || 'processando';
};

export const formatNfStatusLabelForUser = (status, { pdfPending = false } = {}) => {
  const key = normalizeNfStatusKey(status);
  if (key === 'concluido') return 'Concluída';
  if (key === 'cancelado') return 'Cancelada';
  if (key === 'rejeitado' && pdfPending) {
    return 'Em processamento na prefeitura';
  }
  if (key === 'rejeitado') return 'Rejeitada pela prefeitura';
  return 'Em processamento na prefeitura';
};

export const buildNfEmittedUserMessage = (preview = {}, opts = {}) => {
  const cliente = String(
    preview.tomadorRazaoSocial || preview.destinatarioRazaoSocial || 'Cliente',
  ).trim();
  const valor = formatValorBr(preview.valorServico ?? preview.valorTotal);
  const tipo = tipoNotaLabel(preview.documentType);
  const itensBlock = formatNfPreviewItensBlock(preview);
  const statusKey = normalizeNfStatusKey(opts.status);
  const pdfPending = opts.pdfPending !== false && statusKey !== 'concluido';
  const statusLabel = formatNfStatusLabelForUser(opts.status, { pdfPending });

  let footer = '';
  if (opts.pdfSent) {
    footer = 'Enviei o PDF da nota aqui no WhatsApp.';
  } else if (opts.pdfAlreadySent) {
    footer = 'O PDF desta nota já foi enviado neste chat.';
  } else if (statusKey === 'rejeitado' && !pdfPending) {
    footer = 'A prefeitura rejeitou esta nota. Veja o motivo no app Meu Financeiro → MEI → Notas.';
  } else if (statusKey === 'cancelado') {
    footer = 'Esta nota foi cancelada.';
  } else if (pdfPending) {
    footer = 'Assim que a nota for autorizada, envio o PDF neste chat.';
  }

  const lines = [
    'Nota fiscal enviada para emissão.',
    `• Tipo: ${tipo}`,
    `• Cliente: ${cliente}`,
    itensBlock,
    `• Valor total: ${valor}`,
    `• Situação: ${statusLabel}`,
  ];
  if (footer) lines.push('', footer);
  return lines.join('\n');
};

/** Instrução só para o agente (não mostrar ao utilizador). */
export const BOT_NF_CONFIRM_INSTRUCTION =
  'INSTRUÇÃO INTERNA: se o utilizador responder sim/confirmo/pode emitir/ok, chame a MESMA action do preview '
  + '(preview_nfe→emit_nfe; preview_nfse→emit_nfse) com os MESMOS dados e "confirm":true no JSON do mf-curl. '
  + 'Produto/camisa/NF-e → SEMPRE emit_nfe. PROIBIDO mudar para emit_nfse. '
  + 'PROIBIDO pedir payload, confirm:true ou comandos técnicos ao utilizador. '
  + 'AGUARDE o exec terminar (JSON) antes de responder — nunca invente "nota enviada" sem ok:true. '
  + 'Se Command still running: no máximo 2 polls; depois avise que ainda processa — sem loop infinito.';

/** Evita loop preview → sim → preview quando o utilizador já confirmou. */
export const BOT_NF_PREVIEW_LOOP_GUARD =
  'Se o utilizador JÁ disse sim/confirmo nesta conversa, PROIBIDO repetir este resumo — '
  + 'chame emit_nfe (se o preview era NF-e) ou emit_nfse (se era NFS-e) com confirm:true e os MESMOS dados. '
  + 'PROIBIDO trocar produto↔serviço.';

/** Após falha na emissão (não voltar ao preview). */
export const BOT_NF_EMIT_FAILED_INSTRUCTION =
  'Emissão falhou. Repita APENAS message ao utilizador (motivo em português curto). '
  + 'Se pedir para tentar de novo: o MESMO emit_* (nfe ou nfse) com confirm:true e os MESMOS dados — '
  + 'PROIBIDO chamar emit_* sem confirm:true após falha ou confirmação. '
  + 'AGUARDE o exec terminar antes de responder. '
  + 'Máximo 1 nova tentativa por pedido explícito do utilizador — PROIBIDO loop automático.';

/** Após emit_* com ok:true — evita múltiplas emissões/PDFs duplicados. */
export const BOT_NF_EMIT_SUCCESS_GUARD =
  'EMISSÃO CONCLUÍDA nesta chamada (ok:true + nota.id) — PROIBIDO chamar emit_nfse, emit_nfe, '
  + 'preview_nfse ou preview_nfe de novo para os mesmos dados. Repita APENAS message. '
  + 'PROIBIDO dizer "problemas técnicos" ou "vou tentar de novo" sem novo pedido do utilizador.';

/** Resposta idempotente — mesma nota já emitida nos últimos minutos. */
export const BOT_NF_EMIT_IDEMPOTENT_GUARD =
  'NOTA JÁ EXISTE (emissão recente duplicada bloqueada) — PROIBIDO emitir de novo. Repita APENAS message.';

/**
 * Mensagem amigável para erros técnicos de emissão NFS-e (WhatsApp).
 * @param {string} rawMessage
 */
export const formatNfseEmitErrorForUser = (rawMessage = '') => {
  const msg = String(rawMessage || '').trim();
  if (!msg) {
    return 'Não foi possível emitir a nota fiscal agora. Tente de novo em instantes.';
  }
  if (/certificado digital não encontrado/i.test(msg)) {
    return (
      'Não encontrei certificado A1 activo no emissor fiscal para alinhar a numeração. '
      + 'Na app: MEI → Certificado — envie o .pfx de novo ou actualize o cadastro da empresa.'
    );
  }
  if (/alinhar a numeração|operation was aborted|aborted/i.test(msg)) {
    return (
      'Não consegui concluir a emissão agora — a PlugNotas demorou a responder '
      + '(sincronização da numeração). Aguarde cerca de 1 minuto e diga *tentar de novo*, '
      + 'ou emita pelo app Meu Financeiro → MEI → Notas.'
    );
  }
  if (
    /certificado\s+(a1|digital|n[aã]o|expirado|vencido|inv[aá]lido|ausente)/i.test(msg)
    || /envie o arquivo \.pfx/i.test(msg)
    || /certificado_nao_configurado/i.test(msg)
  ) {
    return (
      'Não foi possível emitir a nota. Verifique certificado A1 e dados fiscais '
      + 'no app Meu Financeiro → MEI → Notas.'
    );
  }
  if (/^E\d{4}\b/.test(msg) || /\bE\d{4}\s*-\s*/.test(msg)) {
    return msg.length > 280 ? `${msg.slice(0, 277)}...` : msg;
  }
  if (/erro interno/i.test(msg) && !/plugnotas/i.test(msg)) {
    return (
      'A emissora fiscal recusou a NF-e com erro genérico. '
      + 'Confira na app: certificado, NF-e ativa na empresa, endereço completo do cliente '
      + '(CEP, IBGE, UF) e dados do produto (NCM/CFOP). '
      + 'Se for venda para outro estado, aceite o aviso interestadual na app e tente de novo.'
    );
  }
  if (msg.length >= 12 && !/^erro no serviço de emissão fiscal$/i.test(msg)) {
    return msg.length > 280 ? `${msg.slice(0, 277)}...` : msg;
  }
  return msg || 'Não foi possível emitir a nota fiscal agora. Tente de novo em instantes.';
};

const CONFIRM_WORDS = new Set([
  'sim',
  'confirmo',
  'confirmado',
  'ok',
  'manda',
  'emite',
  'pode',
  'pode emitir',
]);

/** Aceita confirm:true ou texto de confirmação do utilizador no campo confirm/confirmar. */
export const isNfEmitConfirmed = (payload = {}) => {
  if (payload?.confirm === true || payload?.confirmar === true) return true;
  const raw = String(payload?.confirm ?? payload?.confirmar ?? '').trim().toLowerCase();
  if (!raw) return false;
  if (raw === 'true') return true;
  return CONFIRM_WORDS.has(raw);
};

const VAGUE_NF_ITEM_REGEX = [
  /^notas?(\s+fiscal(is)?)?(\s+de)?(\s+servicos?)?$/i,
  /^prestacao\s+de\s+servicos?$/i,
  /^servicos?$/i,
  /^emissao\s+de\s+nota/i,
  /^emitir\s+nota/i,
  /^fazer\s+nota/i,
  /^tirar\s+nota/i,
  /^nota\s+para\b/i,
  /^cobranca$/i,
];

const normalizeNfItemLabel = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

const VAGUE_NF_ITEM_EXACT = new Set([
  'nota',
  'notas',
  'nota fiscal',
  'nota fiscal de servico',
  'nota fiscal de servicos',
  'prestacao de servicos',
  'servico',
  'servicos',
  'emissao de nota',
  'emitir nota',
  'fazer nota',
  'tirar nota',
  'cobranca',
]);

/** Nome genérico vindo do áudio/LLM — não é item do catálogo. */
export const isVagueNfItemLabel = (value) => {
  const s = normalizeNfItemLabel(value);
  if (!s) return true;
  if (s.length <= 3) return true;
  if (VAGUE_NF_ITEM_EXACT.has(s)) return true;
  return VAGUE_NF_ITEM_REGEX.some((re) => re.test(s));
};

export const formatNfseCatalogChoiceMessage = (produtos = [], options = {}) => {
  const list = Array.isArray(produtos) ? produtos : [];
  if (!list.length) {
    return 'Você ainda não tem serviços cadastrados. Cadastre na app (MEI → Notas) e peça a nota de novo.';
  }
  const intro = String(options.prefix || '').trim()
    || 'Qual serviço você quer na nota? Responda com o número ou o nome exato:';
  const lines = list.map((p, i) => `${i + 1}. ${String(p.discriminacao || '—').trim()}`);
  return `${intro}\n${lines.join('\n')}`;
};

export const formatNfeCatalogChoiceMessage = (produtos = []) => {
  const list = Array.isArray(produtos) ? produtos : [];
  if (!list.length) {
    return 'Você ainda não tem produtos cadastrados. Cadastre na app (MEI → Notas) e peça a nota de novo.';
  }
  const lines = list.map((p, i) => `${i + 1}. ${String(p.discriminacao || '—').trim()}`);
  return `Qual produto você quer na nota? Responda com o número ou o nome exato:\n${lines.join('\n')}`;
};

export const formatNfCatalogAmbiguousMessage = (label, matches = [], documentType = 'NFSE') => {
  const tipo = documentType === 'NFE' ? 'produto' : 'serviço';
  const list = Array.isArray(matches) ? matches : [];
  const lines = list.map((p, i) => `${i + 1}. ${String(p.discriminacao || '—').trim()}`);
  return `Encontrei vários ${tipo}s parecidos com "${label}". Qual é?\n${lines.join('\n')}`;
};

export const formatNfCatalogNotFoundMessage = (label, catalog = [], documentType = 'NFSE') => {
  const tipo = documentType === 'NFE' ? 'produto' : 'serviço';
  const list = Array.isArray(catalog) ? catalog : [];
  if (!list.length) {
    return `Não encontrei o ${tipo} "${label}" e seu catálogo está vazio. Cadastre na app (MEI → Notas).`;
  }
  const lines = list.map((p, i) => `${i + 1}. ${String(p.discriminacao || '—').trim()}`);
  return `Não encontrei o ${tipo} "${label}". Escolha um do seu catálogo:\n${lines.join('\n')}`;
};

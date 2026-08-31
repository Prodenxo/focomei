import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNfConfirmRequestUserMessage,
  buildNfEmittedUserMessage,
  formatNfseCatalogChoiceMessage,
  formatNfseEmitErrorForUser,
  formatValorBr,
  isNfEmitConfirmed,
  isVagueNfItemLabel,
} from '../src/services/openclaw-nf-user-messages.js';

test('formatValorBr formata moeda pt-BR', () => {
  assert.equal(formatValorBr(100), 'R$\u00a0100,00');
  assert.equal(formatValorBr('250.5'), 'R$\u00a0250,50');
});

test('buildNfConfirmRequestUserMessage — NFS-e com dados completos', () => {
  const msg = buildNfConfirmRequestUserMessage({
    documentType: 'NFSE',
    tomadorRazaoSocial: 'CF Contabilidade',
    discriminacao: 'Consultoria contábil',
    valorServico: 100,
  });
  assert.match(msg, /NFS-e \(serviço\)/);
  assert.match(msg, /CF Contabilidade/);
  assert.match(msg, /Consultoria contábil/);
  assert.match(msg, /R\$\s*100,00/);
  assert.match(msg, /sim.*confirmo/i);
  assert.doesNotMatch(msg, /payload/i);
  assert.doesNotMatch(msg, /confirm:true/i);
});

test('buildNfConfirmRequestUserMessage — NF-e produto', () => {
  const msg = buildNfConfirmRequestUserMessage({
    documentType: 'NFE',
    destinatarioRazaoSocial: 'Cliente XYZ',
    produtoDescricao: 'Água 20L',
    valorTotal: 25,
  });
  assert.match(msg, /NF-e \(produto\)/);
  assert.match(msg, /Produto: Água 20L/);
});

test('buildNfConfirmRequestUserMessage — NF-e com vários produtos', () => {
  const msg = buildNfConfirmRequestUserMessage({
    documentType: 'NFE',
    destinatarioRazaoSocial: 'Cliente XYZ',
    valorTotal: 37,
    itens: [
      { produtoDescricao: 'Camisa branca', quantidade: 2, valorTotal: 10 },
      { produtoDescricao: 'Água 20L', quantidade: 1, valorTotal: 27 },
    ],
  });
  assert.match(msg, /Produtos:/);
  assert.match(msg, /1\. Camisa branca/);
  assert.match(msg, /2\. Água 20L/);
  assert.match(msg, /Valor total: R\$\s*37,00/);
});

test('buildNfEmittedUserMessage — PDF enviado', () => {
  const msg = buildNfEmittedUserMessage(
    {
      documentType: 'NFSE',
      tomadorRazaoSocial: 'CF Contabilidade',
      discriminacao: 'Serviço X',
      valorServico: 100,
    },
    { status: 'processando', pdfSent: true },
  );
  assert.match(msg, /enviada para emissão/i);
  assert.match(msg, /Enviei o PDF/i);
  assert.doesNotMatch(msg, /Tomador:/i);
});

test('buildNfEmittedUserMessage — rejeitado transitório mostra processamento', () => {
  const msg = buildNfEmittedUserMessage(
    {
      documentType: 'NFSE',
      tomadorRazaoSocial: 'Rafael Reis',
      discriminacao: 'Apoio administrativo',
      valorServico: 1,
    },
    { status: 'rejeitado', pdfPending: true },
  );
  assert.match(msg, /Em processamento na prefeitura/i);
  assert.doesNotMatch(msg, /Situação: rejeitado/i);
  assert.match(msg, /Assim que a nota for autorizada/i);
});

test('buildNfEmittedUserMessage — PDF já enviado anteriormente', () => {
  const msg = buildNfEmittedUserMessage(
    {
      documentType: 'NFSE',
      tomadorRazaoSocial: 'Rafael Reis',
      discriminacao: 'Apoio administrativo',
      valorServico: 1,
    },
    { status: 'concluido', pdfAlreadySent: true },
  );
  assert.match(msg, /PDF desta nota já foi enviado/i);
});

test('isNfEmitConfirmed aceita linguagem natural', () => {
  assert.equal(isNfEmitConfirmed({ confirm: true }), true);
  assert.equal(isNfEmitConfirmed({ confirm: 'confirmo' }), true);
  assert.equal(isNfEmitConfirmed({ confirmar: 'sim' }), true);
  assert.equal(isNfEmitConfirmed({}), false);
  assert.equal(isNfEmitConfirmed({ confirm: 'talvez' }), false);
});

test('formatNfseEmitErrorForUser traduz timeout PlugNotas', () => {
  const msg = formatNfseEmitErrorForUser(
    'Não foi possível alinhar a numeração na PlugNotas: This operation was aborted',
  );
  assert.match(msg, /PlugNotas/i);
  assert.match(msg, /tentar de novo/i);
  assert.doesNotMatch(msg, /aborted/i);
});

test('formatNfseEmitErrorForUser repassa rejeição E0014 sem culpar certificado', () => {
  const msg = formatNfseEmitErrorForUser(
    'E0014 - Conjunto de Série, Número, Código do Município Emissor e CNPJ/CPF/CNPJ do emitente já informado.',
  );
  assert.match(msg, /E0014/);
  assert.doesNotMatch(msg, /certificado A1/i);
});

test('formatNfseEmitErrorForUser repassa mensagem PlugNotas específica', () => {
  const upstream = 'Código de serviço municipal inválido para o município informado.';
  assert.equal(formatNfseEmitErrorForUser(upstream), upstream);
});

test('isVagueNfItemLabel rejeita nomes genéricos do áudio', () => {
  assert.equal(isVagueNfItemLabel(''), true);
  assert.equal(isVagueNfItemLabel('nota fiscal de serviços'), true);
  assert.equal(isVagueNfItemLabel('Prestação de serviços'), true);
  assert.equal(isVagueNfItemLabel('nota'), true);
  assert.equal(isVagueNfItemLabel('Consultoria contábil'), false);
});

test('formatNfseCatalogChoiceMessage lista catálogo numerado', () => {
  const msg = formatNfseCatalogChoiceMessage([
    { discriminacao: 'Consultoria' },
    { discriminacao: 'Manutenção' },
  ]);
  assert.match(msg, /1\. Consultoria/);
  assert.match(msg, /2\. Manutenção/);
  assert.match(msg, /número ou o nome exato/i);
});

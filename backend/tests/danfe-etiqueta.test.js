import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDanfeEtiquetaDados, buildDanfeEtiquetaPdf, code128Modules } from '../src/services/danfe-etiqueta.js';

const CHAVE = '33260965805583000173550010000000191123456780';

test('etiqueta lê a chave autorizada e os dados da nota', () => {
  const dados = buildDanfeEtiquetaDados({
    document_type: 'NFE',
    emitenteCadastro: { razaoSocial: 'Loja do Bairro', uf: 'RJ' },
    payload_json: {
      emitente: { cpfCnpj: '65805583000173' },
      destinatario: { razaoSocial: 'Maria Silva', cpfCnpj: '12345678901', endereco: { uf: 'SP' } },
      itens: [{ valor: 12.5 }],
    },
    response_json: {
      chave: CHAVE,
      protocolo: '133260000000001',
      dataAutorizacao: '29/09/2026',
    },
  });
  assert.equal(dados.chave, CHAVE);
  assert.equal(dados.numero, '19');
  assert.equal(dados.serie, '1');
  assert.equal(dados.emitente.uf, 'RJ');
  assert.equal(dados.emitente.nome, 'Loja do Bairro');
  assert.equal(dados.destinatario.nome, 'Maria Silva');
  assert.equal(dados.data, '29/09/2026');
  assert.equal(dados.valor, 12.5);
});

test('nota de serviço e nota sem chave não geram etiqueta', () => {
  assert.throws(() => buildDanfeEtiquetaDados({ document_type: 'NFSE', response_json: { chave: CHAVE } }), /nota de produto/);
  assert.throws(() => buildDanfeEtiquetaDados({ document_type: 'NFE', response_json: {} }), /chave de acesso/);
});

test('código de barras da chave começa no padrão numérico e o PDF abre como PDF', () => {
  const modules = code128Modules(CHAVE);
  assert.equal(modules.slice(0, 6).join(''), '110100');
  const pdf = buildDanfeEtiquetaPdf({
    document_type: 'NFE',
    payload_json: { emitente: { razaoSocial: 'Loja' }, destinatario: { razaoSocial: 'Cliente' } },
    response_json: { chave: CHAVE, protocolo: '1' },
  });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.match(pdf.toString('latin1'), /DANFE SIMPLIFICADO/);
});

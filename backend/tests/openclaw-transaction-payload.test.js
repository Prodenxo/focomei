import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferTipoFromNaturalLanguage,
  normalizeOpenclawTransactionPayload,
  normalizeOpenclawTransactionUpdate,
} from '../src/services/openclaw-transaction-payload.js';

const contas = [
  { id: 'id-mf', nome: 'Meu Financeiro', tipo: 'dinheiro', ativo: true },
  { id: 'id-nu', nome: 'Nubank', tipo: 'corrente', ativo: true },
  { id: 'id-poup', nome: 'Poupança Caixa', tipo: 'poupanca', ativo: true },
];

const categories = [
  { nome: 'Aluguel', tipo: 'entrada' },
  { nome: 'Salário', tipo: 'entrada' },
];

const basePayload = {
  tipo: 'entrada',
  valor: 400,
  classificacao: 'Aluguel',
  data: '2026-06-05',
};

test('create_transaction usa carteira explícita Nubank', () => {
  const r = normalizeOpenclawTransactionPayload(
    { ...basePayload, carteira: 'Nubank' },
    { categories, contas },
  );
  assert.equal(r.conta_id, 'id-nu');
  assert.equal(r.conta_nome, 'Nubank');
});

test('create_transaction sem carteira com uma só conta usa essa conta', () => {
  const r = normalizeOpenclawTransactionPayload(basePayload, {
    categories,
    contas: [contas[0]],
  });
  assert.equal(r.conta_id, 'id-mf');
  assert.equal(r.conta_nome, 'Meu Financeiro');
});

test('create_transaction sem carteira e várias contas exige escolha', () => {
  assert.throws(
    () => normalizeOpenclawTransactionPayload(basePayload, { categories, contas }),
    (err) => {
      assert.match(String(err.message), /várias carteiras/i);
      assert.equal(err.errors?.code, 'CARTEIRA_ESCOLHA_OBRIGATORIA');
      return true;
    },
  );
});

test('create_transaction converte pendente em pago/recebido para o dashboard', () => {
  const saida = normalizeOpenclawTransactionPayload(
    {
      tipo: 'saida',
      valor: 35,
      classificacao: 'Aluguel',
      data: '2026-06-24',
      status: 'pendente',
    },
    { categories, contas: [contas[0]] },
  );
  assert.equal(saida.status, 'pago');

  const entrada = normalizeOpenclawTransactionPayload(
    {
      ...basePayload,
      status: 'pendente',
    },
    { categories, contas: [contas[0]] },
  );
  assert.equal(entrada.status, 'recebido');
});

test('create_transaction com carteira inexistente não cai no padrão silenciosamente', () => {
  assert.throws(
    () =>
      normalizeOpenclawTransactionPayload(
        { ...basePayload, carteira: 'Itaú' },
        { categories, contas },
      ),
    (err) => {
      assert.match(String(err.message), /Itaú/);
      return true;
    },
  );
});

test('create_transaction infere carteira de obs "no Nubank"', () => {
  const r = normalizeOpenclawTransactionPayload(
    {
      ...basePayload,
      obs: 'Comprovante no Nubank',
    },
    { categories, contas },
  );
  assert.equal(r.conta_id, 'id-nu');
});

test('create_transaction infere poupança por tipo quando há uma só', () => {
  const r = normalizeOpenclawTransactionPayload(
    {
      ...basePayload,
      obs: 'Depósito na poupança',
    },
    { categories, contas },
  );
  assert.equal(r.conta_id, 'id-poup');
});

test('update_transaction com carteira inválida falha', () => {
  assert.throws(
    () =>
      normalizeOpenclawTransactionUpdate(
        { id: 'tx-1', carteira: 'Banco X' },
        { categories, contas },
      ),
    (err) => {
      assert.match(String(err.message), /não encontrada/);
      return true;
    },
  );
});

test('update_transaction altera carteira para Nubank', () => {
  const patch = normalizeOpenclawTransactionUpdate(
    { id: 'tx-1', carteira: 'Nubank' },
    { categories, contas },
  );
  assert.equal(patch.conta_id, 'id-nu');
});

test('inferTipoFromNaturalLanguage detecta paguei/gastei como saida', () => {
  assert.equal(
    inferTipoFromNaturalLanguage('Paguei dois mil oitocentos e trinta e oito de prestação do carro'),
    'saida',
  );
  assert.equal(inferTipoFromNaturalLanguage('gastei 25 no café'), 'saida');
  assert.equal(inferTipoFromNaturalLanguage('Pagamento da Prestação do Carro'), 'saida');
  assert.equal(inferTipoFromNaturalLanguage('Paguei o cartão de crédito 1990'), 'saida');
  assert.equal(inferTipoFromNaturalLanguage('recebi 4599 de salário'), 'entrada');
  assert.equal(
    inferTipoFromNaturalLanguage('recebi pagamento do cliente João'),
    'entrada',
  );
});

test('create_transaction corrige entrada quando texto indica despesa (paguei)', () => {
  const r = normalizeOpenclawTransactionPayload(
    {
      tipo: 'entrada',
      valor: 2838,
      classificacao: 'Pagamento da Prestação do Carro',
      data: 'hoje',
      status: 'pago',
      obs: 'Pagamento de prestação do carro via WhatsApp',
    },
    { categories, contas: [contas[0]] },
  );
  assert.equal(r.tipo, 'saida');
  assert.equal(r.status, 'pago');
  assert.equal(r.tipoCorrected, true);
  assert.equal(r.tipoOriginal, 'entrada');
});

test('create_transaction corrige cartão de crédito sem confundir com carteira', () => {
  const r = normalizeOpenclawTransactionPayload(
    {
      tipo: 'entrada',
      valor: 1990,
      classificacao: 'Pagamento do Cartão de Crédito',
      data: 'hoje',
      status: 'pago',
      obs: 'Pagamento de cartão de crédito via WhatsApp',
    },
    { categories, contas: [contas[0]] },
  );
  assert.equal(r.tipo, 'saida');
  assert.equal(r.status, 'pago');
  assert.equal(r.tipoCorrected, true);
});

test('create_transaction infere saida a partir de transcript no payload', () => {
  const r = normalizeOpenclawTransactionPayload(
    {
      tipo: 'entrada',
      valor: 1990,
      classificacao: 'Cartão de Crédito',
      data: 'hoje',
      transcript: 'Paguei o cartão de crédito 1990',
    },
    { categories, contas: [contas[0]] },
  );
  assert.equal(r.tipo, 'saida');
});

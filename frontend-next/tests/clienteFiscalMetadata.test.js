import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildClienteFiscalMetadata,
  formatClienteLookupPhone,
} from '../lib/clienteFiscalMetadata.js';

const baseForm = {
  indIEDest: '1',
  inscricaoEstadual: '20.643.227-5',
  inscricaoMunicipal: ' 12345/1 ',
  telefone: ' (84) 99999-0000 ',
  endereco: {
    logradouro: ' Rua A ',
    numero: ' 10 ',
    complemento: '',
    bairro: ' Centro ',
    cep: '59000-000',
    cidade: ' Natal ',
    estado: 'rn',
    codigoCidade: '2408102',
  },
};

test('salva IE, IM e telefone no cadastro do cliente contribuinte', () => {
  const metadata = buildClienteFiscalMetadata(baseForm);
  assert.equal(metadata.indIEDest, '1');
  assert.equal(metadata.inscricaoEstadual, '206432275');
  assert.equal(metadata.inscricaoMunicipal, '12345/1');
  assert.equal(metadata.telefone, '(84) 99999-0000');
  assert.equal(metadata.endereco.descricaoCidade, 'Natal');
  assert.equal(metadata.endereco.estado, 'RN');
});

test('não salva IE quando cliente não é contribuinte', () => {
  const metadata = buildClienteFiscalMetadata({ ...baseForm, indIEDest: '9' });
  assert.equal(metadata.inscricaoEstadual, undefined);
});

test('normaliza telefone retornado pela consulta de CNPJ', () => {
  assert.equal(
    formatClienteLookupPhone({ ddd: '84', numero: '999990000' }),
    '84999990000',
  );
  assert.equal(formatClienteLookupPhone('(84) 3333-0000'), '(84) 3333-0000');
});

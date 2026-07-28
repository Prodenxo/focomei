import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mapUserMeiCertificateRowToNfsePrestadorDto,
  normalizeUserMeiCertificateDbRow,
} from '../src/services/mei-prestador-prefill.service.js';

test('normalizeUserMeiCertificateDbRow mapeia cert_document e fiscal_email', () => {
  const row = normalizeUserMeiCertificateDbRow({
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    cert_document: '12.345.678/0001-90',
    razao_social: 'MEI Teste',
    fiscal_email: 'a@b.com',
    inscricao_municipal: '123',
    ibge_municipio: '3304557',
    cep: '20000-000',
    uf: 'rj',
    cidade: 'Rio',
    logradouro: 'Rua A',
    numero: '10',
  });
  assert.equal(row?.cnpj, '12.345.678/0001-90');
  assert.equal(row?.email, 'a@b.com');
  assert.equal(row?.codigo_ibge, '3304557');
});

test('mapUserMeiCertificateRowToNfsePrestadorDto preenche DTO e dígitos do CNPJ', () => {
  const dto = mapUserMeiCertificateRowToNfsePrestadorDto({
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    cnpj: '12.345.678/0001-90',
    razao_social: 'MEI Teste',
    email: 'a@b.com',
    inscricao_municipal: '123',
    logradouro: 'Rua A',
    numero: '10',
    complemento: null,
    bairro: 'Centro',
    codigo_ibge: '3304557',
    cep: '20000-000',
    cidade: 'Rio',
    uf: 'rj',
  });
  assert.equal(dto.prestadorCpfCnpj, '12345678000190');
  assert.equal(dto.prestadorRazaoSocial, 'MEI Teste');
  assert.equal(dto.prestadorEndereco?.estado, 'RJ');
  assert.equal(dto.prestadorEndereco?.cep, '20000000');
  assert.equal(dto.sourceRowId, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
});

test('mapUserMeiCertificateRowToNfsePrestadorDto retorna vazio para null', () => {
  const dto = mapUserMeiCertificateRowToNfsePrestadorDto(null);
  assert.equal(dto.prestadorCpfCnpj, null);
  assert.equal(dto.sourceRowId, null);
  assert.equal(dto.prestadorEndereco, null);
});

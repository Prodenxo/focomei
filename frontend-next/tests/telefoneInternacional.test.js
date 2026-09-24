import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNationalPhoneInput,
  formatPhoneBrCell,
  limitNationalDigits,
  normalizePhoneDigits,
} from '../lib/internationalPhone.js';
import {
  buildInternationalPhone,
  getPhoneCountryByIso,
  splitInternationalPhone,
} from '../lib/phoneCountries.js';

test('o campo não injeta o código do país enquanto o número é digitado', () => {
  assert.equal(formatNationalPhoneInput('br', ''), '');
  assert.equal(formatNationalPhoneInput('br', '2'), '2');
  assert.equal(formatNationalPhoneInput('br', '21'), '21');
  assert.equal(formatNationalPhoneInput('br', '219'), '(21) 9');
  assert.equal(formatNationalPhoneInput('br', '219999'), '(21) 9999');
  assert.equal(formatNationalPhoneInput('br', '21999990000'), '(21) 99999-0000');
});

test('DDD 55 é um DDD de verdade e não pode ser confundido com o código do Brasil', () => {
  assert.equal(formatNationalPhoneInput('br', '55999887766'), '(55) 99988-7766');
});

test('fixo de 10 dígitos mantém o formato de 4 dígitos no final', () => {
  assert.equal(formatPhoneBrCell('2133334444'), '(21) 3333-4444');
});

test('fora do Brasil o número segue sem máscara brasileira', () => {
  assert.equal(formatNationalPhoneInput('us', '2025550123'), '2025550123');
});

test('dígito além do que a máscara desenha é recusado, não embaralhado', () => {
  assert.equal(limitNationalDigits('br', '73999843269'), '73999843269');
  assert.equal(limitNationalDigits('br', '5573999843269'), '55739998432');
  assert.equal(limitNationalDigits('us', '2025550123'), '2025550123');
});

/**
 * Regressão: o campo relê o próprio texto formatado a cada tecla. Sem teto nos
 * dígitos, digitar o número com o código do país na frente perdia dígitos e
 * trocava a ordem dos últimos.
 */
test('digitar o número com o 55 na frente não perde nem troca dígitos', () => {
  let national = '';
  for (const tecla of '5573999843269') {
    national = limitNationalDigits('br', formatNationalPhoneInput('br', national) + tecla);
  }
  assert.equal(national, '55739998432');
  assert.equal(normalizePhoneDigits(formatNationalPhoneInput('br', national)), national);
});

test('o que é exibido volta igual ao que foi salvo', () => {
  const salvo = buildInternationalPhone(getPhoneCountryByIso('br'), '21999990000');
  assert.equal(salvo, '5521999990000');

  const { country, nationalDigits } = splitInternationalPhone(salvo);
  assert.equal(country.iso, 'br');
  assert.equal(nationalDigits, '21999990000');
  assert.equal(formatNationalPhoneInput(country.iso, nationalDigits), '(21) 99999-0000');
});

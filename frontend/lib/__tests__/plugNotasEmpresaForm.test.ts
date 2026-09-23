import {
  buildPlugNotasEmpresaPayload,
  empresaFiscalToCompanyForm,
  getDefaultPlugNotasCompanyForm,
  getPlugNotasCompanyValidationMessage,
} from '../plugNotasEmpresaForm';

describe('buildPlugNotasEmpresaPayload', () => {
  it('inclui documentosAtivos para o backend aplicar toggles NF-e/NFC-e', () => {
    const form = {
      ...getDefaultPlugNotasCompanyForm(),
      razaoSocial: 'Empresa Teste LTDA',
      logradouro: 'Rua A',
      numero: '1',
      bairro: 'Centro',
      cep: '01310100',
      codigoCidade: '3550308',
      descricaoCidade: 'São Paulo',
      estado: 'SP',
      nfseAtivo: true,
      nfeAtivo: true,
      nfceAtivo: false,
    };
    const payload = buildPlugNotasEmpresaPayload({
      cnpj: '12345678000199',
      certificadoId: '',
      form,
    });
    expect(payload.documentosAtivos).toEqual({ nfse: true, nfe: true, nfce: false });
    expect(payload.certificado).toBeUndefined();
    expect((payload.nfe as { ativo: boolean }).ativo).toBe(true);
    expect(payload.rps).toEqual({ lote: 1, numeracao: [{ numero: 1, serie: '1' }] });
    expect((payload.nfse as { config: Record<string, unknown> }).config.nfseNacional).toBe(true);
    expect((payload.nfse as { config: Record<string, unknown> }).config.rps).toEqual({
      serie: '1',
      numero: 1,
      lote: 1,
    });
  });

  it('exige e-mail válido antes de cadastrar no emissor fiscal', () => {
    const form = {
      ...getDefaultPlugNotasCompanyForm(),
      razaoSocial: 'Empresa Teste LTDA',
      logradouro: 'Rua A',
      numero: '1',
      bairro: 'Centro',
      cep: '01310100',
      codigoCidade: '3550308',
      descricaoCidade: 'São Paulo',
      estado: 'SP',
      email: '',
    };
    expect(getPlugNotasCompanyValidationMessage(form)).toMatch(/e-mail/i);

    const invalid = { ...form, email: 'sem-arroba' };
    expect(getPlugNotasCompanyValidationMessage(invalid)).toMatch(/e-mail válido/i);
  });

  it('bloqueia salvar com NFC-e ativa sem CSC (Plugnotas exige sefaz)', () => {
    const form = {
      ...getDefaultPlugNotasCompanyForm(),
      razaoSocial: 'Empresa Teste LTDA',
      logradouro: 'Rua A',
      numero: '1',
      bairro: 'Centro',
      cep: '01310100',
      codigoCidade: '3550308',
      descricaoCidade: 'São Paulo',
      estado: 'SP',
      email: 'contato@empresa.com.br',
      nfseAtivo: true,
      nfeAtivo: true,
      nfceAtivo: true,
    };
    expect(getPlugNotasCompanyValidationMessage(form)).toMatch(/ID e o código CSC/i);
  });

  it('envia o CSC no formato oficial da NFC-e', () => {
    const form = {
      ...getDefaultPlugNotasCompanyForm(),
      nfceAtivo: true,
      nfceCscId: '000001',
      nfceCscCodigo: 'segredo-csc',
    };
    const payload = buildPlugNotasEmpresaPayload({
      cnpj: '12345678000199',
      certificadoId: '',
      form,
    });

    const nfce = payload.nfce as {
      config: { sefaz: Record<string, string>; numeracao: { serie: number; numero: number }[] };
    };
    expect(nfce.config.sefaz).toEqual({
      idCodigoSegurancaContribuinte: '000001',
      codigoSegurancaContribuinte: 'segredo-csc',
    });
    expect(nfce.config.numeracao).toEqual([{ serie: 1, numero: 1 }]);
  });

  it('carrega o próximo RPS já configurado no emissor', () => {
    const form = empresaFiscalToCompanyForm({
      nfse: { ativo: true, config: { rps: { numero: 43, serie: '1', lote: 1 } } },
    });

    expect(form.rpsNumero).toBe(43);
  });

  it('envia o próximo RPS do formulário para o PlugNotas', () => {
    const form = {
      ...getDefaultPlugNotasCompanyForm(),
      razaoSocial: 'Empresa Teste LTDA',
      email: 'contato@empresa.com.br',
      logradouro: 'Rua A',
      numero: '1',
      bairro: 'Centro',
      cep: '01310100',
      codigoCidade: '3550308',
      descricaoCidade: 'São Paulo',
      estado: 'SP',
      rpsNumero: 100,
    };

    const payload = buildPlugNotasEmpresaPayload({
      cnpj: '12345678000199',
      certificadoId: '',
      form,
    });

    expect(payload.rps).toEqual({
      lote: 1,
      numeracao: [{ numero: 100, serie: '1' }],
    });
    expect((payload.nfse as { config: { rps: { numero: number } } }).config.rps.numero).toBe(100);
  });
});

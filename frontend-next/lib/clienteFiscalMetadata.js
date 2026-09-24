const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

export function formatClienteLookupPhone(telefone) {
  if (!telefone) return '';
  if (typeof telefone === 'string') return telefone.trim();
  return `${telefone.ddd || ''}${telefone.numero || ''}`.replace(/\D/g, '');
}

export function buildClienteFiscalMetadata(form) {
  const indIEDest = String(form?.indIEDest || '9');
  return {
    endereco: {
      logradouro: form?.endereco?.logradouro?.trim(),
      numero: form?.endereco?.numero?.trim(),
      complemento: form?.endereco?.complemento?.trim(),
      bairro: form?.endereco?.bairro?.trim(),
      cep: onlyDigits(form?.endereco?.cep),
      descricaoCidade: form?.endereco?.cidade?.trim(),
      estado: form?.endereco?.estado?.trim()?.toUpperCase(),
      codigoCidade: onlyDigits(form?.endereco?.codigoCidade),
    },
    indIEDest,
    ...(indIEDest === '1' && onlyDigits(form?.inscricaoEstadual)
      ? { inscricaoEstadual: onlyDigits(form.inscricaoEstadual) }
      : {}),
    ...(form?.inscricaoMunicipal?.trim()
      ? { inscricaoMunicipal: form.inscricaoMunicipal.trim() }
      : {}),
    ...(form?.telefone?.trim() ? { telefone: form.telefone.trim() } : {}),
  };
}

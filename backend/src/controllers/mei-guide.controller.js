import * as meiGuideService from '../services/mei-guide.service.js';
import * as meiGuideDasBase64Service from '../services/mei-guide-das-base64.service.js';
import { getNfsePrestadorPrefill } from '../services/mei-prestador-prefill.service.js';
import { badRequest } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

const persistDasBase64Safely = async (payload) => {
  try {
    await meiGuideDasBase64Service.upsertDasBase64(payload);
  } catch (persistError) {
    console.warn('[mei-guide] Falha ao persistir DAS (não-fatal):', persistError?.message || persistError);
  }
};

const forwardMeiGuideError = (error, next, actionLabel = 'operar o DAS') => {
  if (error?.status) return next(error);
  console.error(`[mei-guide] erro inesperado ao ${actionLabel}:`, error?.message || error, error?.stack);
  return next(
    badRequest(
      error?.message || `Não foi possível ${actionLabel}. Tente novamente em instantes.`,
      { code: 'MEI_DAS_INTERNAL' },
    ),
  );
};

export const createGuide = async (req, res, next) => {
  try {
    const data = await meiGuideService.createGuide(req.user.id, {
      ...req.body,
      autorPedidoDados: req.body?.autorPedidoDados,
      contribuinte: req.body?.contribuinte
    });
    if (data?.pdfBase64 && data?.id) {
      await persistDasBase64Safely({
        userId: req.user.id,
        periodoApuracao: data.id,
        pdfBase64: data.pdfBase64,
      });
    }
    return sendSuccess(res, data, 'Guia MEI gerada');
  } catch (error) {
    return next(error);
  }
};

export const regenerateGuide = async (req, res, next) => {
  try {
    const { id } = req.params || {};
    const data = await meiGuideService.regenerateDasPdf(req.user.id, {
      cnpj: req.body?.cnpj,
      periodoApuracao: id,
      contribuinte: req.body?.contribuinte,
    });
    if (data?.pdfBase64 && data?.id) {
      await persistDasBase64Safely({
        userId: req.user.id,
        periodoApuracao: data.id,
        pdfBase64: data.pdfBase64,
      });
    }
    return sendSuccess(res, data, 'DAS regenerado na Receita e guardado');
  } catch (error) {
    return forwardMeiGuideError(error, next, 'atualizar o DAS na Receita');
  }
};

export const downloadGuide = async (req, res, next) => {
  try {
    const { id } = req.params || {};
    const autorPedidoDados = req.query?.autorNumero ? {
      numero: req.query.autorNumero,
      tipo: req.query?.autorTipo
    } : null;
    const contribuinte = req.query?.contribuinteNumero ? {
      numero: req.query.contribuinteNumero,
      tipo: req.query?.contribuinteTipo
    } : null;
    const forceRefresh = String(req.query?.forceRefresh || '').toLowerCase() === 'true'
      || String(req.query?.refresh || '').toLowerCase() === 'true';
    const file = await meiGuideService.downloadGuide({
      userId: req.user.id,
      cnpj: req.query?.cnpj,
      periodoApuracao: id,
      autorPedidoDados,
      contribuinte,
      forceRefresh,
    });
    const buffer = file?.buffer;
    if (!buffer?.length) {
      return next(Object.assign(new Error('PDF do DAS vazio ou indisponível'), { status: 404 }));
    }
    const isPdf =
      buffer.length >= 4
      && buffer[0] === 0x25
      && buffer[1] === 0x50
      && buffer[2] === 0x44
      && buffer[3] === 0x46;
    if (!isPdf) {
      return next(Object.assign(new Error('Resposta da Receita não é um PDF válido'), { status: 502 }));
    }
    await persistDasBase64Safely({
      userId: req.user.id,
      periodoApuracao: id,
      pdfBase64: buffer.toString('base64'),
    });
    if (file.refreshed) {
      res.setHeader('X-DAS-Refreshed', '1');
    }
    if (file.vencida) {
      res.setHeader('X-DAS-Vencida', '1');
    }
    res.setHeader('Content-Type', file.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    return res.send(buffer);
  } catch (error) {
    return forwardMeiGuideError(error, next, 'baixar o DAS');
  }
};

export const uploadCertificate = async (req, res, next) => {
  try {
    const data = await meiGuideService.uploadCertificate(req.user.id, {
      file: req.file,
      password: req.body?.password,
      ...req.body
    });
    return sendSuccess(res, data, 'Certificado carregado');
  } catch (error) {
    return next(error);
  }
};

export const patchCertificateEmitenteNfse = async (req, res, next) => {
  try {
    const data = await meiGuideService.patchCertificateEmitenteNfse(req.user.id, req.body || {});
    return sendSuccess(res, data, 'Dados fiscais NFS-e atualizados');
  } catch (error) {
    return next(error);
  }
};

export const removeCertificate = async (req, res, next) => {
  try {
    const data = await meiGuideService.removeCertificate(req.user.id);
    return sendSuccess(res, data, 'Certificado removido');
  } catch (error) {
    return next(error);
  }
};

export const getCertificateStatus = async (req, res, next) => {
  try {
    const data = await meiGuideService.getCertificateStatus(req.user.id);
    return sendSuccess(res, data, 'Status do certificado obtido');
  } catch (error) {
    return next(error);
  }
};

/** Prefill do prestador NFS-e (substitui Edge `mei-prestador-prefill` em AUTH_MODE=local). */
export const getPrestadorPrefill = async (req, res, next) => {
  try {
    const data = await getNfsePrestadorPrefill(req.user.id);
    return sendSuccess(res, data, 'Prefill do prestador obtido');
  } catch (error) {
    return next(error);
  }
};

export const validateGuide = async (req, res, next) => {
  try {
    const data = await meiGuideService.validateGuide(req.user.id, {
      ...req.body
    });
    return sendSuccess(res, data, 'Validação concluída');
  } catch (error) {
    return next(error);
  }
};

export const listPeriods = async (req, res, next) => {
  try {
    const autorPedidoDados = req.query?.autorNumero ? {
      numero: req.query.autorNumero,
      tipo: req.query?.autorTipo
    } : null;
    const contribuinte = req.query?.contribuinteNumero ? {
      numero: req.query.contribuinteNumero,
      tipo: req.query?.contribuinteTipo
    } : null;
    const refresh =
      String(req.query?.refresh || '').toLowerCase() === 'true'
      || String(req.query?.refresh || '') === '1';
    const data = await meiGuideService.listPeriods(req.user.id, {
      cnpj: req.query?.cnpj,
      autorPedidoDados,
      contribuinte,
      refresh,
    });
    return sendSuccess(res, data, 'Períodos MEI listados');
  } catch (error) {
    return next(error);
  }
};

export const listPeriodsByCnpj = async (req, res, next) => {
  try {
    const refresh =
      String(req.query?.refresh || '').toLowerCase() === 'true'
      || String(req.query?.refresh || '') === '1';
    const data = await meiGuideService.listPeriodsByCnpj(req.user.id, {
      cnpj: req.query?.cnpj,
      refresh,
    });
    return sendSuccess(res, data, 'Períodos MEI listados');
  } catch (error) {
    return next(error);
  }
};

export const getParcelamentos = async (req, res, next) => {
  try {
    const contribuinte = req.query?.contribuinteNumero ? {
      numero: req.query.contribuinteNumero,
      tipo: req.query.contribuinteTipo
    } : null;
    const data = await meiGuideService.listParcelamentos(req.user.id, {
      cnpj: req.query?.cnpj,
      contribuinte,
      scope: req.query?.scope === 'mei' ? 'mei' : 'all'
    });
    return sendSuccess(res, data, 'Parcelamentos MEI listados');
  } catch (error) {
    return next(error);
  }
};

export const getParcelamentoParcelas = async (req, res, next) => {
  try {
    const { numero } = req.params || {};
    const contribuinte = req.query?.contribuinteNumero ? {
      numero: req.query.contribuinteNumero,
      tipo: req.query.contribuinteTipo
    } : null;
    const data = await meiGuideService.listParcelamentoParcelas(req.user.id, {
      numero,
      cnpj: req.query?.cnpj,
      modalidade: req.query?.modalidade,
      contribuinte
    });
    return sendSuccess(res, data, 'Parcelas do parcelamento listadas');
  } catch (error) {
    return next(error);
  }
};

export const getParcelamentoPdf = async (req, res, next) => {
  try {
    const { numero } = req.params || {};
    const contribuinte = req.query?.contribuinteNumero ? {
      numero: req.query.contribuinteNumero,
      tipo: req.query.contribuinteTipo
    } : null;
    const file = await meiGuideService.getOrDownloadParcelamentoPdf(req.user.id, {
      numero,
      cnpj: req.query?.cnpj,
      modalidade: req.query?.modalidade,
      parcela: req.query?.parcela,
      periodoApuracao: req.query?.periodoApuracao,
      contribuinte
    });
    res.setHeader('Content-Type', file.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    return res.send(file.buffer);
  } catch (error) {
    return next(error);
  }
};

import * as contasFinanceirasService from '../services/contas-financeiras.service.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

export const listContas = async (req, res, next) => {
  try {
    const includeInactive = String(req.query.includeInactive || '') === '1'
      || String(req.query.all || '') === '1';
    const data = await contasFinanceirasService.listContasFinanceiras(req.user.id, {
      activeOnly: !includeInactive,
    });
    return sendSuccess(res, { contas: data }, 'Contas listadas');
  } catch (error) {
    return next(error);
  }
};

export const createConta = async (req, res, next) => {
  try {
    const data = await contasFinanceirasService.createContaFinanceira(req.user.id, req.body ?? {});
    return sendCreated(res, { conta: data }, 'Conta criada');
  } catch (error) {
    return next(error);
  }
};

export const updateConta = async (req, res, next) => {
  try {
    const data = await contasFinanceirasService.updateContaFinanceira(req.user.id, {
      ...(req.body ?? {}),
      conta_id: req.params.id,
      id: req.params.id,
    });
    return sendSuccess(res, { conta: data }, 'Conta atualizada');
  } catch (error) {
    return next(error);
  }
};

export const deleteConta = async (req, res, next) => {
  try {
    const data = await contasFinanceirasService.deleteContaFinanceira(req.user.id, {
      conta_id: req.params.id,
      id: req.params.id,
    });
    return sendSuccess(res, { conta: data }, 'Conta removida');
  } catch (error) {
    return next(error);
  }
};

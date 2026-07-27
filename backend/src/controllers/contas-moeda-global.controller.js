import * as contasMoedaGlobalService from '../services/contas-moeda-global.service.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

export const listContas = async (req, res, next) => {
  try {
    const data = await contasMoedaGlobalService.listContasMoedaGlobal(req.user.id);
    return sendSuccess(res, { contas: data }, 'Contas moeda global listadas');
  } catch (error) {
    return next(error);
  }
};

export const createConta = async (req, res, next) => {
  try {
    const data = await contasMoedaGlobalService.createContaMoedaGlobal(req.user.id, req.body ?? {});
    return sendCreated(res, { conta: data }, 'Conta moeda global criada');
  } catch (error) {
    return next(error);
  }
};

export const updateConta = async (req, res, next) => {
  try {
    const data = await contasMoedaGlobalService.updateContaMoedaGlobal(
      req.user.id,
      req.params.id,
      req.body ?? {},
    );
    return sendSuccess(res, { conta: data }, 'Conta moeda global atualizada');
  } catch (error) {
    return next(error);
  }
};

export const deleteConta = async (req, res, next) => {
  try {
    const data = await contasMoedaGlobalService.deleteContaMoedaGlobal(req.user.id, req.params.id);
    return sendSuccess(res, data, 'Conta moeda global removida');
  } catch (error) {
    return next(error);
  }
};

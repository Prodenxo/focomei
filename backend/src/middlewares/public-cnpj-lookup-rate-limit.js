import { env } from '../config/env.js';

const buckets = new Map();
const WINDOW_MS = 60_000;

/**
 * Rate limit in-memory por IP para a consulta pública de CNPJ do cadastro de empresa.
 * A rota não exige login, então o limite protege a cota dos provedores externos.
 * Em produção com múltiplas instâncias, preferir Redis ou gateway.
 */
export const publicCnpjLookupRateLimit = (req, res, next) => {
  const max = Math.max(1, Number(env.PUBLIC_CNPJ_LOOKUP_MAX_PER_MINUTE) || 10);
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, bucket);
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return res.status(429).json({
      success: false,
      data: null,
      message: 'Muitas consultas de CNPJ. Aguarde um minuto.',
      errors: null
    });
  }
  return next();
};

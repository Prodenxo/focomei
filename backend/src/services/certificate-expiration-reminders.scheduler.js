import {
  isCertificateExpirationWhatsappEnabled,
  runCertificateExpirationWhatsappReminders,
} from './certificate-expiration-reminders.service.js';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** @type {ReturnType<typeof setInterval> | null} */
let schedulerHandle = null;
let inFlight = null;

const runTick = async () => {
  if (inFlight) return inFlight;
  const work = runCertificateExpirationWhatsappReminders();
  inFlight = work;
  try {
    const summary = await work;
    console.info('[certificate-expiration] scheduler', {
      date: summary.todayIso,
      certificates: summary.totalCertificates || 0,
      sent: summary.sent || 0,
      failed: summary.failed || 0,
      skipped: summary.skipped || null,
    });
    return summary;
  } catch (error) {
    console.warn(
      '[certificate-expiration] scheduler falhou',
      error instanceof Error ? error.message : error,
    );
    return null;
  } finally {
    if (inFlight === work) inFlight = null;
  }
};

export const startCertificateExpirationReminderScheduler = () => {
  if (schedulerHandle) return;
  if (!isCertificateExpirationWhatsappEnabled()) {
    console.info('[certificate-expiration] Scheduler desligado');
    return;
  }

  console.info('[certificate-expiration] Scheduler ativo (verificação a cada 6h)');
  schedulerHandle = setInterval(() => {
    void runTick();
  }, CHECK_INTERVAL_MS);
  void runTick();
};

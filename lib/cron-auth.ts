import { isAuthorizedAdmin } from "./auth-check";

/**
 * Zorlama (?force=1) gibi maliyetli cron işlemleri için: Vercel Cron (CRON_SECRET tanımlıysa
 * Authorization: Bearer <CRON_SECRET> gönderir) veya yönetici. Aralığa uyan normal çağrılar herkese açıktır.
 */
export async function isTrustedCronCaller(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return isAuthorizedAdmin(req);
}

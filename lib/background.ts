import { after } from "next/server";

/**
 * İşi yanıt gönderildikten sonra çalıştırır ve sunucusuz fonksiyonu iş bitene kadar canlı tutar.
 *
 * Vercel'de `promise.catch(() => {})` ile başlatılan "ateşle-unut" işler, yanıt döndüğü anda
 * fonksiyon dondurulduğu için yarıda kalır. Next.js `after()` platformun waitUntil mekanizmasını
 * kullanır. İstek bağlamı dışında (ör. betikler) çağrılırsa normal arka plan işine düşer.
 */
export function runInBackground(task: () => Promise<unknown>, label: string): void {
  const run = () =>
    task().catch((err) => {
      console.error(`[Background:${label}]`, err);
    });

  try {
    after(run);
  } catch {
    void run();
  }
}

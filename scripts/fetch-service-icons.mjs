import fs from "fs";
import path from "path";
import { execFile } from "child_process";

/**
 * Hero-SMS servis simgelerini public/services/{kod}.webp olarak indirir.
 * Hero-SMS sitesi simgeleri https://cdn.hero-sms.com/assets/img/service/{kod}0.webp adresinden yükler;
 * servis kodları API'deki getServicesList ile aynıdır.
 *
 * Sonunda lib/service-icons.json yazılır: "available" yerelde simgesi olan, "missing" Hero-SMS'te de simgesi
 * olmayan (CDN 404) servis kodlarıdır. Uygulama missing listesindekiler için doğrudan baş harf rozeti gösterir.
 *
 * Kullanım: node scripts/fetch-service-icons.mjs [--force]
 *   --force  var olan simgeleri de yeniden indirir.
 */

const CDN = "https://cdn.hero-sms.com/assets/img/service";
const OUT_DIR = path.resolve(process.cwd(), "public", "services");
const MANIFEST = path.resolve(process.cwd(), "lib", "service-icons.json");
const FORCE = process.argv.includes("--force");
const CONCURRENCY = 8;

// CDN, Cloudflare arkasındadır: tarayıcı başlıkları olmayan ve Node fetch'inden gelen istekleri (TLS parmak izi)
// engeller. Bu yüzden indirme Windows 10+, macOS ve Linux'ta hazır gelen curl ile yapılır.
const BROWSER_HEADERS = [
  "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Accept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  "Sec-Fetch-Dest: image",
  "Sec-Fetch-Mode: no-cors",
  "Sec-Fetch-Site: cross-site",
];

// .env.local dosyasından değişkenleri oku
const envPath = path.resolve(process.cwd(), ".env.local");
let apiKey = process.env.HERO_SMS_API_KEY;
let baseUrl = process.env.HERO_SMS_BASE_URL || "https://hero-sms.com/stubs/handler_api.php";

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!apiKey && trimmed.startsWith("HERO_SMS_API_KEY=")) {
      apiKey = trimmed.replace("HERO_SMS_API_KEY=", "").trim().replace(/^"|"$/g, "");
    }
    if (!process.env.HERO_SMS_BASE_URL && trimmed.startsWith("HERO_SMS_BASE_URL=")) {
      baseUrl = trimmed.replace("HERO_SMS_BASE_URL=", "").trim().replace(/^"|"$/g, "");
    }
  }
}

if (!apiKey) {
  console.error("❌ Hata: HERO_SMS_API_KEY bulunamadı. Lütfen .env.local dosyasını kontrol edin.");
  process.exit(1);
}

async function getServiceCodes() {
  const res = await fetch(`${baseUrl}?action=getServicesList&api_key=${apiKey}`);
  const data = await res.json();
  const services = Array.isArray(data?.services) ? data.services : [];
  return services.map((s) => String(s.code)).filter((c) => /^[a-z0-9_]+$/i.test(c));
}

function curl(url, file) {
  const args = ["-s", "-o", file, "-w", "%{http_code} %{content_type}"];
  for (const h of BROWSER_HEADERS) args.push("-H", h);
  args.push(url);
  return new Promise((resolve, reject) => {
    execFile("curl", args, (err, stdout) => (err ? reject(err) : resolve(stdout.trim())));
  });
}

async function downloadIcon(code) {
  const file = path.join(OUT_DIR, `${code}.webp`);
  if (!FORCE && fs.existsSync(file)) return "skip";
  const tmp = `${file}.part`;
  const [status, type = ""] = (await curl(`${CDN}/${code}0.webp`, tmp)).split(" ");
  if (status !== "200" || !type.startsWith("image/")) {
    fs.rmSync(tmp, { force: true });
    return `fail:${status}`;
  }
  fs.renameSync(tmp, file);
  return "ok";
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const codes = await getServiceCodes();
  console.log(`🔎 ${codes.length} servis bulundu, simgeler indiriliyor...`);

  const stats = { ok: 0, skip: 0, fail: 0 };
  const failed = [];
  let index = 0;

  async function worker() {
    while (index < codes.length) {
      const code = codes[index++];
      try {
        const result = await downloadIcon(code);
        if (result === "ok" || result === "skip") stats[result]++;
        else {
          stats.fail++;
          failed.push(`${code} (${result})`);
        }
      } catch (err) {
        stats.fail++;
        failed.push(`${code} (${err.message})`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`✅ İndirilen: ${stats.ok} • Atlanan: ${stats.skip} • Başarısız: ${stats.fail}`);
  if (failed.length) console.log(`⚠️ Simgesi alınamayanlar: ${failed.join(", ")}`);

  const available = fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.slice(0, -5))
    .sort();
  // Yalnızca CDN'in 404 döndüğü kodlar "simgesiz" sayılır; engelleme/ağ hatası olanlar çalışma anında CDN'den denenir.
  const missing = failed
    .filter((f) => f.endsWith("(fail:404)"))
    .map((f) => f.split(" ")[0])
    .sort();
  fs.writeFileSync(MANIFEST, JSON.stringify({ available, missing }) + "\n");
  console.log(`📝 ${path.relative(process.cwd(), MANIFEST)}: ${available.length} simge, ${missing.length} simgesiz servis.`);
}

main().catch((err) => {
  console.error("❌ Hata:", err);
  process.exit(1);
});

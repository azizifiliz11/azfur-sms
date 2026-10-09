# 🚀 HeroSMS • Telegram Bot & Mini App (TMA) SMS Onay Platformu

**HeroSMS**, [Hero-SMS API](https://hero-sms.com) altyapısını kullanan, **Tremor + Tailwind CSS** tasarım sistemine sahip, sıfır giriş bariyeriyle doğrudan Telegram içinde çalışan profesyonel bir **Telegram Mini App (TMA) SMS Onay Platformu**dur.

---

## 🌟 Öne Çıkan Özellikler

### 📱 1. Telegram Mini App (TMA) Entegrasyonu
- **Sıfır Kayıt/Giriş Bariyeri:** Kullanıcıdan e-posta veya şifre istenmez. Telegram WebApp üzerinden kullanıcı kimliği arka planda doğrulanır ve bakiye tanımlanır.
- **Yerel Mobil Titreşim (Haptic Feedback):** Numara kopyalandığında, sipariş verildiğinde ve SMS kodu düştüğünde telefona hafif titreşim verilir.
- **Telegram Koyu Mod Uyumu:** Telegram tema parametreleri (`themeParams.bg_color`, `secondary_bg_color`) ve Linear/Stripe koyu slate/zinc zemin estetiği.
- **Telegram Bot Anlık Push Bildirimi:** Kullanıcı Mini App'i kapatsa bile, arka planda SMS kodu düştüğü anda bot kullanıcıya özel mesaj iletir:
  ```
  🔔 SMS KODUNUZ GELDİ!
  ✅ Servis: WhatsApp
  📱 Numara: +90 534 812 34 56
  🔑 SMS Kodu: 849-201
  ```

### 📊 2. Canlı Stok ve Dinamik Kâr Marjı Motoru
- **Hero-SMS API:** `e1006858662edcAd8d348c9f07dfe8c5` anahtarı ile canlı 195 ülke ve 800+ servis stoğu ve anlık fiyatları çekilir.
- **Dinamik Fiyatlandırma:**
  - Maliyet + %X Kâr (Örn: Maliyet + %35 kâr)
  - Sabit Ek Ücret (Örn: +5.00 ₺)
  - Dolar / TL otomatik çevirici kuru
  - İstenmeyen servis ve ülkeleri tek tıkla gizleme/açma anahtarı (Toggle).

### ⚡ 3. Canlı Aktif Numaralar (Mobil Tremor Kartları)
- Yanıp sönen yeşil durum noktası (`animate-ping`).
- Monospaced telefon numarası (`font-mono`) ve tek tıkla kopyalama.
- Büyük yeşil `font-mono` OTP kodu kutusu.
- 15:00 dakikadan geriye sayan dinamik sayaç.
- **İptal Et & İade Al:** Kod gelmezse tek tıkla iptal ve anında bakiye iadesi.

### 🛡️ 4. Yönetici Paneli (`/admin`)
- **Hero-SMS Kasa Monitörü:** Sağlayıcı ana bakiyesi canlı izleme.
- **Kâr Motoru:** Kâr marjı, sabit ücret, kur ve Mock/Test modu yönetimi.
- **Kullanıcı & Finans:** Kayıtlı kullanıcılar, manuel bakiye ekleme/çıkarma, bakiye yükleme (CryptoBot, Havale/EFT, Kart) talepleri onaylama/reddetme.
- **Tremor Grafikleri:** Günlük ciro ve net kâr (`AreaChart`), en çok satan servisler (`DonutChart`), başarı oranı (`ProgressBar`).

---

## 🛠️ Kurulum ve Çalıştırma

### 1. Bağımlılıkları Yükleme
```bash
npm install
```

### 2. Ortam Değişkenleri (`.env.local`)
`.env.local` dosyasında API anahtarlarınızı yapılandırın:
```env
HERO_SMS_API_KEY=e1006858662edcAd8d348c9f07dfe8c5
HERO_SMS_BASE_URL=https://hero-sms.com/stubs/handler_api.php
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
ADMIN_TELEGRAM_ID=8614398114
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 3. Geliştirme Sunucusunu Başlatma
```bash
npm run dev
```
Uygulama `http://localhost:3000` adresinde çalışacaktır.
Yönetici paneline doğrudan `http://localhost:3000/admin` adresinden veya Mini App içindeki kalkan simgesinden erişebilirsiniz.

### 4. Telegram Bot Webhook Kurulumu
Bot token'ınızı girdikten sonra webhook'u bağlayabilirsiniz:
```bash
curl -F "url=https://your-domain.com/api/bot/webhook" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```
Bot `@BotFather` üzerinden `/newbot` ile oluşturulup `/newapp` ile WebApp URL'si `https://your-domain.com` olarak tanımlanır.

---

## 📁 Proje Dizin Yapısı
```
smsonay2/
├── app/
│   ├── admin/page.tsx          # Standalone Admin Paneli
│   ├── api/
│   │   ├── admin/              # Genel bakış, ayarlar, kullanıcılar, talepler
│   │   ├── bot/webhook/        # Telegram Bot Webhook (grammy)
│   │   ├── sms/                # Hero-SMS proxy (catalog, order, status, cancel, balance)
│   │   └── user/               # Oturum ve bakiye talepleri
│   ├── globals.css             # Tremor dark, telegram theme tokens, monospace font
│   ├── layout.tsx              # TMA SDK script, viewport & metadata
│   └── page.tsx                # Ana Mini App sayfası
├── components/
│   ├── ActiveNumbers.tsx       # Canlı numara takip & OTP akışı
│   ├── AdminView.tsx           # Kâr motoru, kasa monitörü ve analitik
│   ├── DepositModal.tsx        # Bakiye yükleme (CryptoBot, Havale, Kart)
│   ├── Header.tsx              # Profil, bakiye hapı ve yönetim düğmesi
│   ├── RentPanel.tsx           # Ülke/servis seçici ve sipariş paneli
│   └── tremor/                 # Card, Metric, Badge, Callout, AreaChart, DonutChart
├── hooks/
│   └── useTelegram.ts          # Telegram WebApp hook & fallback
├── lib/
│   ├── config.ts               # Yapılandırma sabitleri
│   ├── db.ts                   # Kalıcı JSON veritabanı (data/db.json)
│   ├── haptic.ts               # Telegram mobil titreşim yöneticisi
│   ├── hero-sms.ts             # Hero-SMS API istemcisi & mock simülasyonu
│   ├── pricing.ts              # Dinamik kâr marjı hesaplama motoru
│   └── telegram-bot.ts         # Bot komutları & anlık SMS push bildirim servisi
└── data/
    └── db.json                 # Kalıcı veritabanı dosyası
```

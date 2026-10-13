export interface Country {
  id: number;
  code?: string;
  eng: string;
  nameTr?: string;
  rus?: string;
  chn?: string;
  visible?: number;
  flag?: string;
  priority?: number;
}

export interface ServiceItem {
  code: string;
  name: string;
  category?: string;
  icon?: string;
}

export interface PriceStockItem {
  cost: number;
  count: number;
  physicalCount?: number;
}

export interface CalculatedCatalogItem {
  serviceCode: string;
  serviceName: string;
  countryId: number;
  countryName: string;
  countryFlag: string;
  originalCostUsd: number;
  calculatedPriceTry: number;
  stock: number;
  physicalStock?: number;
  qualityScore?: number;
  icon?: string;
}

export type CouponType = 'BALANCE' | 'DISCOUNT_PERCENT' | 'DISCOUNT_FIXED';

export interface Coupon {
  id: string;
  code: string; // e.g. "AZFUR10", "HOSGELDIN", "BAYRAM50"
  type: CouponType;
  value: number; // 25 (for 25 TL) or 20 (for 20%)
  description?: string;
  minOrderAmount?: number;
  maxUses?: number; // 0 veya undefined ise sınırsız
  usedCount: number;
  usedByUserIds: number[];
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
}

export interface User {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  balance: number;
  spent: number;
  role: 'user' | 'admin' | 'support'; // support: yalnızca destek taleplerini yönetir
  isBanned?: boolean;
  // VIP Üyelik Sistemi
  isVip?: boolean;
  vipSince?: string;
  vipExpiresAt?: string | null;
  vipDiscountPercent?: number; // Özel indirim oranı (örn: 15 -> %15)
  vipNote?: string;
  activeDiscount?: {
    code: string;
    type: 'DISCOUNT_PERCENT' | 'DISCOUNT_FIXED';
    value: number;
  };
  createdAt: string;
  lastActiveAt: string;
}

export interface ActivationOrder {
  id: string; // activation ID
  telegramId: number;
  serviceCode: string;
  serviceName: string;
  countryId: number;
  countryName: string;
  countryFlag: string;
  phoneNumber: string;
  originalCost: number;
  chargedPrice: number;
  status: 'WAIT_CODE' | 'RECEIVED' | 'CANCELLED' | 'COMPLETED' | 'TIMEOUT';
  smsCode: string | null;
  smsText: string | null;
  createdAt: number;
  expiresAt: number;
  notifiedBot: boolean;
}

export interface BankInfo {
  bankName: string;
  accountHolder: string;
  iban: string;
  descriptionNote?: string;
}

export interface CryptoSettings {
  usdtTrc20Address?: string; // USDT (TRC-20) cüzdan adresi (Kişisel cüzdanınız - Paraların aktarılacağı adres)
  trxAddress?: string; // TRX cüzdan adresi
  apironeAccount?: string; // Apirone Account ID (apr-...)
  apironeTransferKey?: string; // Apirone Transfer Key
  callbackUrl?: string; // İsteğe bağlı özel Webhook Callback URL
  oxapayApiKey?: string; // OxaPay Merchant API Key (Geriye dönük uyumluluk)
  cryptoBotToken?: string; // Geriye dönük uyumluluk
  autoVerifyEnabled?: boolean; // Apirone ile anında otomatik doğrulama
}

export interface CustomPriceRule {
  countryId: number;
  countryName?: string;
  countryFlag?: string;
  serviceCode: string;
  serviceName?: string;
  fixedPriceTry?: number; // Doğrudan sabit TL satış fiyatı (örn: 18.00 ₺)
  marginPercent?: number; // Veya özel kâr oranı (%)
  fixedFee?: number; // Veya özel sabit ek ücret (₺)
}

export interface SystemSettings {
  globalMarginPercent: number; // e.g. 35 -> %35
  globalFixedFee: number; // e.g. 5.0 -> 5 TL
  exchangeRateToTry: number; // e.g. 49.20
  useTcmbAutoRate: boolean; // TCMB'den otomatik canlı kur çekme
  tcmbUpdateIntervalMinutes: number; // Otomatik kur kontrol aralığı
  lastTcmbRate: number; // TCMB'den çekilen son kur
  lastTcmbFetchTime?: string;
  lastTcmbAttemptTime?: string;
  currencySymbol: string; // "₺"
  mockMode: boolean; // toggle to simulate numbers if provider balance is 0 or testing
  adminTelegramId: string;
  adminTelegramIds?: string[]; // Tüm yetkili yönetici Telegram ID listesi
  hiddenServices: string[];
  hiddenCountries: number[];
  serviceCustomMargins: Record<string, { marginPercent?: number; fixedFee?: number }>;
  customPriceRules?: Record<string, CustomPriceRule>; // key: `${countryId}_${serviceCode}` e.g. "62_wa"
  bankInfo?: BankInfo;
  cryptoSettings?: CryptoSettings;
  supportTelegramUsername?: string;
  supportTelegramUsernames?: string[];
  customStickerFileId?: string;
  heroSmsApiKey?: string;
  adminSecurityPin?: string; // Yönetici Web Paneli Giriş PIN Kodu (Örn: 2026 veya özel şifre)
  deletedTelegramIds?: string[]; // Silinen kullanıcı ID kara listesi (asla geri gelmez)
  botInfo?: any; // GrammY botInfo önbelleği (getMe çağrısını 0ms'ye düşürür)
  useBannerPhoto?: boolean; // false = Ultra Hızlı Metin Modu (~30ms), true = Fotoğraflı Kart
  bannerFileId?: string; // Telegram CDN görsel ID'si
  backupSettings?: BackupSettings; // Otomatik yedekleme yapılandırması
  vipSettings?: {
    defaultDiscountPercent: number; // Varsayılan VIP indirim yüzdesi (örn: 15 -> %15)
    autoVipOnDepositAmount?: number; // Otomatik VIP olma eşiği (örn: 500 ₺)
    enabled: boolean;
  };
  maintenanceMode?: boolean; // Sistem bakım modu (Kullanıcılara kapalı, adminlere açık)
  maintenanceMessage?: string; // Samimi özel bakım mesajı
  webhookSecretActive?: boolean; // Telegram webhook gizli anahtarla kayıtlı (anahtarsız güncellemeler reddedilir)
  alertSettings?: Partial<import("./admin-alerts").AlertSettings>; // Yönetici uyarı eşikleri ve günlük rapor
  hiddenServiceCountryPairs?: string[]; // "servis:ülke" — satışa kapatılan kombinasyonlar
  maintenanceSchedule?: import("./maintenance-schedule").MaintenanceSchedule | null; // Planlı bakım
}

export interface BackupStats {
  usersCount: number;
  activationsCount: number;
  ordersCount?: number;
  depositsCount: number;
  ticketsCount: number;
  couponsCount: number;
  totalUserBalance: number;
  totalBalance?: number;
  sizeKb?: number;
}

export interface SystemBackup {
  id: string; // e.g. "backup_1791546000000"
  timestamp: string; // ISO string
  createdAt?: string; // ISO string uyumluluk alanı
  type: "AUTO" | "MANUAL" | "PRE_RESTORE";
  label?: string;
  sizeBytes: number;
  stats: BackupStats;
  data?: any; // Snapshot data
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number; // e.g. 1, 3, 6, 12, 24
  maxBackupsCount: number; // e.g. 20
  lastAutoBackupTime?: string;
  lastBackupAt?: string;
  lastBackupTime?: string;
  deletedBackupIds?: string[]; // Silinen yedeklerin kara listesi (asla tekrar geri gelmez)
}

export interface DepositRequest {
  id: string;
  telegramId: number;
  username: string;
  amount: number;
  method: 'Crypto' | 'USDT_TRC20' | 'TRX' | 'CryptoBot' | 'Havale/EFT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  referenceCode: string;
  txid?: string;
  createdAt: string;
}

export type TicketStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';
export type TicketCategory = 'BALANCE' | 'SMS_NUMBER' | 'GENERAL' | 'OTHER';

export interface TicketMessage {
  id: string;
  sender: 'user' | 'admin';
  senderName: string;
  senderId: number | string;
  text: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  telegramId: number;
  username?: string;
  userFirstName?: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export type LogCategory =
  | 'AUTH'
  | 'DEPOSIT'
  | 'ORDER'
  | 'USER'
  | 'ADMIN'
  | 'SECURITY'
  | 'SETTINGS'
  | 'BACKUP'
  | 'COUPON'
  | 'TICKET'
  | 'CRYPTO'
  | 'BANK'
  | 'PRICING'
  | 'SYSTEM';

export type LogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';

export interface SystemLog {
  id: string;
  timestamp: string; // ISO format
  category: LogCategory;
  level: LogLevel;
  action: string;
  details: string;
  telegramId?: number;
  username?: string;
  ip?: string;
  metadata?: Record<string, any>;
}


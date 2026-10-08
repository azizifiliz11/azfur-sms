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
  role: 'user' | 'admin';
  isBanned?: boolean;
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
  usdtTrc20Address?: string; // USDT (TRC-20) cüzdan adresi
  trxAddress?: string; // TRX cüzdan adresi
  oxapayApiKey?: string; // OxaPay Merchant API Key
  cryptoBotToken?: string; // Geriye dönük uyumluluk
  autoVerifyEnabled?: boolean; // TronScan / OxaPay ile anında otomatik doğrulama
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
  lastTcmbRate: number; // TCMB'den çekilen son kur
  lastTcmbFetchTime?: string;
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

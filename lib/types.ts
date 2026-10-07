export interface Country {
  id: number;
  code?: string;
  eng: string;
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
  icon?: string;
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
  cryptoBotToken?: string; // Telegram @CryptoBot API token
  autoVerifyEnabled?: boolean; // TronScan ile anında otomatik doğrulama
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
  hiddenServices: string[];
  hiddenCountries: number[];
  serviceCustomMargins: Record<string, { marginPercent?: number; fixedFee?: number }>;
  bankInfo?: BankInfo;
  cryptoSettings?: CryptoSettings;
}

export interface DepositRequest {
  id: string;
  telegramId: number;
  username: string;
  amount: number;
  method: 'CryptoBot' | 'Havale/EFT' | 'USDT_TRC20' | 'TRX';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  referenceCode: string;
  txid?: string;
  createdAt: string;
}

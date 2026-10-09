export const APIRONE_PAYMENT_OPTIONS = [
  { coin: "USDT", currency: "usdt@trx", networkKey: "TRC20", networkLabel: "TRON (TRC-20)", unitsFactor: 1e-6 },
  { coin: "USDT", currency: "usdt@eth", networkKey: "ERC20", networkLabel: "Ethereum (ERC-20)", unitsFactor: 1e-6 },
  { coin: "USDT", currency: "usdt@bnb", networkKey: "BEP20", networkLabel: "BNB Smart Chain (BEP-20)", unitsFactor: 1e-18 },
  { coin: "USDT", currency: "usdt@ton", networkKey: "TON", networkLabel: "TON", unitsFactor: 1e-6 },
  { coin: "USDC", currency: "usdc@trx", networkKey: "TRC20", networkLabel: "TRON (TRC-20)", unitsFactor: 1e-6 },
  { coin: "USDC", currency: "usdc@eth", networkKey: "ERC20", networkLabel: "Ethereum (ERC-20)", unitsFactor: 1e-6 },
  { coin: "USDC", currency: "usdc@bnb", networkKey: "BEP20", networkLabel: "BNB Smart Chain (BEP-20)", unitsFactor: 1e-18 },
  { coin: "BTC", currency: "btc", networkKey: "BITCOIN", networkLabel: "Bitcoin", unitsFactor: 1e-8 },
  { coin: "ETH", currency: "eth", networkKey: "ETHEREUM", networkLabel: "Ethereum", unitsFactor: 1e-18 },
  { coin: "TRX", currency: "trx", networkKey: "TRON", networkLabel: "TRON", unitsFactor: 1e-6 },
  { coin: "BNB", currency: "bnb", networkKey: "BEP20", networkLabel: "BNB Smart Chain", unitsFactor: 1e-18 },
  { coin: "LTC", currency: "ltc", networkKey: "LITECOIN", networkLabel: "Litecoin", unitsFactor: 1e-8 },
  { coin: "BCH", currency: "bch", networkKey: "BITCOIN_CASH", networkLabel: "Bitcoin Cash", unitsFactor: 1e-8 },
  { coin: "DOGE", currency: "doge", networkKey: "DOGECOIN", networkLabel: "Dogecoin", unitsFactor: 1e-8 },
  { coin: "TON", currency: "gram", networkKey: "TON", networkLabel: "TON", unitsFactor: 1e-9 },
] as const;

export type ApironeCoin = (typeof APIRONE_PAYMENT_OPTIONS)[number]["coin"];
export type ApironeNetworkKey = (typeof APIRONE_PAYMENT_OPTIONS)[number]["networkKey"];

export const APIRONE_PAYMENT_COINS = Array.from(
  new Set(APIRONE_PAYMENT_OPTIONS.map((option) => option.coin))
) as ApironeCoin[];

export function getApironePaymentOptionsForCoin(coin: string) {
  const normalizedCoin = coin.trim().toUpperCase();
  return APIRONE_PAYMENT_OPTIONS.filter((option) => option.coin === normalizedCoin);
}

export function getApironePaymentOption(coin: string, network?: string) {
  const normalizedCoin = coin.trim().toUpperCase();
  const normalizedNetwork = network?.trim().toUpperCase();
  const options = getApironePaymentOptionsForCoin(normalizedCoin);
  return options.find((option) => option.networkKey === normalizedNetwork) ||
    (!normalizedNetwork ? options[0] : undefined);
}

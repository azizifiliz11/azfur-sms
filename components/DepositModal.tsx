"use client";

import React, { useState, useEffect } from "react";
import { X, Check, Copy, Landmark, Coins, ArrowRight, ShieldCheck, Loader2, Sparkles, Bot, ExternalLink, RefreshCw } from "lucide-react";
import { haptic } from "@/lib/haptic";
import { BankInfo, CryptoSettings } from "@/lib/types";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramId: number;
  onSuccess: (amount: number) => void;
}

export function DepositModal({ isOpen, onClose, telegramId, onSuccess }: DepositModalProps) {
  const [method, setMethod] = useState<"Crypto" | "Havale/EFT">("Crypto");
  const [cryptoSubMethod, setCryptoSubMethod] = useState<"CryptoBot" | "DirectWallet">("CryptoBot");
  const [cryptoType, setCryptoType] = useState<"USDT_TRC20" | "TRX">("USDT_TRC20");
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [verifyingCrypto, setVerifyingCrypto] = useState<boolean>(false);
  const [creatingCryptoBot, setCreatingCryptoBot] = useState<boolean>(false);
  const [activeInvoice, setActiveInvoice] = useState<{
    invoiceId: number;
    payUrl: string;
    amountTry: number;
    amountUsd: number;
  } | null>(null);
  const [verifyingInvoice, setVerifyingInvoice] = useState<boolean>(false);
  const [txidInput, setTxidInput] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [isErrorMsg, setIsErrorMsg] = useState<boolean>(false);

  const [bankInfo, setBankInfo] = useState<BankInfo>({
    bankName: "Ziraat Bankası",
    accountHolder: "AzFur SMS",
    iban: "TR00 0000 0000 0000 0000 0000 00",
    descriptionNote: "Açıklama alanına Telegram ID'nizi veya kullanıcı adınızı yazınız.",
  });

  const [cryptoSettings, setCryptoSettings] = useState<CryptoSettings>({
    usdtTrc20Address: "",
    trxAddress: "",
    autoVerifyEnabled: true,
  });

  const [exchangeRate, setExchangeRate] = useState<number>(49.2);

  useEffect(() => {
    if (isOpen) {
      setMessage(null);
      setIsErrorMsg(false);
      fetch("/api/user/deposit", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            if (data.bankInfo) setBankInfo(data.bankInfo);
            if (data.cryptoSettings) setCryptoSettings(data.cryptoSettings);
            if (data.exchangeRate) setExchangeRate(data.exchangeRate);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const quickAmounts = [50, 100, 250, 500];

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    haptic.success();
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSelectAmount = (val: number) => {
    haptic.selection();
    setAmount(val);
    setCustomAmount("");
  };

  const currentFinalAmount = customAmount ? parseFloat(customAmount) || 0 : amount;

  // Kripto Karşılıkları
  const calculatedUsdt = (currentFinalAmount / (exchangeRate || 49.2)).toFixed(2);
  const calculatedTrx = (currentFinalAmount / ((exchangeRate || 49.2) / 6.3)).toFixed(1);

  const activeCryptoAddress =
    cryptoType === "USDT_TRC20"
      ? cryptoSettings.usdtTrc20Address || "TR7NHqJEKQxGTCi8q8ZY4pL8otSzgjLj6t"
      : cryptoSettings.trxAddress || cryptoSettings.usdtTrc20Address || "TR7NHqJEKQxGTCi8q8ZY4pL8otSzgjLj6t";

  // 0. Telegram @CryptoBot Otomatik Fatura Oluşturma
  const handlePayWithCryptoBot = async () => {
    if (currentFinalAmount < 10) {
      haptic.error();
      setIsErrorMsg(true);
      setMessage("Minimum yükleme tutarı 10 ₺'dir.");
      return;
    }

    setCreatingCryptoBot(true);
    setMessage(null);
    setIsErrorMsg(false);
    haptic.impact("heavy");

    try {
      const res = await fetch("/api/user/deposit/cryptobot-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId,
          amount: currentFinalAmount,
        }),
      });

      const data = await res.json();
      if (data.success && data.payUrl) {
        haptic.success();
        const estUsd = Number((currentFinalAmount / (exchangeRate || 49.2)).toFixed(2));
        setActiveInvoice({
          invoiceId: data.invoiceId,
          payUrl: data.payUrl,
          amountTry: currentFinalAmount,
          amountUsd: estUsd,
        });

        // Telegram WebApp içerisinde doğrudan Telegram linkini aç
        try {
          if (typeof window !== "undefined" && (window as any).Telegram?.WebApp?.openTelegramLink) {
            (window as any).Telegram.WebApp.openTelegramLink(data.payUrl);
          } else {
            window.open(data.payUrl, "_blank");
          }
        } catch {
          window.open(data.payUrl, "_blank");
        }

        setMessage("🚀 Fatura oluşturuldu! Açılan pencerede veya @CryptoBot botunda ödemenizi tamamlayınız. Ödeme onaylandığında bakiyeniz otomatik yüklenecektir.");
      } else {
        haptic.error();
        setIsErrorMsg(true);
        setMessage(data.error || "CryptoBot faturası oluşturulamadı.");
      }
    } catch {
      haptic.error();
      setIsErrorMsg(true);
      setMessage("Sunucuya bağlanırken bir sorun oluştu.");
    } finally {
      setCreatingCryptoBot(false);
    }
  };

  // CryptoBot Faturasını Kontrol Et
  const handleCheckInvoiceStatus = async () => {
    if (!activeInvoice) return;
    setVerifyingInvoice(true);
    haptic.impact("medium");

    try {
      const res = await fetch(`/api/user/deposit/cryptobot-verify?invoiceId=${activeInvoice.invoiceId}`);
      const data = await res.json();

      if (data.success && data.status === "paid") {
        haptic.success();
        setIsErrorMsg(false);
        setMessage(`🎉 Tebrikler! ₺${activeInvoice.amountTry.toFixed(2)} bakiyeniz @CryptoBot ile başarıyla onaylandı ve hesabınıza yüklendi!`);
        onSuccess(activeInvoice.amountTry);
        setTimeout(() => {
          onClose();
        }, 2200);
      } else if (data.status === "active") {
        haptic.selection();
        setIsErrorMsg(false);
        setMessage("⏳ Fatura henüz ödenmedi veya işlem ağda onaylanıyor. Lütfen Telegram'da ödemeyi tamamladıktan sonra tekrar kontrol edin.");
      } else {
        setIsErrorMsg(true);
        setMessage(`Fatura durumu: ${data.status || "Beklemede"}`);
      }
    } catch {
      setIsErrorMsg(true);
      setMessage("Durum sorgulanamadı, lütfen az sonra tekrar deneyiniz.");
    } finally {
      setVerifyingInvoice(false);
    }
  };

  // 1. Otomatik TronScan ile Kripto Doğrulama & Anında Bakiye Yükleme
  const handleVerifyCrypto = async () => {
    if (!txidInput.trim()) {
      haptic.error();
      setIsErrorMsg(true);
      setMessage("Lütfen transfer yaptıktan sonra aldığınız TXID (İşlem Kodu / Hash) kodunu yapıştırınız.");
      return;
    }

    setVerifyingCrypto(true);
    setMessage(null);
    setIsErrorMsg(false);
    haptic.impact("heavy");

    try {
      const res = await fetch("/api/user/deposit/crypto-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId,
          txid: txidInput.trim(),
          cryptoType,
          amountTry: currentFinalAmount,
        }),
      });

      const data = await res.json();
      if (data.success) {
        haptic.success();
        setIsErrorMsg(false);
        setMessage(`🎉 Tebrikler! ₺${data.creditedAmount.toFixed(2)} bakiyeniz TronScan ile doğrulanarak hesabınıza otomatik yüklendi!`);
        onSuccess(data.creditedAmount);
        setTimeout(() => {
          onClose();
        }, 2200);
      } else {
        haptic.error();
        setIsErrorMsg(true);
        setMessage(data.error || "İşlem Tron ağında doğrulanamadı.");
      }
    } catch {
      haptic.error();
      setIsErrorMsg(true);
      setMessage("TronScan servisine bağlanılamadı. Lütfen az sonra tekrar deneyiniz.");
    } finally {
      setVerifyingCrypto(false);
    }
  };

  // 2. Havale / Manuel Talep Gönderimi
  const handleSubmitManual = async () => {
    if (currentFinalAmount < 20) {
      haptic.error();
      setIsErrorMsg(true);
      setMessage("Minimum yükleme tutarı 20 ₺'dir.");
      return;
    }

    setLoading(true);
    setMessage(null);
    setIsErrorMsg(false);
    haptic.impact("medium");

    try {
      const res = await fetch("/api/user/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId,
          amount: currentFinalAmount,
          method: method === "Havale/EFT" ? "Havale/EFT" : cryptoType,
          referenceCode: `DEP-${Math.floor(100000 + Math.random() * 900000)}`,
          txid: txidInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        haptic.success();
        setIsErrorMsg(false);
        setMessage("Talebiniz alındı! Kontrol edildikten sonra bakiyenize yansıtılacaktır.");
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        haptic.error();
        setIsErrorMsg(true);
        setMessage(data.error || "İşlem sırasında hata oluştu.");
      }
    } catch {
      haptic.error();
      setIsErrorMsg(true);
      setMessage("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#11131a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <span>Bakiye Yükle</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Otomatik Onay
                </span>
              </h3>
              <p className="text-xs text-zinc-400">Kripto ile anında, Havale ile güvenli</p>
            </div>
          </div>
          <button
            onClick={() => {
              haptic.impact("light");
              onClose();
            }}
            className="p-1.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Method Tabs: Kripto & Havale */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button
            onClick={() => {
              haptic.selection();
              setMethod("Crypto");
            }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-semibold transition-all ${
              method === "Crypto"
                ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm"
                : "bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Coins className="w-5 h-5 text-amber-400" />
            <span className="flex items-center gap-1">
              <span>Kripto (TRX/USDT)</span>
              <span className="text-[9px] px-1 rounded bg-emerald-500/30 text-emerald-300">Otomatik</span>
            </span>
          </button>

          <button
            onClick={() => {
              haptic.selection();
              setMethod("Havale/EFT");
            }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-semibold transition-all ${
              method === "Havale/EFT"
                ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm"
                : "bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Landmark className="w-5 h-5 text-blue-400" />
            <span>Havale / EFT</span>
          </button>
        </div>

        {/* Quick Amounts */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-zinc-400 font-medium">Yüklenecek Tutar (₺)</label>
            {method === "Crypto" && (
              <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                ≈ {cryptoType === "USDT_TRC20" ? `${calculatedUsdt} USDT` : `${calculatedTrx} TRX`}
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {quickAmounts.map((q) => (
              <button
                key={q}
                onClick={() => handleSelectAmount(q)}
                className={`py-2 px-1 rounded-xl border text-sm font-mono font-bold transition-all ${
                  amount === q && !customAmount
                    ? "bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/20"
                    : "bg-zinc-900 border-white/10 text-zinc-300 hover:border-white/20"
                }`}
              >
                ₺{q}
              </button>
            ))}
          </div>

          <div className="mt-2.5">
            <input
              type="number"
              placeholder="Özel tutar girin (₺)"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* METHOD 1: OTOMATİK KRİPTO (CRYPTOBOT & TRONSCAN) */}
        {method === "Crypto" && (
          <div className="mt-4 space-y-3">
            {/* Kripto Alt Seçenek Tabı: CryptoBot veya Manuel TronScan */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950/80 rounded-2xl border border-white/5">
              <button
                type="button"
                onClick={() => {
                  haptic.selection();
                  setCryptoSubMethod("CryptoBot");
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  cryptoSubMethod === "CryptoBot"
                    ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Bot className="w-4 h-4" />
                <span>@CryptoBot (Otomatik)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  haptic.selection();
                  setCryptoSubMethod("DirectWallet");
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  cryptoSubMethod === "DirectWallet"
                    ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Coins className="w-4 h-4" />
                <span>TronScan (TXID)</span>
              </button>
            </div>

            {/* SEÇENEK A: @CRYPTOBOT OTOMATİK ÖDEME */}
            {cryptoSubMethod === "CryptoBot" && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#121824] to-[#0c0f18] border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">Telegram @CryptoBot ile 1-Tıkla Öde</span>
                        <span className="text-[10px] text-zinc-400 block">Komisyonsuz, anında bot içi onay</span>
                      </div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                      Önerilen
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-xl border border-white/5 text-xs">
                    <span className="text-zinc-400">Ödenecek Tutar:</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      ₺{currentFinalAmount.toFixed(2)}{" "}
                      <span className="text-xs text-zinc-400 font-normal">
                        (≈ ${(currentFinalAmount / (exchangeRate || 49.2)).toFixed(2)} USD)
                      </span>
                    </span>
                  </div>

                  {/* Desteklenen coin rozetleri */}
                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    <span className="text-zinc-400 mr-1">Kabul Edilen:</span>
                    {["USDT", "TON", "TRX", "BTC", "ETH", "LTC"].map((coin) => (
                      <span
                        key={coin}
                        className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-white/5 font-mono font-medium"
                      >
                        {coin}
                      </span>
                    ))}
                  </div>

                  {!activeInvoice ? (
                    <button
                      type="button"
                      onClick={handlePayWithCryptoBot}
                      disabled={creatingCryptoBot || currentFinalAmount <= 0}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-bold text-xs shadow-md shadow-emerald-500/25 transition-all disabled:opacity-50"
                    >
                      {creatingCryptoBot ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Fatura Oluşturuluyor...</span>
                        </>
                      ) : (
                        <>
                          <Bot className="w-4 h-4" />
                          <span>🚀 @CryptoBot ile Hemen Öde (1-Tıkla)</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-2 pt-1 border-t border-white/[0.08]">
                      <div className="flex items-center justify-between text-xs text-zinc-300 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/30">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="font-semibold text-emerald-300">Fatura Aktif (#{activeInvoice.invoiceId})</span>
                        </div>
                        <span className="font-mono text-white font-bold">₺{activeInvoice.amountTry.toFixed(2)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={activeInvoice.payUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Faturayı Aç ↗</span>
                        </a>

                        <button
                          type="button"
                          onClick={handleCheckInvoiceStatus}
                          disabled={verifyingInvoice}
                          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${verifyingInvoice ? "animate-spin" : ""}`} />
                          <span>{verifyingInvoice ? "Kontrol..." : "Ödemeyi Doğrula"}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveInvoice(null);
                          setMessage(null);
                        }}
                        className="w-full text-center text-[10px] text-zinc-500 hover:text-zinc-300 pt-1"
                      >
                        Farklı Tutarla Yeni Fatura Oluştur
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SEÇENEK B: MANUEL TRONSCAN TXID DOĞRULAMA */}
            {cryptoSubMethod === "DirectWallet" && (
              <div className="space-y-3">
                {/* Kripto Birimi Seçimi */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      haptic.selection();
                      setCryptoType("USDT_TRC20");
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      cryptoType === "USDT_TRC20"
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                        : "bg-zinc-900/80 border-white/5 text-zinc-400"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>USDT (TRC-20)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      haptic.selection();
                      setCryptoType("TRX");
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      cryptoType === "TRX"
                        ? "bg-rose-500/20 border-rose-500 text-rose-300"
                        : "bg-zinc-900/80 border-white/5 text-zinc-400"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span>TRX (Tron)</span>
                  </button>
                </div>

                {/* Yatırma Cüzdanı Kartı */}
                <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-white/10 text-xs text-zinc-300 space-y-2.5">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Gönderilecek Adres ({cryptoType === "USDT_TRC20" ? "TRC-20" : "Tron"}):</span>
                    <span className="text-[10px] text-amber-400 font-bold">Yalnızca Tron Ağı</span>
                  </div>

                  <div className="flex justify-between items-center bg-black/50 p-2.5 rounded-xl font-mono text-[11px] border border-white/5">
                    <span className="truncate mr-2 text-emerald-300 font-bold select-all">
                      {activeCryptoAddress}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeCryptoAddress)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 text-emerald-400 hover:text-emerald-300 shrink-0 text-[10px] font-sans font-bold active:scale-95 transition-transform"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Kopyalandı</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Kopyala</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] bg-zinc-950/60 p-2 rounded-lg border border-white/5">
                    <span className="text-zinc-400">Gönderilecek Tutar:</span>
                    <span className="font-mono font-bold text-white">
                      {cryptoType === "USDT_TRC20" ? `${calculatedUsdt} USDT` : `${calculatedTrx} TRX`} (₺{currentFinalAmount.toFixed(2)})
                    </span>
                  </div>
                </div>

                {/* Otomatik Doğrulama Kutusu */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#121622] to-[#0d0f17] border border-emerald-500/30 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                    <Sparkles className="w-4 h-4" />
                    <span>Otomatik TronScan Doğrulama</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Transferi tamamladıktan sonra aldığınız <b>TXID (İşlem Kodu / Hash)</b> kodunu buraya yapıştırıp butona dokunun, bakiyeniz saniyeler içinde yüklensin:
                  </p>

                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="İşlem Kodu (TXID) yapıştırın... (Örn: e2a94f...)"
                      value={txidInput}
                      onChange={(e) => setTxidInput(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyCrypto}
                    disabled={verifyingCrypto || !txidInput.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-bold text-xs shadow-md shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifyingCrypto ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>TronScan Ağında Doğrulanıyor...</span>
                      </>
                    ) : (
                      <>
                        <span>⚡ Ödemeyi Otomatik Doğrula & Bakiyeyi Yükle</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* METHOD 2: HAVALE / EFT */}
        {method === "Havale/EFT" && (
          <div className="mt-4 p-3.5 rounded-2xl bg-zinc-900/90 border border-white/10 text-xs text-zinc-300 space-y-2.5">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Banka:</span>
                <span className="font-semibold text-white">{bankInfo.bankName || "Banka Belirtilmedi"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Alıcı:</span>
                <span className="font-semibold text-white">{bankInfo.accountHolder || "Yetkili Alıcı"}</span>
              </div>
              <div className="flex justify-between items-center bg-black/40 p-2.5 rounded-xl font-mono text-[11px] border border-white/5">
                <span className="truncate mr-2 text-emerald-300 font-semibold">{bankInfo.iban}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(bankInfo.iban.replace(/\s+/g, ""))}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 text-emerald-400 hover:text-emerald-300 shrink-0 text-[10px] font-sans font-bold"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Kopyalandı</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Kopyala</span>
                    </>
                  )}
                </button>
              </div>
              {bankInfo.descriptionNote && (
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  💡 {bankInfo.descriptionNote}
                </p>
              )}
              <p className="text-[11px] text-amber-400 font-medium">
                Telegram ID&apos;niz: <span className="font-mono font-bold text-white bg-black/40 px-1.5 py-0.5 rounded">{telegramId}</span>
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSubmitManual}
                disabled={loading || currentFinalAmount <= 0}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-500 hover:bg-blue-400 active:scale-[0.98] text-black font-bold text-xs shadow-md shadow-blue-500/25 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span>İşleniyor...</span>
                ) : (
                  <>
                    <span>₺{currentFinalAmount.toFixed(2)} Havale Bildirimi Yap</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Bildirim / Mesaj Kutusu */}
        {message && (
          <div
            className={`mt-3 p-3 rounded-xl border text-xs font-medium leading-relaxed ${
              isErrorMsg
                ? "bg-rose-950/60 border-rose-500/40 text-rose-300"
                : "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

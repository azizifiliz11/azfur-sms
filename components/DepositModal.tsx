"use client";

import React, { useState, useEffect } from "react";
import { X, Check, Copy, Coins, ShieldCheck, Loader2, RefreshCw, Zap, Gift, Tag } from "lucide-react";
import { DirectionAwareTabs } from "@/components/ui/direction-aware-tabs";
import { haptic } from "@/lib/haptic";
import { CryptoSettings } from "@/lib/types";
import { APIRONE_PAYMENT_COINS, getApironePaymentOptionsForCoin } from "@/lib/crypto-currencies";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramId: number;
  onSuccess: (amount: number) => void;
}

export function DepositModal({ isOpen, onClose, telegramId, onSuccess }: DepositModalProps) {
  const [cryptoSubMethod, setCryptoSubMethod] = useState<"AutoCrypto" | "DirectWallet" | "Coupon">("AutoCrypto");
  const [cryptoType, setCryptoType] = useState<"USDT_TRC20" | "TRX">("USDT_TRC20");
  const [selectedAutoCoin, setSelectedAutoCoin] = useState<string>("");
  const [selectedAutoNetwork, setSelectedAutoNetwork] = useState<string>("");
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isAddressCopied, setIsAddressCopied] = useState<boolean>(false);
  const [verifyingCrypto, setVerifyingCrypto] = useState<boolean>(false);
  const [creatingPayment, setCreatingPayment] = useState<boolean>(false);
  const [couponInput, setCouponInput] = useState<string>("");
  const [redeemingCoupon, setRedeemingCoupon] = useState<boolean>(false);

  // Otomatik Kripto Ödeme Detayları
  const [activePayment, setActivePayment] = useState<{
    trackId: number | string;
    address: string;
    payAmount: string | number;
    payCurrency: string;
    network: string;
    qrCodeUrl: string;
    amountTry: number;
    amountUsd?: number;
    expiredAt?: number;
  } | null>(null);

  const [verifyingPayment, setVerifyingPayment] = useState<boolean>(false);
  const [txidInput, setTxidInput] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [isErrorMsg, setIsErrorMsg] = useState<boolean>(false);

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
            if (data.cryptoSettings) setCryptoSettings(data.cryptoSettings);
            if (data.exchangeRate) setExchangeRate(data.exchangeRate);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Otomatik ödeme açıkken periyodik durum kontrolü (her 5 saniyede bir)
  useEffect(() => {
    if (!isOpen || !activePayment) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/user/deposit/crypto-verify-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackId: activePayment.trackId,
            telegramId,
          }),
        });
        const data = await res.json();
        if (data.success && data.isPaid) {
          haptic.success();
          setIsErrorMsg(false);
          setMessage(data.message || `🎉 Tebrikler! ₺${activePayment.amountTry.toFixed(2)} bakiyeniz otomatik olarak onaylandı ve hesabınıza yüklendi!`);
          onSuccess(activePayment.amountTry);
          clearInterval(interval);
          setTimeout(() => {
            onClose();
          }, 2200);
        } else if (data.status === "underpaid") {
          setIsErrorMsg(true);
          setMessage(data.message || "⚠️ Eksik tutar gönderildi. Kabul edilebilir tolerans 10 ₺'dir.");
        }
      } catch {
        // Hata durumunda sessiz kal
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isOpen, activePayment, telegramId, onSuccess, onClose]);

  if (!isOpen) return null;

  const quickAmounts = [50, 100, 250, 500];

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    haptic.success();
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCopyAddress = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setIsAddressCopied(true);
    haptic.success();
    setTimeout(() => setIsAddressCopied(false), 2000);
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

  const quickAmountSelector = (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-muted-foreground font-medium">Yüklenecek Tutar (₺)</label>
        <span className="text-[11px] font-mono text-brand font-medium">
          ≈ ${(currentFinalAmount / (exchangeRate || 49.2)).toFixed(2)} USD
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {quickAmounts.map((q) => (
          <button
            key={q}
            onClick={() => handleSelectAmount(q)}
            className={`py-2 px-1 rounded-xl border text-sm font-mono font-semibold transition-all ${
              amount === q && !customAmount
                ? "bg-foreground text-background border-brand shadow-md "
                : "bg-card border-border text-foreground/80 hover:border-foreground/15"
            }`}
          >
            ₺{q}
          </button>
        ))}
      </div>

      <div className="mt-2.5">
        <input
          type="number"
          min={10}
          placeholder="Özel tutar girin (₺)"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          className="w-full bg-card/90 border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-brand/50"
        />
      </div>
    </div>
  );

  // 1. Kripto ile Öde (Otomatik) - Adres ve QR Kod Oluşturma
  const handleCreateAutoCrypto = async () => {
    if (!selectedAutoCoin || !selectedAutoNetwork) {
      haptic.error();
      setIsErrorMsg(true);
      setMessage("Ödeme için önce kripto para birimi ve ağı seçin.");
      return;
    }

    if (currentFinalAmount < 10) {
      haptic.error();
      setIsErrorMsg(true);
      setMessage("Minimum yükleme tutarı 10 ₺'dir.");
      return;
    }

    setCreatingPayment(true);
    setMessage(null);
    setIsErrorMsg(false);
    haptic.impact("heavy");

    try {
      const res = await fetch("/api/user/deposit/crypto-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId,
          amount: currentFinalAmount,
          payCurrency: selectedAutoCoin,
          network: selectedAutoNetwork,
        }),
      });

      const data = await res.json();
      if (data.success && data.address && data.trackId) {
        haptic.success();
        setActivePayment({
          trackId: data.trackId,
          address: data.address,
          payAmount: data.payAmount,
          payCurrency: data.payCurrency || selectedAutoCoin,
          network: data.network || selectedAutoNetwork,
          qrCodeUrl: data.qrCodeUrl,
          amountTry: data.amountTry,
          amountUsd: data.amountUsd,
          expiredAt: data.expiredAt,
        });

        setMessage("🚀 Ödeme adresi hazırlandı! Aşağıdaki QR kodu okutarak veya cüzdan adresine transfer yaparak ödemenizi tamamlayabilirsiniz.");
      } else {
        haptic.error();
        setIsErrorMsg(true);
        setMessage(data.error || "Ödeme adresi oluşturulamadı.");
      }
    } catch {
      haptic.error();
      setIsErrorMsg(true);
      setMessage("Sunucuya bağlanırken bir sorun oluştu.");
    } finally {
      setCreatingPayment(false);
    }
  };

  // Kripto Ödeme Durumunu Manuel Kontrol Et
  const handleCheckAutoPaymentStatus = async () => {
    if (!activePayment) return;
    setVerifyingPayment(true);
    haptic.impact("medium");

    try {
      const res = await fetch("/api/user/deposit/crypto-verify-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: activePayment.trackId,
          telegramId,
        }),
      });
      const data = await res.json();

      if (data.success && data.isPaid) {
        haptic.success();
        setIsErrorMsg(false);
        setMessage(data.message || `🎉 Tebrikler! ₺${activePayment.amountTry.toFixed(2)} bakiyeniz başarıyla onaylandı ve hesabınıza yüklendi!`);
        onSuccess(activePayment.amountTry);
        setTimeout(() => {
          onClose();
        }, 2200);
      } else if (data.status === "paying") {
        haptic.selection();
        setIsErrorMsg(false);
        setMessage("⚡ İşleminiz blokzincirinde tespit edildi! Ağ onayı bekleniyor, lütfen birkaç saniye bekleyiniz.");
      } else if (data.status === "underpaid") {
        haptic.error();
        setIsErrorMsg(true);
        setMessage(data.message || "⚠️ Eksik tutar gönderildi. Kabul edilebilir tolerans 10 ₺'dir.");
      } else {
        haptic.selection();
        setIsErrorMsg(false);
        setMessage(data.message || "⏳ Transfer henüz blokzincirinde tespit edilmedi. Gönderim yaptıktan sonra 1-2 dakika içinde tekrar deneyiniz.");
      }
    } catch {
      setIsErrorMsg(true);
      setMessage("Durum sorgulanamadı, lütfen az sonra tekrar deneyiniz.");
    } finally {
      setVerifyingPayment(false);
    }
  };

  // 2. Manuel TronScan TXID Doğrulama
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-background ring-1 ring-foreground/10 rounded-t-3xl sm:rounded-3xl p-5 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)] flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-brand/15 text-brand">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-1.5">
                <span>Kripto ile Bakiye Yükle</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/20 text-brand border border-brand/30">
                  Otomatik Onay
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">Anında QR Kod ve cüzdan adresi ile bakiye yükleyin</p>
            </div>
          </div>
          <button
            onClick={() => {
              haptic.impact("light");
              onClose();
            }}
            className="p-1.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* YÖNTEMLER SEÇİMİ */}
        <div className="mt-4 space-y-3">
          <DirectionAwareTabs
            value={cryptoSubMethod}
            onValueChange={(id) => {
              haptic.selection();
              setCryptoSubMethod(id);
            }}
            tabs={[
              { id: "AutoCrypto", label: <><Zap className="w-3.5 h-3.5 shrink-0" /><span className="truncate">Kripto (Oto)</span></> },
              { id: "DirectWallet", label: <><Coins className="w-3.5 h-3.5 shrink-0" /><span className="truncate">TRON Cüzdan</span></> },
              { id: "Coupon", label: <><Gift className="w-3.5 h-3.5 shrink-0" /><span className="truncate">Kupon Kodu</span></> },
            ]}
            tabClassName="px-1.5"
          />

          {cryptoSubMethod !== "AutoCrypto" && quickAmountSelector}

          {/* SEÇENEK A: KRİPTO İLE ÖDE (OTOMATİK) */}
          {cryptoSubMethod === "AutoCrypto" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-card to-card border border-brand/30 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-brand/20 text-brand">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-foreground block">Kripto ile Öde (Otomatik)</span>
                      <span className="text-[10px] text-muted-foreground block">QR kod ve cüzdan adresi ile anında otomatik onay</span>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-brand/20 text-brand font-medium border border-brand/30">
                    Önerilen
                  </span>
                </div>

                {(activePayment || (selectedAutoCoin && selectedAutoNetwork)) && (
                  <div className="flex items-center justify-between bg-foreground/5 p-2.5 rounded-xl border border-border text-xs">
                    <span className="text-muted-foreground">Ödenecek Tutar:</span>
                    <span className="font-mono font-semibold text-brand text-sm">
                      ₺{currentFinalAmount.toFixed(2)}{" "}
                      <span className="text-xs text-muted-foreground font-normal">
                        (≈ ${(currentFinalAmount / (exchangeRate || 49.2)).toFixed(2)} USD)
                      </span>
                    </span>
                  </div>
                )}

                {!activePayment && (
                  <div className="space-y-3 rounded-xl border border-border bg-foreground/5 p-3">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">
                        1. Ödeme yapılacak kripto para birimini seçin
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {APIRONE_PAYMENT_COINS.map((coin) => (
                          <button
                            key={coin}
                            type="button"
                            onClick={() => {
                              haptic.selection();
                              setSelectedAutoCoin(coin);
                              setSelectedAutoNetwork("");
                            }}
                            className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                              selectedAutoCoin === coin
                                ? "border-brand bg-brand/15 text-brand"
                                : "border-border bg-card text-foreground/80 hover:border-foreground/15"
                            }`}
                          >
                            {coin}
                          </button>
                        ))}
                      </div>
                    </div>

                    {selectedAutoCoin && (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">
                          2. Göndereceğiniz ağı seçin
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {getApironePaymentOptionsForCoin(selectedAutoCoin).map((option) => (
                            <button
                              key={option.networkKey}
                              type="button"
                              onClick={() => {
                                haptic.selection();
                                setSelectedAutoNetwork(option.networkKey);
                              }}
                              className={`rounded-lg border px-2 py-2 text-[10px] font-medium transition-colors ${
                                selectedAutoNetwork === option.networkKey
                                  ? "border-foreground/40 bg-foreground/8 text-foreground"
                                  : "border-border bg-card text-foreground/80 hover:border-foreground/15"
                              }`}
                            >
                              {option.networkLabel}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!activePayment && selectedAutoCoin && selectedAutoNetwork && quickAmountSelector}

                {!activePayment ? (
                  <button
                    type="button"
                    onClick={handleCreateAutoCrypto}
                    disabled={creatingPayment || currentFinalAmount < 10 || !selectedAutoCoin || !selectedAutoNetwork}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-foreground hover:bg-foreground/85 active:scale-[0.98] text-background font-semibold text-xs shadow-md transition-all disabled:opacity-50"
                  >
                    {creatingPayment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Adres ve QR Kod Oluşturuluyor...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>Kripto ile Öde (Otomatik)</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3 pt-2 border-t border-border">
                    {/* QR Kod Görseli */}
                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-foreground/5 border border-border space-y-2">
                      <div className="p-2 bg-white rounded-xl shadow-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activePayment.qrCodeUrl}
                          alt="Ödeme QR Kodu"
                          className="w-44 h-44 object-contain"
                        />
                      </div>
                      <div className="text-center space-y-0.5">
                        <span className="text-[11px] text-muted-foreground block">Yatırılacak Tutar:</span>
                        <span className="font-mono font-semibold text-base text-brand">
                          {activePayment.payAmount} {activePayment.payCurrency}
                        </span>
                        <span className="text-[10px] text-muted-foreground/80 block font-mono">
                          Ağ: {activePayment.network}
                        </span>
                      </div>
                    </div>

                    {/* Cüzdan Adresi Kopyalama Alanı */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground font-medium">Cüzdan Adresi (Dokun-Kopyala):</label>
                      <div className="flex items-center justify-between bg-muted p-2.5 rounded-xl border border-border text-xs font-mono">
                        <span className="truncate text-brand mr-2 select-all font-medium">
                          {activePayment.address}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyAddress(activePayment.address)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-brand hover:text-brand shrink-0 text-[11px] font-sans font-semibold transition-all active:scale-95"
                        >
                          {isAddressCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
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
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-relaxed bg-brand/10 p-2.5 rounded-xl border border-brand/20">
                      ℹ️ Herhangi bir borsadan (Binance, Paribu, vb.) veya cüzdandan bu adrese gönderim yaptığınızda, ağ onayının ardından bakiyeniz <b>otomatik yüklenecektir</b>.
                      <span className="block mt-1 text-brand font-medium">💡 Borsa çekim küsuratlarında 10 ₺'ye kadar olan küçük eksiklikler sistemimizce tolere edilir; 10 ₺ altı ödemeler kabul edilmez.</span>
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCheckAutoPaymentStatus}
                        disabled={verifyingPayment}
                        className="col-span-2 flex items-center justify-center gap-1.5 py-3 px-3 rounded-full bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs transition-all disabled:opacity-50 shadow-md "
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${verifyingPayment ? "animate-spin" : ""}`} />
                        <span>{verifyingPayment ? "Doğrulanıyor..." : "Ödemeyi Kontrol Et"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActivePayment(null);
                          setMessage(null);
                        }}
                        className="col-span-2 text-center text-[10px] text-muted-foreground/80 hover:text-foreground/80 py-1"
                      >
                        Farklı Tutarla Yeni Ödeme Başlat
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SEÇENEK B: MANUEL TRONSCAN TXID DOĞRULAMA */}
          {cryptoSubMethod === "DirectWallet" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCryptoType("USDT_TRC20")}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                    cryptoType === "USDT_TRC20"
                      ? "bg-brand/15 border-brand text-brand"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>USDT (TRC-20)</span>
                  <span className="text-[10px] font-mono font-normal text-muted-foreground">
                    ≈ {calculatedUsdt} USDT
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCryptoType("TRX")}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                    cryptoType === "TRX"
                      ? "bg-brand/15 border-brand text-brand"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>TRX (Tron)</span>
                  <span className="text-[10px] font-mono font-normal text-muted-foreground">
                    ≈ {calculatedTrx} TRX
                  </span>
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-card/90 border border-border space-y-2.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Gönderilecek Adres:</span>
                  <span className="text-[10px] text-brand font-mono">Tron (TRC-20) Ağı</span>
                </div>

                <div className="flex items-center justify-between bg-muted p-2.5 rounded-xl border border-border font-mono text-xs">
                  <span className="truncate text-foreground mr-2 select-all font-medium">
                    {activeCryptoAddress}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeCryptoAddress)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-brand hover:text-brand shrink-0 text-[11px] font-sans font-semibold transition-all active:scale-95"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
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

                <div className="space-y-1 pt-1">
                  <label className="text-[11px] text-muted-foreground">
                    İşlem Kodu (TXID / Transaction Hash):
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: 5a9e3bc..."
                    value={txidInput}
                    onChange={(e) => setTxidInput(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl px-3.5 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleVerifyCrypto}
                disabled={verifyingCrypto || !txidInput.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-foreground hover:bg-foreground/85 active:scale-[0.98] text-background font-semibold text-xs shadow-md transition-all disabled:opacity-50"
              >
                {verifyingCrypto ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>TronScan ile Doğrulanıyor...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>TronScan ile Otomatik Doğrula</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* SEÇENEK C: KUPON VE İNDİRİM KODU KULLAN */}
          {cryptoSubMethod === "Coupon" && (
            <div className="p-4 rounded-2xl bg-card/90 border border-border space-y-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-foreground/5 border border-foreground/10 text-foreground/90">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Hediye Bakiye & Promosyon Kuponu</h4>
                  <p className="text-[11px] text-muted-foreground">Kodunuzu girerek anında hesabınıza tanımlayın</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] text-muted-foreground font-medium">Kupon Kodu</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="ÖRN: HOSGELDIN, AZFUR20"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    className="flex-1 bg-muted border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold tracking-wider text-foreground uppercase placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/40"
                  />
                  <button
                    type="button"
                    disabled={redeemingCoupon || !couponInput.trim()}
                    onClick={async () => {
                      if (!couponInput.trim()) return;
                      setRedeemingCoupon(true);
                      setMessage(null);
                      setIsErrorMsg(false);
                      haptic.impact("heavy");
                      try {
                        const res = await fetch("/api/user/coupon", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            code: couponInput.trim(),
                            telegramId,
                          }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          haptic.success();
                          setIsErrorMsg(false);
                          setMessage(data.message);
                          if (data.addedBalance) {
                            onSuccess(data.addedBalance);
                          }
                          setCouponInput("");
                        } else {
                          haptic.error();
                          setIsErrorMsg(true);
                          setMessage(data.error || "Kupon uygulanamadı.");
                        }
                      } catch {
                        haptic.error();
                        setIsErrorMsg(true);
                        setMessage("Bağlantı hatası oluştu.");
                      } finally {
                        setRedeemingCoupon(false);
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-foreground hover:bg-foreground/85 active:scale-95 text-background font-semibold text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {redeemingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
                    <span>Uygula</span>
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-foreground/5 border border-border space-y-1 text-[11px] text-muted-foreground">
                <p className="flex items-center gap-1 text-foreground/80 font-medium">
                  <span>💡</span> Kupon Kullanım Bilgisi:
                </p>
                <p>• Bakiye kuponları anında hesabınıza para olarak eklenir.</p>
                <p>• İndirim kuponları sonraki numara kiralamanızda otomatik uygulanır.</p>
                <p>• Her kupon tek kullanımlıktır ve kişi bazlı tanımlanır.</p>
              </div>
            </div>
          )}

          {/* Bildirim / Mesaj Kutusu */}
          {message && (
            <div
              className={`p-3 rounded-xl text-xs font-medium border leading-relaxed ${
                isErrorMsg
                  ? "bg-rose-950/60 border-rose-500/40 text-rose-300"
                  : "bg-brand/10 border-brand/40 text-brand"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

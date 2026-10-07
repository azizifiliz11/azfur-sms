"use client";

import React, { useState, useEffect } from "react";
import { X, Check, Copy, Landmark, Coins, ArrowRight, ShieldCheck } from "lucide-react";
import { haptic } from "@/lib/haptic";
import { BankInfo } from "@/lib/types";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramId: number;
  onSuccess: (amount: number) => void;
}

export function DepositModal({ isOpen, onClose, telegramId, onSuccess }: DepositModalProps) {
  const [method, setMethod] = useState<"CryptoBot" | "Havale/EFT">("CryptoBot");
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bankInfo, setBankInfo] = useState<BankInfo>({
    bankName: "Ziraat Bankası",
    accountHolder: "AzFur SMS",
    iban: "TR00 0000 0000 0000 0000 0000 00",
    descriptionNote: "Açıklama alanına Telegram ID'nizi veya kullanıcı adınızı yazınız.",
  });

  useEffect(() => {
    if (isOpen) {
      fetch("/api/user/deposit")
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.bankInfo) {
            setBankInfo(data.bankInfo);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const quickAmounts = [50, 100, 250, 500];

  const handleCopy = (text: string) => {
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

  const handleSubmit = async () => {
    if (currentFinalAmount < 20) {
      haptic.error();
      setMessage("Minimum yükleme tutarı 20 ₺'dir.");
      return;
    }

    setLoading(true);
    setMessage(null);
    haptic.impact("medium");

    try {
      const res = await fetch("/api/user/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId,
          amount: currentFinalAmount,
          method,
          referenceCode: `DEP-${Math.floor(100000 + Math.random() * 900000)}`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        haptic.success();
        onSuccess(currentFinalAmount);
        setMessage("Talebiniz alındı! İşlem kontrol edildikten sonra bakiyeniz otomatik yüklenecektir.");
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        haptic.error();
        setMessage(data.error || "İşlem sırasında hata oluştu.");
      }
    } catch (e: any) {
      haptic.error();
      setMessage("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#11131a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Bakiye Yükle</h3>
              <p className="text-xs text-zinc-400">Güvenli ve anında hesabınıza geçer</p>
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

        {/* Method Tabs - 2 options: CryptoBot & Havale/EFT */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button
            onClick={() => {
              haptic.selection();
              setMethod("CryptoBot");
            }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-semibold transition-all ${
              method === "CryptoBot"
                ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm"
                : "bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Coins className="w-5 h-5 text-amber-400" />
            <span>CryptoBot</span>
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
          <label className="text-xs text-zinc-400 font-medium block mb-2">Tutar Seçin</label>
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
              onChange={(e) => {
                setCustomAmount(e.target.value);
              }}
              className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Method Specific Details */}
        <div className="mt-4 p-3.5 rounded-2xl bg-zinc-900/90 border border-white/10 text-xs text-zinc-300 space-y-2.5">
          {method === "CryptoBot" && (
            <div>
              <div className="font-semibold text-white flex items-center justify-between">
                <span>CryptoBot Entegrasyonu</span>
                <span className="text-[11px] text-emerald-400 font-mono">0 Komisyon</span>
              </div>
              <p className="text-zinc-400 mt-1">
                USDT (TRC-20, TON), Telegram TON veya BTC ile Telegram içinden tek dokunuşla ödeme yapabilirsiniz.
              </p>
            </div>
          )}

          {method === "Havale/EFT" && (
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
          )}
        </div>

        {message && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-medium">
            {message}
          </div>
        )}

        {/* Submit Button */}
        <div className="mt-5">
          <button
            onClick={handleSubmit}
            disabled={loading || currentFinalAmount <= 0}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span>İşleniyor...</span>
            ) : (
              <>
                <span>₺{currentFinalAmount.toFixed(2)} Yüklemeyi Bildir</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

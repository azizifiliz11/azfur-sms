"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Globe,
  Zap,
  Check,
  ChevronDown,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Country, ServiceItem, CalculatedCatalogItem } from "@/lib/types";
import { haptic } from "@/lib/haptic";
import { Card } from "./tremor/Card";
import { Badge } from "./tremor/Badge";

interface RentPanelProps {
  countries: Country[];
  services: ServiceItem[];
  catalog: CalculatedCatalogItem[];
  selectedCountry: Country | null;
  onSelectCountry: (country: Country) => void;
  onOrderSuccess: (order: any) => void;
  userBalance: number;
  telegramId: number;
  onOpenDeposit: () => void;
  isCatalogLoading?: boolean;
}

export function RentPanel({
  countries,
  catalog,
  selectedCountry,
  onSelectCountry,
  onOrderSuccess,
  userBalance,
  telegramId,
  onOpenDeposit,
  isCatalogLoading = false,
}: RentPanelProps) {
  const [selectedServiceCode, setSelectedServiceCode] = useState<string>("wa");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [countrySearch, setCountrySearch] = useState<string>("");
  const [countryModalOpen, setCountryModalOpen] = useState<boolean>(false);
  const [ordering, setOrdering] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Popüler ülkeler hızlı seçim çubukları
  const popularCountryIds = [62, 12, 16, 43, 6, 53, 50];
  const popularCountries = useMemo(() => {
    return popularCountryIds
      .map((id) => countries.find((c) => c.id === id))
      .filter((c): c is Country => Boolean(c));
  }, [countries]);

  // Filtrelenmiş ülke listesi
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries;
    const q = countrySearch.toLowerCase();
    return countries.filter(
      (c) => c.eng.toLowerCase().includes(q) || (c.rus && c.rus.toLowerCase().includes(q))
    );
  }, [countries, countrySearch]);

  // Filtrelenmiş servis kataloğu
  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const matchSearch =
        item.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.serviceCode.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [catalog, searchQuery]);

  // Seçili servis kalemi: Sadece seçili servise odaklan, asla rastgele ilk servise atlama!
  const selectedItem = useMemo(() => {
    if (!selectedServiceCode) return catalog[0] || null;
    const match = catalog.find((item) => item.serviceCode === selectedServiceCode);
    return match || null;
  }, [catalog, selectedServiceCode]);

  const handleCountryPick = (c: Country) => {
    haptic.selection();
    onSelectCountry(c);
    setCountryModalOpen(false);
    setErrorMsg(null);
  };

  const handleServicePick = (code: string) => {
    haptic.selection();
    setSelectedServiceCode(code);
    setErrorMsg(null);
  };

  const handlePurchase = async () => {
    if (!selectedItem || !selectedCountry) return;

    if (selectedItem.stock === 0) {
      haptic.error();
      setErrorMsg("Bu servisin bu ülkede şu an uygun numarası bulunmuyor. Lütfen başka bir ülke seçin.");
      return;
    }

    if (userBalance < selectedItem.calculatedPriceTry) {
      haptic.error();
      setErrorMsg(
        `Yetersiz Bakiye! Bu numara ₺${selectedItem.calculatedPriceTry.toFixed(
          2
        )} tutarındadır. Mevcut bakiyeniz ₺${userBalance.toFixed(2)}.`
      );
      return;
    }

    setOrdering(true);
    setErrorMsg(null);
    haptic.impact("heavy");

    try {
      const res = await fetch("/api/sms/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceCode: selectedItem.serviceCode,
          countryId: selectedCountry.id,
          telegramId,
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        haptic.success();
        onOrderSuccess(data.order);
      } else {
        haptic.error();
        setErrorMsg(data.error || "Numara alınamadı.");
      }
    } catch (e: any) {
      haptic.error();
      setErrorMsg("Bağlantı hatası oluştu, lütfen tekrar deneyin.");
    } finally {
      setOrdering(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Ülke Seçimi Kartı */}
      <Card className="p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Ülke Seçimi
            </span>
          </div>

          <button
            onClick={() => {
              haptic.impact("light");
              setCountryModalOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            <span>Tüm Ülkeler ({countries.length})</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hızlı Seçim Ülke Çubukları */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {popularCountries.map((c) => {
            const isSelected = selectedCountry?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => handleCountryPick(c)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                  isSelected
                    ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                    : "bg-zinc-900 border border-white/5 text-zinc-300 hover:border-white/20"
                }`}
              >
                <span className="text-sm">{c.flag || "🌐"}</span>
                <span>{c.eng}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 2. Servis Seçici Kartı */}
      <Card className="p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Servis & Platform
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
            {isCatalogLoading && (
              <span className="flex items-center gap-1 text-emerald-400 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" /> Güncelleniyor...
              </span>
            )}
            <span>{filteredCatalog.length} servis aktif</span>
          </div>
        </div>

        {/* Arama Çubuğu */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="WhatsApp, Telegram, OpenAI ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/90 border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Servis Listesi */}
        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
          {filteredCatalog.slice(0, 24).map((item) => {
            const isSelected = selectedServiceCode === item.serviceCode;
            return (
              <div
                key={item.serviceCode}
                onClick={() => handleServicePick(item.serviceCode)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? "bg-emerald-500/15 border-emerald-500/60 shadow-sm ring-1 ring-emerald-500/30"
                    : "bg-zinc-900/70 border-white/5 hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="font-semibold text-xs text-white truncate">
                    {item.serviceName}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </div>

                <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/[0.04]">
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {item.stock <= 0
                      ? "Tükendi"
                      : item.stock < 1000
                      ? `${item.stock} adet`
                      : `${item.stock.toLocaleString("tr-TR")} adet`}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    ₺{item.calculatedPriceTry.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 3. Seçim Özeti ve Satın Alma Kartı */}
      {selectedCountry && (
        <Card className="p-4 bg-gradient-to-b from-[#131622] to-[#0c0e15] border-emerald-500/30 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-2xl shrink-0">{selectedCountry.flag || "🌐"}</span>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
                  <span>{selectedItem?.serviceName || selectedServiceCode.toUpperCase()}</span>
                  {selectedItem && (
                    <Badge size="sm" color={selectedItem.stock > 0 ? "emerald" : "rose"} hasPing={selectedItem.stock > 0}>
                      {selectedItem.stock > 0 ? `${selectedItem.stock.toLocaleString()} Stok` : "Stok Tükendi"}
                    </Badge>
                  )}
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5 truncate">
                  {selectedCountry.eng} • 15 Dakika Kullanım
                </p>
              </div>
            </div>

            {/* Fiyat Alanı */}
            <div className="text-right shrink-0">
              {isCatalogLoading ? (
                <div className="flex items-center gap-1 text-xs text-emerald-400 font-mono animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Hesaplanıyor...</span>
                </div>
              ) : selectedItem ? (
                <>
                  <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
                    ₺{selectedItem.calculatedPriceTry.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-zinc-500 block">Net Ücret</span>
                </>
              ) : (
                <span className="text-xs text-rose-400 font-semibold">Stok Yok</span>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMsg}</span>
                {selectedItem && userBalance < selectedItem.calculatedPriceTry && (
                  <button
                    onClick={onOpenDeposit}
                    className="block mt-1.5 font-bold underline text-rose-200"
                  >
                    Hemen Bakiye Yükle ➔
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Satın Al Butonu */}
          <button
            onClick={handlePurchase}
            disabled={ordering || isCatalogLoading || !selectedItem || selectedItem.stock === 0}
            className="w-full mt-3.5 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ordering ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                Numara Tahsis Ediliyor...
              </span>
            ) : isCatalogLoading ? (
              <span>Fiyatlar Yükleniyor...</span>
            ) : !selectedItem || selectedItem.stock === 0 ? (
              <span>Bu Ülkede Stok Bulunmuyor</span>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-black" />
                <span>Numara Satın Al (₺{selectedItem.calculatedPriceTry.toFixed(2)})</span>
              </>
            )}
          </button>
        </Card>
      )}

      {/* Ülke Seçim Modalı */}
      {countryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#11131a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Ülke Seçin</h3>
              </div>
              <button
                onClick={() => setCountryModalOpen(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Kapat
              </button>
            </div>

            <div className="relative my-3">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ülke adı ara..."
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div className="overflow-y-auto space-y-1 pr-1 flex-1">
              {filteredCountries.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleCountryPick(c)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                    selectedCountry?.id === c.id
                      ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-300"
                      : "hover:bg-zinc-800 text-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{c.flag || "🌐"}</span>
                    <span className="text-xs font-semibold">{c.eng}</span>
                  </div>
                  {selectedCountry?.id === c.id && <Check className="w-4 h-4 text-emerald-400" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

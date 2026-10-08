"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Globe,
  Zap,
  Check,
  ChevronDown,
  AlertCircle,
  Loader2,
  Star,
  TrendingDown,
  TrendingUp,
  Package,
  Sparkles,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
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
  activeDiscount?: { code: string; type: 'DISCOUNT_PERCENT' | 'DISCOUNT_FIXED'; value: number } | null;
}

type SortMode = "popular" | "price_asc" | "price_desc" | "stock" | "quality";

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
  activeDiscount = null,
}: RentPanelProps) {
  const [selectedServiceCode, setSelectedServiceCode] = useState<string>("wa");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [countrySearch, setCountrySearch] = useState<string>("");
  const [countryModalOpen, setCountryModalOpen] = useState<boolean>(false);
  const [countryModalTab, setCountryModalTab] = useState<"all" | "favorites">("all");
  const [ordering, setOrdering] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sıralama ve Filtre Durumları (Anlık 0ms tepki)
  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [filterFavoritesOnly, setFilterFavoritesOnly] = useState<boolean>(false);
  const [filterInStockOnly, setFilterInStockOnly] = useState<boolean>(false);

  // Favoriler (LocalStorage kalıcı hafıza)
  const [favoriteServices, setFavoriteServices] = useState<string[]>([]);
  const [favoriteCountries, setFavoriteCountries] = useState<number[]>([]);

  // LocalStorage'dan favorileri yükle
  useEffect(() => {
    try {
      const savedServ = localStorage.getItem("azfur_fav_services");
      if (savedServ) {
        setFavoriteServices(JSON.parse(savedServ));
      }
      const savedCountr = localStorage.getItem("azfur_fav_countries");
      if (savedCountr) {
        setFavoriteCountries(JSON.parse(savedCountr));
      }
    } catch (e) {
      console.error("Favoriler yüklenirken hata:", e);
    }
  }, []);

  // Servis favori toggle
  const toggleFavoriteService = (code: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    haptic.impact("medium");
    setFavoriteServices((prev) => {
      const exists = prev.includes(code);
      const next = exists ? prev.filter((c) => c !== code) : [...prev, code];
      try {
        localStorage.setItem("azfur_fav_services", JSON.stringify(next));
      } catch (err) {}
      return next;
    });
  };

  // Ülke favori toggle
  const toggleFavoriteCountry = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    haptic.impact("medium");
    setFavoriteCountries((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((i) => i !== id) : [...prev, id];
      try {
        localStorage.setItem("azfur_fav_countries", JSON.stringify(next));
      } catch (err) {}
      return next;
    });
  };

  // Popüler ve Favori ülkeler hızlı seçim çubuğu (Favoriler başta!)
  const defaultPopularIds = [62, 12, 16, 43, 6, 53, 50];
  const quickBarCountries = useMemo(() => {
    const list: { country: Country; isFav: boolean }[] = [];
    const addedIds = new Set<number>();

    // 1. Önce kullanıcının favorilediği ülkeler
    for (const favId of favoriteCountries) {
      const c = countries.find((item) => item.id === favId);
      if (c && !addedIds.has(c.id)) {
        list.push({ country: c, isFav: true });
        addedIds.add(c.id);
      }
    }

    // 2. Ardından popüler ülkeler
    for (const popId of defaultPopularIds) {
      if (!addedIds.has(popId)) {
        const c = countries.find((item) => item.id === popId);
        if (c) {
          list.push({ country: c, isFav: false });
          addedIds.add(c.id);
        }
      }
    }

    return list;
  }, [countries, favoriteCountries]);

  // Filtrelenmiş ülke listesi (Modal için)
  const filteredCountries = useMemo(() => {
    let list = countries;
    if (countryModalTab === "favorites") {
      list = list.filter((c) => favoriteCountries.includes(c.id));
    }
    if (!countrySearch.trim()) return list;
    const q = countrySearch.toLowerCase();
    return list.filter(
      (c) => c.eng.toLowerCase().includes(q) || (c.rus && c.rus.toLowerCase().includes(q))
    );
  }, [countries, countrySearch, countryModalTab, favoriteCountries]);

  // Kalite Skoru Hesaplayıcı (%65 - %99)
  const getItemQuality = (item: CalculatedCatalogItem): number => {
    if (item.qualityScore) return item.qualityScore;
    let score = 85;
    if (item.stock > 10000) score = 98;
    else if (item.stock > 2500) score = 96;
    else if (item.stock > 500) score = 93;
    else if (item.stock > 50) score = 89;
    else if (item.stock > 0) score = 85;
    else score = 60;
    if (item.physicalStock && item.physicalStock > 0 && item.stock > 0) {
      score = Math.min(99, score + 2);
    }
    return score;
  };

  // Filtrelenmiş & Anlık Sıralanmış Servis Kataloğu
  const filteredCatalog = useMemo(() => {
    let list = catalog.filter((item) => {
      // Metin araması
      const matchSearch =
        item.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.serviceCode.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      // Favoriler Filtresi
      if (filterFavoritesOnly && !favoriteServices.includes(item.serviceCode)) {
        return false;
      }

      // Stokta Olanlar Filtresi
      if (filterInStockOnly && item.stock <= 0) {
        return false;
      }

      return true;
    });

    // Anlık Sıralama Algoritması
    return [...list].sort((a, b) => {
      if (sortMode === "price_asc") {
        // En Ucuz: Düşük fiyattan yükseğe (stokta olanlar öncelikli)
        if (a.stock > 0 && b.stock === 0) return -1;
        if (a.stock === 0 && b.stock > 0) return 1;
        return a.calculatedPriceTry - b.calculatedPriceTry;
      }

      if (sortMode === "price_desc") {
        // En Pahalı: Yüksek fiyattan düşüğe
        if (a.stock > 0 && b.stock === 0) return -1;
        if (a.stock === 0 && b.stock > 0) return 1;
        return b.calculatedPriceTry - a.calculatedPriceTry;
      }

      if (sortMode === "stock") {
        // Stoğa göre: En çok stoktan aza
        return b.stock - a.stock;
      }

      if (sortMode === "quality") {
        // Kaliteye göre: Yüksek kaliteli başarı puanından aza
        const qA = getItemQuality(a);
        const qB = getItemQuality(b);
        if (qB !== qA) return qB - qA;
        return b.stock - a.stock;
      }

      // Varsayılan: Popülerliğe Göre (Stokta olanlar başta, yüksek stok hacmi)
      if (a.stock > 0 && b.stock === 0) return -1;
      if (a.stock === 0 && b.stock > 0) return 1;
      return b.stock - a.stock;
    });
  }, [
    catalog,
    searchQuery,
    filterFavoritesOnly,
    filterInStockOnly,
    sortMode,
    favoriteServices,
  ]);

  // Seçili servis kalemi: Sadece seçili servise odaklan
  const selectedItem = useMemo(() => {
    if (!selectedServiceCode) return filteredCatalog[0] || catalog[0] || null;
    const match = catalog.find((item) => item.serviceCode === selectedServiceCode);
    return match || filteredCatalog[0] || null;
  }, [catalog, selectedServiceCode, filteredCatalog]);

  const finalPriceWithDiscount = useMemo(() => {
    if (!selectedItem) return 0;
    if (!activeDiscount) return selectedItem.calculatedPriceTry;
    if (activeDiscount.type === "DISCOUNT_PERCENT") {
      return Math.max(1.0, Number((selectedItem.calculatedPriceTry * (1 - activeDiscount.value / 100)).toFixed(2)));
    }
    return Math.max(1.0, Number((selectedItem.calculatedPriceTry - activeDiscount.value).toFixed(2)));
  }, [selectedItem, activeDiscount]);

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

        {/* Hızlı Seçim Ülke Çubukları (Favoriler Öncelikli) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {quickBarCountries.map(({ country: c, isFav }) => {
            const isSelected = selectedCountry?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => handleCountryPick(c)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                  isSelected
                    ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                    : isFav
                    ? "bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:border-amber-400/50"
                    : "bg-zinc-900 border border-white/5 text-zinc-300 hover:border-white/20"
                }`}
              >
                <span className="text-sm">{c.flag || "🌐"}</span>
                <span>{c.eng}</span>
                {isFav && (
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
                )}
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
            className="w-full bg-zinc-900/90 border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Anlık Sıralama Filtreleri (Scrollable Pills) */}
        <div className="space-y-2 pt-1 border-t border-white/[0.05]">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="flex items-center gap-1 text-zinc-400 font-medium">
              <SlidersHorizontal className="w-3 h-3 text-emerald-400" />
              <span>Anlık Sıralama:</span>
            </span>
            <span className="text-[10px] text-emerald-400/80 font-mono">0ms Real-Time</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {/* Popüler */}
            <button
              onClick={() => {
                haptic.selection();
                setSortMode("popular");
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-all ${
                sortMode === "popular"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/10"
                  : "bg-zinc-900 text-zinc-400 border border-white/5 hover:border-white/15"
              }`}
            >
              <Flame className="w-3 h-3 text-amber-400" />
              <span>Popüler</span>
            </button>

            {/* Daha Ucuz (Fiyat Artan) */}
            <button
              onClick={() => {
                haptic.selection();
                setSortMode("price_asc");
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-all ${
                sortMode === "price_asc"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm shadow-emerald-500/10"
                  : "bg-zinc-900 text-zinc-400 border border-white/5 hover:border-white/15"
              }`}
            >
              <TrendingDown className="w-3 h-3 text-emerald-400" />
              <span>En Ucuz</span>
            </button>

            {/* Daha Pahalı (Fiyat Azalan) */}
            <button
              onClick={() => {
                haptic.selection();
                setSortMode("price_desc");
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-all ${
                sortMode === "price_desc"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm shadow-purple-500/10"
                  : "bg-zinc-900 text-zinc-400 border border-white/5 hover:border-white/15"
              }`}
            >
              <TrendingUp className="w-3 h-3 text-purple-400" />
              <span>En Pahalı</span>
            </button>

            {/* Stoğa Göre */}
            <button
              onClick={() => {
                haptic.selection();
                setSortMode("stock");
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-all ${
                sortMode === "stock"
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/50 shadow-sm shadow-blue-500/10"
                  : "bg-zinc-900 text-zinc-400 border border-white/5 hover:border-white/15"
              }`}
            >
              <Package className="w-3 h-3 text-blue-400" />
              <span>Çok Stok</span>
            </button>

            {/* Kaliteye Göre */}
            <button
              onClick={() => {
                haptic.selection();
                setSortMode("quality");
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-all ${
                sortMode === "quality"
                  ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 shadow-sm shadow-yellow-500/10"
                  : "bg-zinc-900 text-zinc-400 border border-white/5 hover:border-white/15"
              }`}
            >
              <Sparkles className="w-3 h-3 text-yellow-400" />
              <span>Yüksek Kalite</span>
            </button>
          </div>

          {/* Hızlı Filtre Toggle Butonları (Favorilerim & Sadece Stoktakiler) */}
          <div className="flex items-center gap-2 pt-1">
            {/* Favorilerim Filtresi */}
            <button
              onClick={() => {
                haptic.selection();
                setFilterFavoritesOnly(!filterFavoritesOnly);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all ${
                filterFavoritesOnly
                  ? "bg-amber-500/25 border border-amber-500/60 text-amber-200 shadow-sm shadow-amber-500/20"
                  : "bg-zinc-900/80 border border-white/10 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  filterFavoritesOnly ? "fill-amber-400 text-amber-400" : "text-zinc-400"
                }`}
              />
              <span>Favorilerim</span>
              {favoriteServices.length > 0 && (
                <span className="text-[10px] bg-amber-500/30 text-amber-300 font-bold px-1.5 py-0.2 rounded-full">
                  {favoriteServices.length}
                </span>
              )}
            </button>

            {/* Yalnızca Stoktakiler */}
            <button
              onClick={() => {
                haptic.selection();
                setFilterInStockOnly(!filterInStockOnly);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all ${
                filterInStockOnly
                  ? "bg-emerald-500/20 border border-emerald-500/60 text-emerald-300 shadow-sm shadow-emerald-500/20"
                  : "bg-zinc-900/80 border border-white/10 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  filterInStockOnly ? "text-emerald-400" : "text-zinc-400"
                }`}
              />
              <span>Yalnızca Stokta</span>
            </button>
          </div>
        </div>

        {/* Servis Listesi Grid */}
        {filteredCatalog.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-zinc-900/50 border border-white/5 space-y-2">
            <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Star className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium text-zinc-300">
              {filterFavoritesOnly
                ? "Henüz favori servis eklemediniz."
                : "Arama kriterine uygun servis bulunamadı."}
            </p>
            <p className="text-[11px] text-zinc-500">
              {filterFavoritesOnly
                ? "Servislerin sağ üst köşesindeki yıldız (⭐) butonuna basarak favorilerinize ekleyebilirsiniz."
                : "Filtreleri veya arama kelimesini değiştirmeyi deneyin."}
            </p>
            {filterFavoritesOnly && (
              <button
                onClick={() => setFilterFavoritesOnly(false)}
                className="mt-2 text-xs text-amber-400 font-semibold underline"
              >
                Tüm Servisleri Göster
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {filteredCatalog.slice(0, 30).map((item) => {
              const isSelected = selectedServiceCode === item.serviceCode;
              const isFav = favoriteServices.includes(item.serviceCode);
              const quality = getItemQuality(item);

              return (
                <div
                  key={item.serviceCode}
                  onClick={() => handleServicePick(item.serviceCode)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between relative group ${
                    isSelected
                      ? "bg-emerald-500/15 border-emerald-500/60 shadow-sm ring-1 ring-emerald-500/30"
                      : "bg-zinc-900/70 border-white/5 hover:border-white/20"
                  }`}
                >
                  {/* Başlık & Favori Yıldız Butonu */}
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-semibold text-xs text-white truncate max-w-[80%]">
                      {item.serviceName}
                    </span>
                    <button
                      onClick={(e) => toggleFavoriteService(item.serviceCode, e)}
                      title={isFav ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                      className="p-0.5 rounded-md text-zinc-500 hover:text-amber-400 transition-colors shrink-0"
                    >
                      <Star
                        className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                          isFav
                            ? "fill-amber-400 text-amber-400"
                            : "text-zinc-600 hover:text-amber-400/80"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Kalite & Stok Rozetleri */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {item.stock <= 0
                        ? "Tükendi"
                        : item.stock < 1000
                        ? `${item.stock} stok`
                        : `${item.stock.toLocaleString("tr-TR")} stok`}
                    </span>
                    {item.stock > 0 && (
                      <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-mono">
                        %{quality} Kalite
                      </span>
                    )}
                  </div>

                  {/* Fiyat ve Seçili İkonu */}
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/[0.04]">
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      ₺{item.calculatedPriceTry.toFixed(2)}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                  {selectedCountry.eng} • 15 Dakika Kullanım • %{selectedItem ? getItemQuality(selectedItem) : 95} Kalite
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
                  {activeDiscount ? (
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1.5">
                        <span className="line-through text-zinc-500 text-xs font-mono">
                          ₺{selectedItem.calculatedPriceTry.toFixed(2)}
                        </span>
                        <span className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
                          ₺{finalPriceWithDiscount.toFixed(2)}
                        </span>
                      </div>
                      <span className="text-[10px] text-purple-400 font-semibold flex items-center gap-0.5">
                        <span>🎟️</span>
                        <span>{activeDiscount.code} ({activeDiscount.type === "DISCOUNT_PERCENT" ? `%${activeDiscount.value}` : `₺${activeDiscount.value}`} İndirim)</span>
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
                        ₺{selectedItem.calculatedPriceTry.toFixed(2)}
                      </div>
                      <span className="text-[10px] text-zinc-500 block">Net Ücret</span>
                    </>
                  )}
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

      {/* 4. Ülke Seçim Modalı (Favori Ülke Yönetimi Destekli) */}
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

            {/* Modal Sekmeleri: Tüm Ülkeler vs Favori Ülkelerim */}
            <div className="flex items-center gap-2 mt-3 p-1 bg-zinc-900 rounded-xl border border-white/5">
              <button
                onClick={() => setCountryModalTab("all")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  countryModalTab === "all"
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Tüm Ülkeler ({countries.length})
              </button>
              <button
                onClick={() => setCountryModalTab("favorites")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all ${
                  countryModalTab === "favorites"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Star
                  className={`w-3 h-3 ${
                    countryModalTab === "favorites" ? "fill-amber-400 text-amber-400" : ""
                  }`}
                />
                <span>Favorilerim ({favoriteCountries.length})</span>
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
              {filteredCountries.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400 space-y-2">
                  <Star className="w-6 h-6 mx-auto text-amber-400/50" />
                  <p>
                    {countryModalTab === "favorites"
                      ? "Henüz favori ülke eklemediniz."
                      : "Eşleşen ülke bulunamadı."}
                  </p>
                  {countryModalTab === "favorites" && (
                    <button
                      onClick={() => setCountryModalTab("all")}
                      className="text-amber-400 font-semibold underline text-xs"
                    >
                      Tüm Ülkelere Dön
                    </button>
                  )}
                </div>
              ) : (
                filteredCountries.map((c) => {
                  const isFav = favoriteCountries.includes(c.id);
                  const isSelected = selectedCountry?.id === c.id;

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleCountryPick(c)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-300"
                          : "hover:bg-zinc-800 text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{c.flag || "🌐"}</span>
                        <span className="text-xs font-semibold">{c.eng}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Favori Yıldız Butonu */}
                        <button
                          onClick={(e) => toggleFavoriteCountry(c.id, e)}
                          title={isFav ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                          className="p-1 rounded-md text-zinc-500 hover:text-amber-400 transition-colors"
                        >
                          <Star
                            className={`w-4 h-4 transition-transform active:scale-125 ${
                              isFav
                                ? "fill-amber-400 text-amber-400"
                                : "text-zinc-600 hover:text-amber-400"
                            }`}
                          />
                        </button>
                        {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

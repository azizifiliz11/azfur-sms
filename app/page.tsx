"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { useTelegram } from "@/hooks/useTelegram";
import { Header } from "@/components/Header";
import { RentPanel } from "@/components/RentPanel";
import { ActiveNumbers } from "@/components/ActiveNumbers";
import { DepositModal } from "@/components/DepositModal";
import { SupportModal } from "@/components/SupportModal";
import { CouponModal } from "@/components/CouponModal";
import { AdminView } from "@/components/AdminView";
import { Country, ServiceItem, CalculatedCatalogItem, ActivationOrder } from "@/lib/types";
import { Shield, Zap, Headphones, Gift, Ticket } from "lucide-react";

function HomeContent() {
  const { isReady, user: tgUser } = useTelegram();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [catalog, setCatalog] = useState<CalculatedCatalogItem[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [activeOrders, setActiveOrders] = useState<ActivationOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(false);
  const [depositModalOpen, setDepositModalOpen] = useState<boolean>(false);
  const [couponModalOpen, setCouponModalOpen] = useState<boolean>(false);
  const [supportModalOpen, setSupportModalOpen] = useState<boolean>(false);
  const [adminViewActive, setAdminViewActive] = useState<boolean>(false);

  const activeCountryIdRef = React.useRef<number>(62);
  const catalogCacheRef = React.useRef<Record<number, CalculatedCatalogItem[]>>({});
  const hasInitialized = React.useRef<boolean>(false);

  // 1. Kullanıcıyı getir veya kaydet
  const initUser = useCallback(async () => {
    if (!tgUser) return;
    try {
      const res = await fetch("/api/user/me", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: tgUser.id,
          username: tgUser.username ? tgUser.username.replace(/^@/, "").trim() : "",
          firstName: tgUser.first_name ? tgUser.first_name.trim() : "",
          lastName: tgUser.last_name ? tgUser.last_name.trim() : "",
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
      }
    } catch (e) {
      console.error("User init error:", e);
    }
  }, [tgUser]);

  // Bakiye ve kullanıcı verilerini periyodik olarak canlı senkronize et (0 gecikme)
  useEffect(() => {
    if (!tgUser) return;

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetch(`/api/user/me?telegramId=${tgUser.id}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((data) => {
            if (data.success && data.user) {
              setCurrentUser((prev: any) => {
                if (!prev || prev.balance !== data.user.balance || prev.spent !== data.user.spent) {
                  return { ...prev, ...data.user };
                }
                return prev;
              });
            }
          })
          .catch(() => {});
      }
    }, 3000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        initUser();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [tgUser, initUser]);

  // 2. Canlı Katalog ve Fiyatları Getir (Kesintisiz & Yarış Durumu Korumalı)
  const fetchCatalog = useCallback(async (countryId: number = 62) => {
    activeCountryIdRef.current = countryId;

    // Önbellekte varsa anında göster, ekran asla eski fiyata zıplamasın
    if (catalogCacheRef.current[countryId]) {
      setCatalog(catalogCacheRef.current[countryId]);
    } else {
      setCatalogLoading(true);
    }

    try {
      const res = await fetch(`/api/sms/catalog?country=${countryId}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success && activeCountryIdRef.current === countryId) {
        if (data.countries && data.countries.length > 0) {
          setCountries(data.countries);
          setSelectedCountry((prev) => {
            if (!prev) {
              return data.countries.find((c: Country) => c.id === countryId) || data.countries[0];
            }
            return prev;
          });
        }
        if (data.services && data.services.length > 0) {
          setServices(data.services);
        }
        if (data.catalog) {
          catalogCacheRef.current[countryId] = data.catalog;
          setCatalog(data.catalog);
        }
      }
    } catch (e) {
      console.error("Fetch catalog error:", e);
    } finally {
      if (activeCountryIdRef.current === countryId) {
        setCatalogLoading(false);
      }
    }
  }, []);

  // 3. Aktif Siparişleri Getir
  const fetchActiveOrders = useCallback(async () => {
    if (!tgUser) return;
    try {
      const res = await fetch(`/api/sms/active?telegramId=${tgUser.id}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setActiveOrders(data.orders || []);
      }
    } catch (e) {
      console.error("Fetch active orders error:", e);
    }
  }, [tgUser]);

  // Sayfa yüklendiğinde verileri SADECE bir kez çek
  useEffect(() => {
    if (isReady && tgUser && !hasInitialized.current) {
      hasInitialized.current = true;
      setLoading(true);
      Promise.all([initUser(), fetchCatalog(62), fetchActiveOrders()]).finally(() => {
        setLoading(false);
      });
    }
  }, [isReady, tgUser, initUser, fetchCatalog, fetchActiveOrders]);

  const handleSelectCountry = (country: Country) => {
    setSelectedCountry(country);
    fetchCatalog(country.id);
  };

  const handleOrderSuccess = (newOrder: ActivationOrder) => {
    setActiveOrders((prev) => [newOrder, ...prev]);
    initUser();
  };

  const handleRefreshAll = () => {
    initUser();
    fetchActiveOrders();
    if (selectedCountry) {
      fetchCatalog(selectedCountry.id);
    } else {
      fetchCatalog(62);
    }
  };

  if (isReady && !tgUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#090a0f] text-center">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-xl">
          <Zap className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">AzFur SMS Onay Platformu</h1>
        <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
          Bu uygulama bir <b>Telegram Mini App (TMA)</b> servisidir. Güvenliğiniz ve işlemlerinizin anında gerçekleşmesi için lütfen Telegram botumuz üzerinden başlatınız.
        </p>
      </div>
    );
  }

  if (!isReady || (loading && !currentUser)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#090a0f]">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
          <Zap className="w-6 h-6 text-emerald-400 absolute" />
        </div>
        <p className="mt-4 text-xs font-semibold text-zinc-400 animate-pulse">
          AzFur Altyapısı Başlatılıyor...
        </p>
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="min-h-screen flex flex-col bg-[#090a0f] text-zinc-100">
      {/* Top Header */}
      <Header
        user={currentUser}
        onOpenDeposit={() => setDepositModalOpen(true)}
        onOpenCoupon={() => setCouponModalOpen(true)}
        onOpenSupport={() => setSupportModalOpen(true)}
        onRefreshBalance={handleRefreshAll}
        isAdmin={isAdmin}
        onToggleAdminView={() => setAdminViewActive(!adminViewActive)}
        adminViewActive={adminViewActive}
      />

      <main className="flex-1 w-full max-w-md mx-auto p-4 space-y-5">
        {adminViewActive ? (
          <AdminView onBackToApp={() => setAdminViewActive(false)} />
        ) : (
          <>
            {/* Canlı Sistem & Güvenlik Banner'ı */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-blue-950/40 border border-emerald-500/20 p-3.5 shadow-lg shadow-emerald-950/20">
              <div className="absolute -top-10 -right-10 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-xs font-bold text-white tracking-wide">
                    AzFur Canlı SMS Altyapısı
                  </span>
                </div>
                <button
                  onClick={() => setSupportModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all"
                >
                  <Headphones className="w-3 h-3" />
                  <span>Destek & Ticket</span>
                </button>
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-1.5 pt-2 border-t border-white/[0.06] text-center">
                <div className="p-1 rounded-lg bg-black/30">
                  <span className="text-[10px] text-zinc-400 block font-medium">Teslimat</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">5 - 30 Sn</span>
                </div>
                <div className="p-1 rounded-lg bg-black/30">
                  <span className="text-[10px] text-zinc-400 block font-medium">Garanti</span>
                  <span className="text-xs font-bold text-blue-400">%100 İade</span>
                </div>
                <div className="p-1 rounded-lg bg-black/30">
                  <span className="text-[10px] text-zinc-400 block font-medium">Destek</span>
                  <span className="text-xs font-bold text-purple-400">7/24 Aktif</span>
                </div>
              </div>
            </div>

            {/* Kupon & Promosyon Kodu Kullanma Kartı */}
            <div
              onClick={() => setCouponModalOpen(true)}
              className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex items-center justify-between gap-3 cursor-pointer hover:border-amber-500/50 active:scale-[0.99] transition-all shadow-md group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-transform">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">🎁 Kupon Kodu Kullan</span>
                    {currentUser?.activeDiscount && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                        {currentUser.activeDiscount.code} (Aktif)
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    Bakiye hediyesi veya SMS indirim kodu tanımlayın
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 group-hover:bg-amber-500 text-amber-300 group-hover:text-black font-bold text-xs transition-all shrink-0"
              >
                Kupon Gir
              </button>
            </div>

            {/* Aktif Numaralar (Varsa en üstte göster) */}
            {activeOrders.length > 0 && (
              <ActiveNumbers
                orders={activeOrders}
                onOrderUpdated={handleRefreshAll}
                telegramId={tgUser?.id || currentUser?.telegramId || 0}
              />
            )}

            {/* Numara Kiralama Paneli */}
            <RentPanel
              countries={countries}
              services={services}
              catalog={catalog}
              selectedCountry={selectedCountry}
              onSelectCountry={handleSelectCountry}
              onOrderSuccess={handleOrderSuccess}
              userBalance={currentUser?.balance || 0}
              telegramId={tgUser?.id || currentUser?.telegramId || 0}
              onOpenDeposit={() => setDepositModalOpen(true)}
              isCatalogLoading={catalogLoading}
              activeDiscount={currentUser?.activeDiscount}
            />

            {/* Alt Bilgi & Canlı Destek Butonu */}
            <div className="pt-4 border-t border-white/[0.06] text-center space-y-2 text-zinc-500 text-[11px]">
              <div className="flex items-center justify-center gap-3">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>%100 İade Garantili</span>
                </div>
                <span className="text-zinc-600">•</span>
                <button
                  onClick={() => setSupportModalOpen(true)}
                  className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-semibold active:scale-95 transition-all"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Destek & Ticket Aç</span>
                </button>
              </div>
              <p>
                SMS onay kodunuz gelmediği takdirde tek tıkla iptal edip bakiyenizi anında iade alabilirsiniz.
              </p>
            </div>
          </>
        )}
      </main>

      {/* Bakiye Yükleme Modalı */}
      <DepositModal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        telegramId={tgUser?.id || currentUser?.telegramId || 0}
        onSuccess={() => initUser()}
      />

      {/* Kupon & Promosyon Modalı */}
      <CouponModal
        isOpen={couponModalOpen}
        onClose={() => setCouponModalOpen(false)}
        telegramId={tgUser?.id || currentUser?.telegramId || 0}
        onSuccess={handleRefreshAll}
        activeDiscount={currentUser?.activeDiscount}
      />

      {/* Destek & Ticket Modalı */}
      <SupportModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        telegramId={tgUser?.id || currentUser?.telegramId || 0}
        userFirstName={
          tgUser?.first_name ||
          (currentUser?.firstName && currentUser.firstName !== "Kullanıcı" && currentUser.firstName !== "Misafir"
            ? currentUser.firstName
            : "Kullanıcı")
        }
        username={
          tgUser?.username ||
          (currentUser?.username && !currentUser.username.startsWith("user_") ? currentUser.username : "")
        }
      />
    </div>
  );
}

export default function Home() {
  return (
    <ClientOnly>
      <HomeContent />
    </ClientOnly>
  );
}

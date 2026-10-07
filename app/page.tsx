"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { useTelegram } from "@/hooks/useTelegram";
import { Header } from "@/components/Header";
import { RentPanel } from "@/components/RentPanel";
import { ActiveNumbers } from "@/components/ActiveNumbers";
import { DepositModal } from "@/components/DepositModal";
import { AdminView } from "@/components/AdminView";
import { Country, ServiceItem, CalculatedCatalogItem, ActivationOrder } from "@/lib/types";
import { Shield, Zap } from "lucide-react";

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
          username: tgUser.username,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
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
        <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
          Bu uygulama bir <b>Telegram Mini App (TMA)</b> servisidir. Güvenliğiniz ve işlemlerinizin anında gerçekleşmesi için lütfen Telegram botumuz üzerinden başlatınız.
        </p>
        <div className="space-y-3 w-full max-w-xs">
          <a
            href="/admin"
            className="w-full py-3 px-4 rounded-xl bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-200 text-xs font-semibold transition-all block text-center"
          >
            🛡️ Yönetici Paneline Git
          </a>
        </div>
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

  const isAdmin =
    currentUser?.role === "admin" ||
    String(currentUser?.telegramId) === "6824921456" ||
    String(tgUser?.id) === "6824921456";

  return (
    <div className="min-h-screen flex flex-col bg-[#090a0f] text-zinc-100">
      {/* Top Header */}
      <Header
        user={currentUser}
        onOpenDeposit={() => setDepositModalOpen(true)}
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
            />

            {/* Alt Bilgi & Hızlı İpuçları */}
            <div className="pt-4 border-t border-white/[0.06] text-center space-y-1.5 text-zinc-500 text-[11px]">
              <div className="flex items-center justify-center gap-1.5 text-zinc-400">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>%100 Güvenli & 15 Dakika İade Garantili</span>
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

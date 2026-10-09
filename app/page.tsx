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
import { APP_BUILD_VERSION } from "@/lib/app-version";
import { Shield, Zap, Headphones, Gift, Ticket, ShieldAlert } from "lucide-react";

function HomeContent() {
  const { isReady, user: tgUser } = useTelegram();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [adminUsernames, setAdminUsernames] = useState<string[]>(["olanak"]);
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

  // Telegram ve mobil WebView önbelleğini zorunlu yenileme (Eski tasarımı anında ezer)
  useEffect(() => {
    try {
      const savedBuild = localStorage.getItem("azfur_app_build");
      const urlParams = new URLSearchParams(window.location.search);
      const urlBuild = urlParams.get("v");

      if (savedBuild !== APP_BUILD_VERSION || urlBuild !== APP_BUILD_VERSION) {
        localStorage.setItem("azfur_app_build", APP_BUILD_VERSION);
        urlParams.set("v", APP_BUILD_VERSION);
        urlParams.set("t", String(Date.now()));
        const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
        if (typeof window !== "undefined" && window.location.replace) {
          window.location.replace(newUrl);
        }
      }
    } catch (e) {}
  }, []);

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
        if (data.adminUsernames && Array.isArray(data.adminUsernames)) {
          setAdminUsernames(data.adminUsernames);
        }
      }
    } catch (e) {
      console.error("User init error:", e);
    }
  }, [tgUser]);

  // 2. Canlı Katalog ve Fiyatları Getir (Kesintisiz & Yarış Durumu Korumalı)
  const fetchCatalog = useCallback(async (countryId: number = 62) => {
    activeCountryIdRef.current = countryId;

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

  // Bakiye, kullanıcı verilerini ve aktif siparişleri periyodik olarak canlı senkronize et (0 gecikme)
  useEffect(() => {
    if (!tgUser) return;

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        // 1. Kullanıcı Verilerini ve Bakiyeyi Eşitle
        fetch(`/api/user/me?telegramId=${tgUser.id}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((data) => {
            if (data.success && data.user) {
              if (data.adminUsernames && Array.isArray(data.adminUsernames)) {
                setAdminUsernames(data.adminUsernames);
              }
              setCurrentUser((prev: any) => {
                if (
                  !prev ||
                  prev.balance !== data.user.balance ||
                  prev.spent !== data.user.spent ||
                  prev.isBanned !== data.user.isBanned ||
                  prev.isVip !== data.user.isVip ||
                  prev.vipDiscountPercent !== data.user.vipDiscountPercent ||
                  prev.role !== data.user.role ||
                  JSON.stringify(prev.activeDiscount) !== JSON.stringify(data.user.activeDiscount)
                ) {
                  return { ...prev, ...data.user };
                }
                return prev;
              });
            }
          })
          .catch(() => {});

        // 2. Aktif Siparişleri ve Gelen SMS Kodlarını Canlı Eşitle
        fetchActiveOrders();
      }
    }, 3000);

    // 3. Fiyat ve Stok Kataloğunu 12 saniyede bir sessizce canlı güncelle
    const catalogInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        const countryId = activeCountryIdRef.current || 62;
        fetch(`/api/sms/catalog?country=${countryId}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((data) => {
            if (data.success && activeCountryIdRef.current === countryId && data.catalog) {
              catalogCacheRef.current[countryId] = data.catalog;
              setCatalog(data.catalog);
            }
          })
          .catch(() => {});
      }
    }, 12000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        initUser();
        fetchActiveOrders();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      clearInterval(catalogInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [tgUser, initUser, fetchActiveOrders]);

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

  const handleRefreshAll = useCallback(async () => {
    const activeTgId = tgUser?.id || currentUser?.telegramId;
    if (activeTgId) {
      try {
        const res = await fetch(`/api/user/me?telegramId=${activeTgId}`, { cache: "no-store" });
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentUser((prev: any) => ({ ...prev, ...data.user }));
        }
      } catch (e) {}
    }
    await initUser();
    fetchActiveOrders();
    if (selectedCountry) {
      fetchCatalog(selectedCountry.id);
    } else {
      fetchCatalog(62);
    }
  }, [tgUser, currentUser, initUser, fetchActiveOrders, fetchCatalog, selectedCountry]);

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

  if (currentUser?.isBanned) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#090a0f] text-center select-none">
        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-5 shadow-2xl shadow-rose-950/50">
          <ShieldAlert className="w-10 h-10 animate-pulse" />
        </div>
        <h1 className="text-xl font-black text-white tracking-wider uppercase mb-2">
          HESABINIZ ENGELLENDİ
        </h1>
        <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
          Yönetici kararı veya sistem kuralları gereği hesabınız kalıcı/geçici olarak askıya alınmıştır. Bu süre zarfında bot ve web servislerimize erişim sağlayamazsınız.
        </p>

        <div className="w-full max-w-sm bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 text-left mb-6 shadow-xl backdrop-blur-md">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span>👑 İletişim & Destek Yöneticileri</span>
          </div>
          <div className="space-y-2">
            {adminUsernames.length > 0 ? (
              adminUsernames.map((adminUser) => (
                <a
                  key={adminUser}
                  href={`https://t.me/${adminUser}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/50 text-white transition-all group active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold font-mono">
                      @
                    </div>
                    <span className="text-sm font-semibold text-zinc-200 group-hover:text-emerald-400 transition-colors">
                      @{adminUser}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    Mesaj At →
                  </span>
                </a>
              ))
            ) : (
              <a
                href="https://t.me/olanak"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/50 text-white transition-all group"
              >
                <span className="text-sm font-semibold">@olanak</span>
                <span className="text-xs text-emerald-400">Mesaj At →</span>
              </a>
            )}
          </div>
        </div>

        <p className="text-[11px] text-zinc-600">
          AzFur SMS Onay Altyapısı Güvenlik Sistemi
        </p>
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin";

  const displayUser = currentUser
    ? {
        ...currentUser,
        firstName: currentUser.firstName || tgUser?.first_name || "Kullanıcı",
        lastName: currentUser.lastName || tgUser?.last_name || "",
        username: currentUser.username || tgUser?.username || "",
        telegramId: currentUser.telegramId || tgUser?.id || 0,
      }
    : tgUser
    ? {
        firstName: tgUser.first_name || "Kullanıcı",
        lastName: tgUser.last_name || "",
        username: tgUser.username || "",
        telegramId: tgUser.id,
        balance: 0,
        role: "user",
      }
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#090a0f] text-zinc-100">
      {/* Top Header */}
      <Header
        user={displayUser}
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
          <AdminView
            onBackToApp={() => {
              setAdminViewActive(false);
              handleRefreshAll();
            }}
            onCurrentUserUpdated={(updated) => {
              if (
                updated &&
                (Number(updated.telegramId) === Number(currentUser?.telegramId) ||
                  Number(updated.telegramId) === Number(tgUser?.id))
              ) {
                setCurrentUser((prev: any) => ({ ...prev, ...updated }));
              }
            }}
          />
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
        onSuccess={(couponResult) => {
          if (couponResult?.newBalance !== undefined) {
            setCurrentUser((prev: any) =>
              prev
                ? {
                    ...prev,
                    balance: couponResult.newBalance,
                    activeDiscount: couponResult.activeDiscount ?? prev.activeDiscount,
                  }
                : prev
            );
          }
          handleRefreshAll();
        }}
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

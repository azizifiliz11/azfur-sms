"use client";

import React from "react";
import { Wallet, Plus, ShieldCheck, RefreshCw, Headphones, Ticket } from "lucide-react";
import { haptic } from "@/lib/haptic";

interface HeaderProps {
  user: {
    firstName: string;
    lastName?: string;
    username?: string;
    balance: number;
    telegramId: number;
    role?: string;
    isVip?: boolean;
    vipDiscountPercent?: number;
  } | null;
  onOpenDeposit: () => void;
  onOpenSupport?: () => void;
  onOpenCoupon?: () => void;
  onRefreshBalance: () => void;
  isAdmin?: boolean;
  onToggleAdminView?: () => void;
  adminViewActive?: boolean;
}

export function Header({
  user,
  onOpenDeposit,
  onOpenSupport,
  onOpenCoupon,
  onRefreshBalance,
  isAdmin = false,
  onToggleAdminView,
  adminViewActive = false,
}: HeaderProps) {
  const [refreshing, setRefreshing] = React.useState(false);

  const handleDepositClick = () => {
    haptic.impact("medium");
    onOpenDeposit();
  };

  const handleRefreshClick = () => {
    haptic.impact("light");
    setRefreshing(true);
    onRefreshBalance();
    setTimeout(() => setRefreshing(false), 800);
  };

  const hasRealFirstName =
    user?.firstName &&
    user.firstName !== "Kullanıcı" &&
    user.firstName !== "Misafir" &&
    user.firstName !== "Telegram Kullanıcısı";

  const cleanUsername =
    user?.username && !user.username.startsWith("user_")
      ? user.username.trim()
      : "";

  const fullName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const displayName = hasRealFirstName
    ? (fullName || user?.firstName || "Kullanıcı")
    : cleanUsername
    ? `@${cleanUsername}`
    : user?.telegramId
    ? `Kullanıcı #${user.telegramId}`
    : "Misafir";

  const initials = (user?.firstName && user?.lastName)
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : hasRealFirstName
    ? user.firstName.slice(0, 2).toUpperCase()
    : cleanUsername
    ? cleanUsername.slice(0, 2).toUpperCase()
    : "AZ";

  return (
    <header className="sticky top-0 z-30 w-full bg-[#090a0f]/95 backdrop-blur-2xl border-b border-white/[0.06] px-3.5 pt-2.5 pb-3 shadow-xl shadow-black/50">
      <div className="max-w-md mx-auto space-y-2.5">
        {/* EN ÜST: Minimal Logo & Hızlı Navigasyon Butonları */}
        <div className="flex items-center justify-between px-0.5">
          {/* Logo & Canlı Gösterge */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-[13px] font-black text-white tracking-tight flex items-center gap-1">
                <span className="text-emerald-400">⚡</span> AzFur
              </span>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                SMS Altyapısı
              </span>
            </div>
          </div>

          {/* Sağ Navigasyon: Destek & Admin Butonları */}
          <div className="flex items-center gap-1.5">
            {onOpenSupport && (
              <button
                onClick={() => {
                  haptic.impact("light");
                  onOpenSupport();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-blue-400 border border-white/10 hover:border-blue-500/40 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm text-xs font-semibold"
                title="Destek & Ticket Aç"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Destek</span>
              </button>
            )}

            {isAdmin && onToggleAdminView && (
              <button
                onClick={() => {
                  haptic.impact("light");
                  onToggleAdminView();
                }}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 ${
                  adminViewActive
                    ? "bg-purple-500/25 text-purple-300 border-purple-500/50 shadow-purple-500/20"
                    : "bg-zinc-900/90 text-zinc-300 border-white/10 hover:text-white hover:border-white/20"
                }`}
                title="Yönetici Paneli"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>{adminViewActive ? "App'e Dön" : "Admin"}</span>
              </button>
            )}
          </div>
        </div>

        {/* ANA KART: Kullanıcı Kimliği & Bakiye Kartı (Hero Profile Card) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#131622]/95 via-[#0e111a]/95 to-[#090a10]/95 border border-white/[0.08] p-3 shadow-lg shadow-black/40">
          {/* Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* 1. Üst Kısım: Kullanıcı Avatarı + İsim + Kullanıcı Adı + Rozetler + Yenile Butonu */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {/* Avatar */}
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/25 via-emerald-600/10 to-blue-500/20 border border-emerald-500/30 text-emerald-300 font-extrabold text-xs shadow-md select-none">
                {initials}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#0e111a]" />
              </div>

              {/* İsim ve Kullanıcı Bilgisi */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-xs sm:text-[13px] font-bold text-white truncate leading-tight tracking-tight">
                    {displayName}
                  </h2>
                  {isAdmin && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/35">
                      ADMIN
                    </span>
                  )}
                  {user?.isVip && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                      ⭐ VIP {user.vipDiscountPercent ? `%${user.vipDiscountPercent}` : ""}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[10.5px] text-zinc-400 truncate mt-0.5 font-medium">
                  <span className="font-mono text-zinc-300">
                    {cleanUsername ? `@${cleanUsername}` : `ID: ${user?.telegramId || "0"}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Hızlı Veri Yenileme Butonu */}
            <button
              onClick={handleRefreshClick}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/5 active:scale-90 transition-all shrink-0"
              title="Bakiyeyi ve Verileri Yenile"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "text-emerald-400 animate-spin" : ""}`} />
            </button>
          </div>

          {/* Ayraç */}
          <div className="my-2.5 border-t border-white/[0.05]" />

          {/* 2. Alt Kısım: Bakiye Tutarı ve Eylem Butonları */}
          <div className="flex items-center justify-between gap-2">
            {/* Sol: Bakiye Gösterimi */}
            <div
              onClick={handleRefreshClick}
              className="cursor-pointer group select-none"
              title="Bakiyeyi Yenilemek İçin Dokunun"
            >
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <Wallet className="w-3 h-3 text-emerald-400" />
                <span>Bakiye</span>
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black font-mono text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                  ₺{user?.balance !== undefined ? user.balance.toFixed(2) : "0.00"}
                </span>
              </div>
            </div>

            {/* Sağ: + Yükle ve Kupon Butonları */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Kupon Kodu Butonu */}
              {onOpenCoupon && (
                <button
                  onClick={() => {
                    haptic.impact("light");
                    onOpenCoupon();
                  }}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs active:scale-95 transition-all shadow-sm"
                  title="Kupon / Promosyon Kodu Kullan"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  <span>Kupon</span>
                </button>
              )}

              {/* Bakiye Yükle Butonu */}
              <button
                onClick={handleDepositClick}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-xs shadow-md shadow-emerald-500/25 active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>+ Yükle</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

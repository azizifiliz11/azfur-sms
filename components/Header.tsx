"use client";

import React from "react";
import { User, Wallet, Plus, ShieldCheck, RefreshCw, Headphones, Ticket } from "lucide-react";
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
    <header className="sticky top-0 z-30 w-full bg-[#090a0f]/90 backdrop-blur-2xl border-b border-white/[0.07] px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-lg shadow-black/40">
      <div className="max-w-md mx-auto space-y-2.5">
        {/* ÜST SATIR: Kullanıcı Kimliği, Rozetler ve Hızlı İkonlar */}
        <div className="flex items-center justify-between gap-2">
          {/* Sol: Avatar + İsim + Kullanıcı Adı + Rozetler */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Avatar */}
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/25 via-emerald-600/10 to-blue-500/20 border border-emerald-500/30 text-emerald-300 font-extrabold text-sm shadow-md shadow-emerald-500/10 select-none">
              {initials}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-[#090a0f] ring-1 ring-emerald-400/50" />
            </div>

            {/* İsim ve Kullanıcı Adı Bilgisi */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-[13px] font-bold text-white truncate leading-tight tracking-tight">
                  {displayName}
                </h2>
                {isAdmin && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 shadow-sm shadow-emerald-500/15">
                    ADMIN
                  </span>
                )}
                {user?.isVip && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20 animate-pulse">
                    ⭐ VIP {user.vipDiscountPercent ? `%${user.vipDiscountPercent}` : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 truncate mt-0.5 font-medium">
                <span className="font-mono text-zinc-300 hover:text-white transition-colors">
                  {cleanUsername ? `@${cleanUsername}` : `ID: ${user?.telegramId || "0"}`}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-[10px] font-black text-emerald-400 tracking-tight flex items-center gap-0.5">
                  ⚡ AzFur
                </span>
              </div>
            </div>
          </div>

          {/* Sağ: Destek ve Admin Switcher İkonları */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Support Button */}
            {onOpenSupport && (
              <button
                onClick={() => {
                  haptic.impact("light");
                  onOpenSupport();
                }}
                className="p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-blue-400 border border-white/10 hover:border-blue-500/40 active:scale-95 transition-all relative shadow-sm"
                title="Destek & Ticket"
              >
                <Headphones className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              </button>
            )}

            {/* Admin Switcher Button */}
            {isAdmin && onToggleAdminView && (
              <button
                onClick={() => {
                  haptic.impact("light");
                  onToggleAdminView();
                }}
                className={`p-2 rounded-xl border transition-all shadow-sm ${
                  adminViewActive
                    ? "bg-purple-500/25 text-purple-300 border-purple-500/50 shadow-purple-500/20"
                    : "bg-zinc-900/90 text-zinc-400 border-white/10 hover:text-white hover:border-white/20"
                }`}
                title="Yönetici Paneli"
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ALT SATIR: Bakiye, Yükle ve Kupon Eylemleri */}
        <div className="flex items-center gap-2 pt-1 border-t border-white/[0.04]">
          {/* Bakiye Kutusu (Tıkla Yenile) */}
          <div
            onClick={handleRefreshClick}
            className="flex-1 flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/90 border border-white/10 shadow-sm cursor-pointer hover:border-emerald-500/40 active:scale-[0.98] transition-all group"
            title="Bakiyeyi Yenilemek İçin Dokunun"
          >
            <div className="flex items-center gap-2">
              {refreshing ? (
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
              ) : (
                <Wallet className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              )}
              <span className="text-[11px] font-semibold text-zinc-400">Bakiye</span>
            </div>
            <span className="font-mono font-black text-sm text-white tracking-tight">
              ₺{user?.balance !== undefined ? user.balance.toFixed(2) : "0.00"}
            </span>
          </div>

          {/* Bakiye Yükle Butonu */}
          <button
            onClick={handleDepositClick}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-extrabold text-xs shadow-md shadow-emerald-500/25 active:scale-95 transition-all shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Yükle</span>
          </button>

          {/* Kupon Kodu Butonu */}
          {onOpenCoupon && (
            <button
              onClick={() => {
                haptic.impact("light");
                onOpenCoupon();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 font-bold text-xs active:scale-95 transition-all shadow-sm shrink-0"
              title="Kupon / Promosyon Kodu Kullan"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Kupon</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

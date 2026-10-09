"use client";

import React from "react";
import {
  Wallet,
  Plus,
  ShieldCheck,
  RefreshCw,
  Headphones,
  Ticket,
  Zap,
  ShieldAlert,
  Clock,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
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
  const [copiedId, setCopiedId] = React.useState(false);

  const handleDepositClick = () => {
    haptic.impact("medium");
    onOpenDeposit();
  };

  const handleRefreshClick = () => {
    haptic.impact("light");
    setRefreshing(true);
    onRefreshBalance();
    setTimeout(() => setRefreshing(false), 900);
  };

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.telegramId) return;
    haptic.impact("light");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(String(user.telegramId));
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
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
    ? fullName || user?.firstName || "Kullanıcı"
    : cleanUsername
    ? `@${cleanUsername}`
    : user?.telegramId
    ? `Kullanıcı #${user.telegramId}`
    : "Misafir";

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : hasRealFirstName
      ? user.firstName.slice(0, 2).toUpperCase()
      : cleanUsername
      ? cleanUsername.slice(0, 2).toUpperCase()
      : "AZ";

  const balanceDisplay =
    user?.balance !== undefined && !isNaN(Number(user.balance))
      ? Number(user.balance).toFixed(2)
      : "0.00";

  return (
    <header className="sticky top-0 z-40 w-full bg-[#07080c]/95 backdrop-blur-2xl border-b border-white/[0.08] px-3 pt-2.5 pb-2.5 shadow-2xl shadow-black/80 transition-all">
      <div className="max-w-md mx-auto space-y-2.5">
        {/* 1. SATIR: Üst Marka Barı & Hızlı Navigasyon */}
        <div className="flex items-center justify-between px-0.5">
          {/* Logo & Canlı Gösterge */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-tight text-white flex items-center gap-1">
                <span className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">⚡</span>
                <span className="bg-gradient-to-r from-white via-zinc-100 to-zinc-300 bg-clip-text text-transparent font-extrabold">
                  AzFur
                </span>
              </span>
              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
                SMS Onay
              </span>
            </div>
          </div>

          {/* Sağ Eylemler: Destek & Yönetici Butonları */}
          <div className="flex items-center gap-1.5">
            {onOpenSupport && (
              <button
                onClick={() => {
                  haptic.impact("light");
                  onOpenSupport();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-blue-400 border border-blue-500/20 hover:border-blue-500/40 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm text-xs font-semibold"
                title="Canlı Destek & Ticket Aç"
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
                    ? "bg-purple-500/25 text-purple-200 border-purple-500/50 shadow-purple-500/25"
                    : "bg-zinc-900/90 text-purple-300 border-purple-500/20 hover:border-purple-500/40"
                }`}
                title="Yönetici Paneli"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>{adminViewActive ? "App'e Dön" : "Admin"}</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. SATIR: ANA KULLANICI & BAKİYE KARTI (Hero Profile & Balance Card) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#131726] via-[#0d101a] to-[#090b12] border border-white/[0.09] p-3.5 shadow-xl shadow-black/60">
          {/* Ambient Lighting */}
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Profil Üst Bloğu: Avatar + İsim + Kullanıcı Adı + Rozetler */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Avatar */}
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/30 via-emerald-600/15 to-blue-500/25 border border-emerald-500/40 text-emerald-300 font-black text-sm shadow-lg shadow-emerald-500/10 select-none">
                {initials}
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-[#0d101a] shadow-sm" />
              </div>

              {/* İsim & Kullanıcı Bilgisi */}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-[13.5px] font-black text-white truncate leading-tight tracking-tight">
                    {displayName}
                  </h2>
                  {isAdmin && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      ADMIN
                    </span>
                  )}
                  {user?.isVip && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>VIP {user.vipDiscountPercent ? `%${user.vipDiscountPercent}` : ""}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 truncate">
                  {cleanUsername ? (
                    <span className="font-mono text-zinc-300 font-semibold truncate">
                      @{cleanUsername}
                    </span>
                  ) : null}
                  <button
                    onClick={handleCopyId}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/5 font-mono text-[10px] transition-all"
                    title="ID Kopyala"
                  >
                    <span>ID: {user?.telegramId || "0"}</span>
                    {copiedId ? (
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-2.5 h-2.5 opacity-60" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Hızlı Bakiye/Veri Yenileme Butonu */}
            <button
              onClick={handleRefreshClick}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] active:scale-90 transition-all shrink-0 shadow-sm"
              title="Bakiyeyi ve Verileri Yenile"
            >
              <RefreshCw
                className={`w-4 h-4 transition-transform ${
                  refreshing ? "text-emerald-400 animate-spin" : "text-zinc-400 group-hover:text-white"
                }`}
              />
            </button>
          </div>

          {/* Ayraç Çizgisi */}
          <div className="my-3 border-t border-white/[0.06]" />

          {/* Profil Alt Bloğu: Bakiye Göstergesi + Eylem Butonları */}
          <div className="flex items-center justify-between gap-2.5">
            {/* Sol: Bakiye Tutar Alanı */}
            <div
              onClick={handleRefreshClick}
              className="cursor-pointer group select-none flex-1 min-w-0"
              title="Bakiyeyi Yenilemek İçin Dokunun"
            >
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <Wallet className="w-3 h-3 text-emerald-400" />
                <span>Mevcut Bakiye</span>
              </span>
              <div className="flex items-baseline gap-1 mt-0.5 truncate">
                <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                  ₺{balanceDisplay}
                </span>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  TRY
                </span>
              </div>
            </div>

            {/* Sağ: Kupon ve Bakiye Yükle Eylemleri */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Kupon Kodu Butonu */}
              {onOpenCoupon && (
                <button
                  onClick={() => {
                    haptic.impact("light");
                    onOpenCoupon();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs active:scale-95 transition-all shadow-sm"
                  title="Kupon / Promosyon Kodu Kullan"
                >
                  <Ticket className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Kupon</span>
                </button>
              )}

              {/* Bakiye Yükle Butonu */}
              <button
                onClick={handleDepositClick}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
                title="Bakiye Yükle"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>+ Yükle</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. SATIR: Hızlı Güvenlik & Garanti Rozetleri (Kompakt Micro-Ribbon) */}
        <div className="grid grid-cols-3 gap-1.5 px-0.5 text-center">
          <div className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-[10px] font-bold text-zinc-300 truncate">5-30 Sn Teslim</span>
          </div>
          <div className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <ShieldAlert className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="text-[10px] font-bold text-zinc-300 truncate">%100 İade</span>
          </div>
          <div className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <Clock className="w-3 h-3 text-purple-400 shrink-0" />
            <span className="text-[10px] font-bold text-zinc-300 truncate">7/24 Aktif</span>
          </div>
        </div>
      </div>
    </header>
  );
}

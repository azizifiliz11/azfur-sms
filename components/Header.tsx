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

  const handleCopyId = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
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

  const cleanUsername = user?.username
    ? user.username.replace(/^@/, "").trim()
    : "";
  const visibleUsername = cleanUsername.startsWith("user_") ? "" : cleanUsername;

  const fullName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const displayName = hasRealFirstName
    ? fullName || user?.firstName || "Kullanıcı"
    : visibleUsername
      ? `@${visibleUsername}`
      : user?.telegramId
        ? `Kullanıcı #${user.telegramId}`
        : "Misafir";

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : hasRealFirstName
      ? user.firstName.slice(0, 2).toUpperCase()
      : visibleUsername
        ? visibleUsername.slice(0, 2).toUpperCase()
        : "AZ";

  const balanceDisplay =
    user?.balance !== undefined && !isNaN(Number(user.balance))
      ? Number(user.balance).toFixed(2)
      : "0.00";

  const showUsernameBelowName =
    visibleUsername && displayName !== `@${visibleUsername}`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.07] bg-[#080a10]/90 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2.5 shadow-xl shadow-black/40 backdrop-blur-2xl">
      <div className="mx-auto max-w-md space-y-2">
        {/* Brand and quick actions */}
        <div className="flex min-h-9 items-center justify-between gap-2 px-0.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.09] text-emerald-300 shadow-inner shadow-emerald-300/[0.06]">
              <Zap className="h-4 w-4 fill-emerald-300/15" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#080a10] bg-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-black leading-none tracking-tight text-white">AzFur</span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                  SMS Onay
                </span>
              </div>
              <span className="mt-1 block text-[9px] font-medium leading-none text-zinc-500">Güvenli numara kiralama</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {onOpenSupport && (
              <button
                type="button"
                onClick={() => {
                  haptic.impact("light");
                  onOpenSupport();
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-sky-400/15 bg-sky-400/[0.06] px-2.5 text-[11px] font-semibold text-sky-300 transition-colors hover:bg-sky-400/[0.12] active:scale-95"
                title="Canlı Destek & Ticket Aç"
                aria-label="Canlı destek ve ticket aç"
              >
                <Headphones className="h-3.5 w-3.5" />
                <span>Destek</span>
              </button>
            )}

            {isAdmin && onToggleAdminView && (
              <button
                type="button"
                onClick={() => {
                  haptic.impact("light");
                  onToggleAdminView();
                }}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-bold transition-colors active:scale-95 ${
                  adminViewActive
                    ? "border-violet-400/35 bg-violet-400/15 text-violet-200"
                    : "border-violet-400/15 bg-violet-400/[0.06] text-violet-300 hover:bg-violet-400/[0.12]"
                }`}
                title="Yönetici Paneli"
                aria-label={adminViewActive ? "Uygulamaya dön" : "Yönetici panelini aç"}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{adminViewActive ? "Uygulama" : "Admin"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Account and balance */}
        <section className="relative overflow-hidden rounded-[1.35rem] border border-white/[0.09] bg-gradient-to-br from-[#151b25] via-[#10141d] to-[#0d1017] p-3 shadow-lg shadow-black/25">
          <div className="pointer-events-none absolute -right-14 -top-16 h-36 w-36 rounded-full bg-emerald-400/[0.09] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-12 h-32 w-32 rounded-full bg-sky-400/[0.07] blur-3xl" />

          <div className="relative flex min-w-0 items-center gap-2.5">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] border border-emerald-300/25 bg-gradient-to-br from-emerald-300/20 to-sky-400/10 text-[13px] font-black text-emerald-200 shadow-md shadow-emerald-950/20">
              {initials}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#11151e] bg-emerald-400" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <h2 className="max-w-full truncate text-[13px] font-bold leading-tight tracking-tight text-white">
                  {displayName}
                </h2>
                {isAdmin && (
                  <span className="rounded-md border border-emerald-300/20 bg-emerald-300/[0.08] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-emerald-200">
                    Admin
                  </span>
                )}
                {user?.isVip && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/20 bg-amber-300/[0.08] px-1.5 py-0.5 text-[8px] font-bold text-amber-200">
                    <Sparkles className="h-2.5 w-2.5" />
                    VIP {user.vipDiscountPercent ? `%${user.vipDiscountPercent}` : ""}
                  </span>
                )}
              </div>

              <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-zinc-400">
                {showUsernameBelowName && (
                  <span className="max-w-[42%] truncate font-medium text-zinc-400">@{visibleUsername}</span>
                )}
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.035] px-1.5 font-mono text-[9px] text-zinc-400 transition-colors hover:border-white/10 hover:text-white"
                  title="Telegram ID'yi kopyala"
                  aria-label={`Telegram ID ${user?.telegramId || "0"}, kopyalamak için dokun`}
                >
                  <span>ID {user?.telegramId || "0"}</span>
                  {copiedId ? (
                    <Check className="h-2.5 w-2.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-2.5 w-2.5 opacity-60" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={refreshing}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-white active:scale-95 disabled:cursor-wait"
              title="Bakiyeyi ve verileri yenile"
              aria-label="Bakiyeyi ve verileri yenile"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-emerald-300" : ""}`} />
            </button>
          </div>

          <div className="relative my-2.5 border-t border-white/[0.07]" />

          <div className="relative flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleRefreshClick}
              className="group min-w-0 flex-1 cursor-pointer text-left"
              title="Bakiyeyi yenilemek için dokun"
              aria-label={`Mevcut bakiye ₺${balanceDisplay}. Yenilemek için dokun`}
            >
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-400">
                <Wallet className="h-3 w-3 text-emerald-300" />
                Bakiye
              </span>
              <span className="mt-0.5 flex items-baseline gap-1 whitespace-nowrap">
                <span className="font-mono text-[21px] font-bold leading-none tracking-tight text-white transition-colors group-hover:text-emerald-200">
                  ₺{balanceDisplay}
                </span>
                <span className="text-[9px] font-semibold tracking-wide text-emerald-300">TRY</span>
              </span>
            </button>

            <div className="flex shrink-0 items-center gap-1.5">
              {onOpenCoupon && (
                <button
                  type="button"
                  onClick={() => {
                    haptic.impact("light");
                    onOpenCoupon();
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-300/20 bg-amber-300/[0.08] px-2.5 text-[10px] font-bold text-amber-200 transition-colors hover:bg-amber-300/[0.14] active:scale-95"
                  title="Kupon / Promosyon Kodu Kullan"
                  aria-label="Kupon veya promosyon kodu kullan"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  <span>Kupon</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDepositClick}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-300 px-3 text-[10px] font-extrabold text-[#062017] shadow-md shadow-emerald-950/30 transition-all hover:brightness-110 active:scale-95"
                title="Bakiye yükle"
                aria-label="Bakiye yükle"
              >
                <Plus className="h-3.5 w-3.5 stroke-[3]" />
                <span>Yükle</span>
              </button>
            </div>
          </div>
        </section>

        {/* Compact service assurances */}
        <div className="grid grid-cols-3 gap-1 px-0.5 text-center">
          <div className="flex min-w-0 items-center justify-center gap-1 rounded-lg border border-white/[0.045] bg-white/[0.02] px-1 py-1.5">
            <Zap className="h-3 w-3 shrink-0 text-emerald-300" />
            <span className="truncate text-[9px] font-semibold text-zinc-300">5–30 sn teslim</span>
          </div>
          <div className="flex min-w-0 items-center justify-center gap-1 rounded-lg border border-white/[0.045] bg-white/[0.02] px-1 py-1.5">
            <ShieldAlert className="h-3 w-3 shrink-0 text-sky-300" />
            <span className="truncate text-[9px] font-semibold text-zinc-300">%100 iade</span>
          </div>
          <div className="flex min-w-0 items-center justify-center gap-1 rounded-lg border border-white/[0.045] bg-white/[0.02] px-1 py-1.5">
            <Clock className="h-3 w-3 shrink-0 text-violet-300" />
            <span className="truncate text-[9px] font-semibold text-zinc-300">7/24 aktif</span>
          </div>
        </div>
      </div>
    </header>
  );
}

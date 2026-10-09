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
  const [timeGreeting, setTimeGreeting] = React.useState("İyi günler");

  React.useEffect(() => {
    const updateGreeting = () => {
      const hourPart = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Istanbul",
        hour: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date())
        .find((part) => part.type === "hour")?.value;
      const hour = Number(hourPart);

      setTimeGreeting(
        hour >= 5 && hour < 12
          ? "Günaydın"
          : hour >= 18 && hour < 24
            ? "İyi akşamlar"
            : "İyi günler"
      );
    };

    updateGreeting();
    const intervalId = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

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

  const hasRealFirstName = Boolean(
    user?.firstName &&
      user.firstName !== "Kullanıcı" &&
      user.firstName !== "Misafir" &&
      user.firstName !== "Telegram Kullanıcısı"
  );

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

  const greetingName = hasRealFirstName && user?.firstName
    ? user.firstName
    : displayName;
  const greeting = user
    ? `${timeGreeting}, ${greetingName}`
    : displayName;

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : hasRealFirstName && user?.firstName
      ? user.firstName.slice(0, 2).toUpperCase()
      : visibleUsername
        ? visibleUsername.slice(0, 2).toUpperCase()
        : "AZ";

  const showUsername = visibleUsername && displayName !== `@${visibleUsername}`;

  const balanceDisplay =
    user?.balance !== undefined && !isNaN(Number(user.balance))
      ? Number(user.balance).toFixed(2)
      : "0.00";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.07] bg-[#080a10]/95 px-3 pt-[calc(env(safe-area-inset-top)+0.55rem)] pb-3 backdrop-blur-2xl">
      <div className="mx-auto max-w-md space-y-2.5">
        <div className="flex min-h-10 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 via-teal-400 to-cyan-500 text-[#062017] shadow-lg shadow-emerald-950/40">
              <Zap className="h-[18px] w-[18px] fill-current" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#080a10] bg-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-black leading-none tracking-tight text-white">AzFur</span>
                <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.13em] text-emerald-200">SMS ONAY</span>
              </div>
              <span className="mt-1 block text-[9px] leading-none text-zinc-500">Hızlı, güvenli ve canlı</span>
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
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-sky-300/15 bg-sky-300/[0.06] px-2.5 text-[10px] font-semibold text-sky-200 transition-colors hover:bg-sky-300/[0.12] active:scale-95"
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
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-bold transition-colors active:scale-95 ${
                  adminViewActive
                    ? "border-violet-300/35 bg-violet-300/15 text-violet-100"
                    : "border-violet-300/15 bg-violet-300/[0.06] text-violet-200 hover:bg-violet-300/[0.12]"
                }`}
                title="Yönetici Paneli"
                aria-label={adminViewActive ? "Uygulamaya dön" : "Yönetici panelini aç"}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{adminViewActive ? "Uygulama" : "Panel"}</span>
              </button>
            )}
          </div>
        </div>

        <section className="relative isolate overflow-hidden rounded-[1.55rem] border border-emerald-300/15 bg-[linear-gradient(135deg,#10221f_0%,#10151d_52%,#111522_100%)] p-3.5 shadow-[0_16px_44px_rgba(0,0,0,0.28)]">
          <div className="pointer-events-none absolute -right-12 -top-16 -z-10 h-40 w-40 rounded-full bg-emerald-400/[0.13] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 -z-10 h-36 w-36 rounded-full bg-sky-400/[0.09] blur-3xl" />

          <div className="flex min-w-0 items-start gap-3">
            <div className="relative mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] border border-emerald-200/15 bg-gradient-to-br from-emerald-300/15 to-sky-300/[0.06] text-[15px] font-black tracking-wide text-emerald-100 shadow-inner shadow-white/[0.04]">
              {initials}
              <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-[3px] border-[#111a1c] bg-emerald-400" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.16em] text-emerald-300/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]" />
                Hesap paneli
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                <h2 className="max-w-full truncate text-[17px] font-extrabold leading-tight tracking-tight text-white">
                  {greeting}
                </h2>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-300/[0.09] px-2 py-0.5 text-[8px] font-bold text-emerald-100">
                    <ShieldCheck className="h-2.5 w-2.5" /> Yönetici
                  </span>
                )}
                {user?.isVip && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/[0.09] px-2 py-0.5 text-[8px] font-bold text-amber-100">
                    <Sparkles className="h-2.5 w-2.5" /> VIP {user.vipDiscountPercent ? `%${user.vipDiscountPercent}` : ""}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
                {showUsername && (
                  <span className="max-w-[55%] truncate text-[10px] font-medium text-zinc-300">@{visibleUsername}</span>
                )}
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-white/[0.08] bg-black/20 px-2 font-mono text-[9px] text-zinc-400 transition-colors hover:border-white/15 hover:text-white"
                  title="Telegram ID'yi kopyala"
                  aria-label={`Telegram ID ${user?.telegramId || "0"}, kopyalamak için dokun`}
                >
                  <span>ID {user?.telegramId || "0"}</span>
                  {copiedId ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5 opacity-60" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={refreshing}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.055] text-zinc-300 transition-colors hover:bg-white/[0.1] hover:text-white active:scale-95 disabled:cursor-wait"
              title="Bakiyeyi ve verileri yenile"
              aria-label="Bakiyeyi ve verileri yenile"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-emerald-300" : ""}`} />
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-[#080c12]/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleRefreshClick}
                className="group min-w-0 flex-1 cursor-pointer text-left"
                title="Bakiyeyi yenilemek için dokun"
                aria-label={`Mevcut bakiye ₺${balanceDisplay}. Yenilemek için dokun`}
              >
                <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                  <Wallet className="h-3 w-3 text-emerald-300" /> Kullanılabilir bakiye
                </span>
                <span className="mt-1 flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="font-mono text-[25px] font-extrabold leading-none tracking-tight text-white transition-colors group-hover:text-emerald-200">₺{balanceDisplay}</span>
                  <span className="text-[9px] font-semibold tracking-wide text-emerald-300">TRY</span>
                </span>
              </button>

              <div className={`grid shrink-0 gap-1.5 ${onOpenCoupon ? "grid-cols-2" : "grid-cols-1"}`}>
                {onOpenCoupon && (
                  <button
                    type="button"
                    onClick={() => {
                      haptic.impact("light");
                      onOpenCoupon();
                    }}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-amber-300/20 bg-amber-300/[0.08] px-2.5 text-[10px] font-bold text-amber-200 transition-colors hover:bg-amber-300/[0.14] active:scale-95"
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
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 px-3 text-[10px] font-extrabold text-[#062017] shadow-md shadow-emerald-950/30 transition-all hover:brightness-110 active:scale-95"
                  title="Bakiye yükle"
                  aria-label="Bakiye yükle"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[3]" />
                  <span>Yükle</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-1 px-0.5 text-[9px] font-semibold text-zinc-400">
            <span className="inline-flex items-center gap-1 whitespace-nowrap"><Zap className="h-3 w-3 text-emerald-300" /> 5–30 sn teslim</span>
            <span className="h-1 w-1 rounded-full bg-zinc-700" />
            <span className="inline-flex items-center gap-1 whitespace-nowrap"><ShieldAlert className="h-3 w-3 text-sky-300" /> %100 iade</span>
            <span className="h-1 w-1 rounded-full bg-zinc-700" />
            <span className="inline-flex items-center gap-1 whitespace-nowrap"><Clock className="h-3 w-3 text-violet-300" /> 7/24 aktif</span>
          </div>
        </section>
      </div>
    </header>
  );
}

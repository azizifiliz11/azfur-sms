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
  UserRound,
  ChevronRight,
} from "lucide-react";
import { haptic } from "@/lib/haptic";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RollingNumber } from "@/components/ui/rolling-number";

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
  onOpenProfile?: () => void;
  onRefreshBalance: () => void;
  isAdmin?: boolean;
  onToggleAdminView?: () => void;
  adminViewActive?: boolean;
}

function getIstanbulHour(): number {
  try {
    const hourPart = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .find((part) => part.type === "hour")?.value;
    if (hourPart !== undefined) {
      const h = Number(hourPart);
      if (!isNaN(h)) return h;
    }
  } catch {}
  return new Date().getHours();
}

function getTimeGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) {
    return "Günaydın";
  }
  if (hour >= 12 && hour < 18) {
    return "İyi günler";
  }
  // 18:00 - 04:59 (Akşam ve gece saatleri)
  return "İyi akşamlar";
}

export function Header({
  user,
  onOpenDeposit,
  onOpenSupport,
  onOpenCoupon,
  onOpenProfile,
  onRefreshBalance,
  isAdmin = false,
  onToggleAdminView,
  adminViewActive = false,
}: HeaderProps) {
  const [refreshing, setRefreshing] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState(false);
  const [timeGreeting, setTimeGreeting] = React.useState<string>(() => {
    return getTimeGreeting(getIstanbulHour());
  });

  React.useEffect(() => {
    const updateGreeting = () => {
      const hour = getIstanbulHour();
      setTimeGreeting(getTimeGreeting(hour));
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
    <header className="contents">
      <div className="sticky top-0 z-40 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-2">
        {/* Axis pill navbar */}
        <nav className="mx-auto flex max-w-md items-center justify-between gap-2 rounded-full border border-border bg-background/80 p-1.5 pl-2 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.1)] backdrop-blur-xl dark:border-muted-foreground/20">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
              <Zap className="h-4 w-4 fill-current" />
            </div>
            <div className="min-w-0 leading-none">
              <span className="block text-[15px] font-medium tracking-tight text-foreground">AzFur</span>
              <span className="mt-0.5 block whitespace-nowrap text-[9px] uppercase tracking-[0.14em] text-muted-foreground">SMS Onay</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {onOpenSupport && (
              <button
                type="button"
                onClick={() => {
                  haptic.impact("light");
                  onOpenSupport();
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted active:scale-95 dark:hover:bg-muted/50"
                title="Canlı Destek & Ticket Aç"
                aria-label="Canlı destek ve ticket aç"
              >
                <Headphones className="h-4 w-4" />
              </button>
            )}
            {onOpenProfile && (
              <button
                type="button"
                onClick={() => {
                  haptic.impact("light");
                  onOpenProfile();
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted active:scale-95 dark:hover:bg-muted/50"
                title="Profilim"
                aria-label="Profilimi aç"
              >
                <UserRound className="h-4 w-4" />
              </button>
            )}
            <ThemeToggle />
            {isAdmin && onToggleAdminView && (
              <button
                type="button"
                onClick={() => {
                  haptic.impact("light");
                  onToggleAdminView();
                }}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-foreground px-3.5 text-xs font-medium text-background transition-colors hover:bg-foreground/85 active:scale-95"
                title="Yönetici Paneli"
                aria-label={adminViewActive ? "Uygulamaya dön" : "Yönetici panelini aç"}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{adminViewActive ? "Uygulama" : "Panel"}</span>
              </button>
            )}
          </div>
        </nav>
      </div>

      <div className="px-3 pt-2">
        {/* Axis kartı: hesap ve bakiye */}
        <section className="relative mx-auto max-w-md overflow-hidden rounded-3xl bg-background/70 p-4 shadow-xs ring-1 ring-foreground/10 backdrop-blur-xl">
          <div className="flex min-w-0 items-start gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium tracking-wide text-foreground ring-1 ring-foreground/10">
              {initials}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-brand" />
            </div>

            <div className="min-w-0 flex-1">
              <h2
                suppressHydrationWarning
                className="truncate text-xl font-normal leading-tight tracking-tighter text-foreground"
              >
                {greeting}
              </h2>
              <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                {isAdmin && (
                  <span className="inline-flex h-5 items-center gap-1 rounded-sm border border-border px-2 text-[10px] font-medium text-foreground">
                    <ShieldCheck className="h-3 w-3" /> Yönetici
                  </span>
                )}
                {user?.isVip && (
                  <span className="inline-flex h-5 items-center gap-1 rounded-sm bg-secondary px-2 text-[10px] font-medium text-foreground dark:text-background">
                    <Sparkles className="h-3 w-3" /> VIP {user.vipDiscountPercent ? `%${user.vipDiscountPercent}` : ""}
                  </span>
                )}
                {showUsername && (
                  <span className="max-w-[45%] truncate text-[11px] text-muted-foreground">@{visibleUsername}</span>
                )}
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-border px-2 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                  title="Telegram ID'yi kopyala"
                  aria-label={`Telegram ID ${user?.telegramId || "0"}, kopyalamak için dokun`}
                >
                  <span>ID {user?.telegramId || "0"}</span>
                  {copiedId ? <Check className="h-2.5 w-2.5 text-brand" /> : <Copy className="h-2.5 w-2.5 opacity-60" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={refreshing}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-xs transition-colors hover:bg-muted active:scale-95 disabled:cursor-wait dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
              title="Bakiyeyi ve verileri yenile"
              aria-label="Bakiyeyi ve verileri yenile"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-brand" : ""}`} />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={handleRefreshClick}
              className="group block w-full cursor-pointer text-left"
              title="Bakiyeyi yenilemek için dokun"
              aria-label={`Mevcut bakiye ₺${balanceDisplay}. Yenilemek için dokun`}
            >
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" /> Kullanılabilir bakiye
              </span>
              <span className="mt-1 flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-4xl font-normal leading-none tracking-tighter text-foreground transition-colors group-hover:text-muted-foreground">
                  ₺<RollingNumber value={Number(balanceDisplay)} precision={2} format={(n) => n.toFixed(2)} />
                </span>
                <span className="text-xs text-muted-foreground">TRY</span>
              </span>
            </button>

            <div className={`grid gap-2 ${onOpenCoupon ? "grid-cols-2" : "grid-cols-1"}`}>
              {onOpenCoupon && (
                <button
                  type="button"
                  onClick={() => {
                    haptic.impact("light");
                    onOpenCoupon();
                  }}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted active:scale-95 dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
                  title="Kupon / Promosyon Kodu Kullan"
                  aria-label="Kupon veya promosyon kodu kullan"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  <span>Kupon Kullan</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleDepositClick}
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:scale-95"
                title="Bakiye yükle"
                aria-label="Bakiye yükle"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Bakiye Yükle</span>
              </button>
            </div>
          </div>

          {onOpenProfile && (
            <button
              type="button"
              onClick={() => {
                haptic.impact("light");
                onOpenProfile();
              }}
              className="mt-3 flex w-full items-center justify-between rounded-2xl border border-border px-3.5 py-2.5 text-left transition-colors hover:bg-muted active:scale-[0.99]"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                <UserRound className="h-3.5 w-3.5" /> Profil & işlem geçmişi
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                Yüklemeler, numaralar <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>
          )}

          {/* Axis istatistik ızgarası */}
          <div className="mt-4 grid grid-cols-3 border-l border-t border-border text-center">
            <div className="border-b border-r border-border px-1 py-2.5">
              <Zap className="mx-auto h-3.5 w-3.5 text-brand" />
              <span className="mt-1 block text-[11px] font-medium text-foreground">5–30 sn</span>
              <span className="block text-[9px] text-muted-foreground">teslim</span>
            </div>
            <div className="border-b border-r border-border px-1 py-2.5">
              <ShieldAlert className="mx-auto h-3.5 w-3.5 text-brand" />
              <span className="mt-1 block text-[11px] font-medium text-foreground">%100</span>
              <span className="block text-[9px] text-muted-foreground">iade</span>
            </div>
            <div className="border-b border-r border-border px-1 py-2.5">
              <Clock className="mx-auto h-3.5 w-3.5 text-brand" />
              <span className="mt-1 block text-[11px] font-medium text-foreground">7/24</span>
              <span className="block text-[9px] text-muted-foreground">aktif</span>
            </div>
          </div>
        </section>
      </div>
    </header>
  );
}

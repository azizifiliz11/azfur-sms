"use client";

import React from "react";
import { User, Wallet, Plus, ShieldCheck, RefreshCw, Headphones } from "lucide-react";
import { haptic } from "@/lib/haptic";

interface HeaderProps {
  user: {
    firstName: string;
    username?: string;
    balance: number;
    telegramId: number;
    role?: string;
  } | null;
  onOpenDeposit: () => void;
  onOpenSupport?: () => void;
  onRefreshBalance: () => void;
  isAdmin?: boolean;
  onToggleAdminView?: () => void;
  adminViewActive?: boolean;
}

export function Header({
  user,
  onOpenDeposit,
  onOpenSupport,
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

  const displayName = hasRealFirstName
    ? user.firstName
    : cleanUsername
    ? `@${cleanUsername}`
    : user?.telegramId
    ? `Kullanıcı #${user.telegramId}`
    : "Misafir";

  const initials = hasRealFirstName
    ? user.firstName.slice(0, 2).toUpperCase()
    : cleanUsername
    ? cleanUsername.slice(0, 2).toUpperCase()
    : "AZ";

  return (
    <header className="sticky top-0 z-30 w-full bg-[#090a0f]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between gap-3">
        {/* User Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-white/10 text-emerald-400 font-bold text-sm shadow-inner">
            {initials}
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-[#090a0f]" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-emerald-400 tracking-tight flex items-center gap-0.5">
                ⚡ AzFur
              </span>
              <span className="text-zinc-600">•</span>
              <h2 className="text-xs font-semibold text-white truncate leading-none">
                {displayName}
              </h2>
              {isAdmin && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ADMIN
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
              {cleanUsername ? `@${cleanUsername}` : `ID: ${user?.telegramId || "0"}`}
            </p>
          </div>
        </div>

        {/* Balance & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Balance Pill */}
          <div
            onClick={handleRefreshClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-white/10 shadow-sm cursor-pointer hover:border-emerald-500/40 active:scale-95 transition-all"
            title="Bakiyeyi Yenile"
          >
            {refreshing ? (
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            ) : (
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="font-mono font-bold text-sm text-white">
              ₺{user?.balance !== undefined ? user.balance.toFixed(2) : "0.00"}
            </span>
          </div>

          {/* Deposit Button */}
          <button
            onClick={handleDepositClick}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Yükle</span>
          </button>

          {/* Support / Ticket Button */}
          {onOpenSupport && (
            <button
              onClick={() => {
                haptic.impact("light");
                onOpenSupport();
              }}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-blue-400 border border-white/10 hover:border-blue-500/40 active:scale-95 transition-all relative"
              title="Destek & Ticket"
            >
              <Headphones className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            </button>
          )}

          {/* Admin Switcher */}
          {isAdmin && onToggleAdminView && (
            <button
              onClick={() => {
                haptic.impact("light");
                onToggleAdminView();
              }}
              className={`p-2 rounded-xl border transition-all ${
                adminViewActive
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                  : "bg-zinc-900 text-zinc-400 border-white/10 hover:text-white"
              }`}
              title="Yönetici Paneli"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

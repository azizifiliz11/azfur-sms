"use client";

import React, { useState, useEffect } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { AdminView } from "@/components/AdminView";
import { useTelegram } from "@/hooks/useTelegram";
import { Zap, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
  const { isReady, user: tgUser } = useTelegram();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isReady) return;
    if (!tgUser) {
      setLoading(false);
      return;
    }

    // Yetki kontrolü: Kullanıcı verisini sunucudan doğrula
    fetch(`/api/user/me?telegramId=${tgUser.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch((e) => console.error("Admin user check error:", e))
      .finally(() => setLoading(false));
  }, [isReady, tgUser]);

  const isAdmin = currentUser?.role === "admin";

  return (
    <ClientOnly>
      {!isReady || (loading && tgUser) ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#090a0f]">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
            <Zap className="w-6 h-6 text-emerald-400 absolute" />
          </div>
          <p className="mt-4 text-xs font-semibold text-zinc-400 animate-pulse">
            Yetki Doğrulanıyor...
          </p>
        </div>
      ) : !tgUser || !isAdmin ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#090a0f] text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-xl">
            <Zap className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">AzFur SMS Onay Platformu</h1>
          <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
            Bu uygulama bir <b>Telegram Mini App (TMA)</b> servisidir. Güvenliğiniz ve işlemlerinizin anında gerçekleşmesi için lütfen Telegram botumuz üzerinden başlatınız.
          </p>
        </div>
      ) : (
        <div className="min-h-screen bg-[#090a0f] text-zinc-100 p-4">
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex items-center justify-between pb-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Mini App Görünümüne Dön</span>
              </Link>
            </div>

            <AdminView />
          </div>
        </div>
      )}
    </ClientOnly>
  );
}

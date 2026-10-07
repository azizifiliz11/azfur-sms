"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Percent,
  RefreshCw,
  Users,
  CheckCircle,
  XCircle,
  Sliders,
  Eye,
  EyeOff,
  Zap,
  Activity,
  ArrowUpRight,
  Plus,
  Minus,
  UserX,
  UserCheck,
  Trash2,
  ShieldAlert,
  Search,
  Landmark,
  Loader2,
  Send,
  Megaphone,
  RotateCcw,
  Coins,
} from "lucide-react";
import { Card } from "./tremor/Card";
import { Metric, Text } from "./tremor/Metric";
import { Badge } from "./tremor/Badge";
import { Callout, ProgressBar } from "./tremor/Callout";
import { AreaChart, DonutChart } from "./tremor/Charts";
import { haptic } from "@/lib/haptic";

interface AdminViewProps {
  onBackToApp?: () => void;
}

export function AdminView({ onBackToApp }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "pricing" | "bank" | "users" | "deposits" | "broadcast">("overview");
  const [overview, setOverview] = useState<any>(null);
  const [settingsData, setSettingsData] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Profit engine states
  const [marginPercent, setMarginPercent] = useState<number>(35);
  const [fixedFee, setFixedFee] = useState<number>(5.0);
  const [rateToTry, setRateToTry] = useState<number>(49.2);
  const [mockMode, setMockMode] = useState<boolean>(false);

  // Bank & IBAN states
  const [bankName, setBankName] = useState<string>("Ziraat Bankası");
  const [accountHolder, setAccountHolder] = useState<string>("AzFur SMS");
  const [iban, setIban] = useState<string>("TR00 0000 0000 0000 0000 0000 00");
  const [descriptionNote, setDescriptionNote] = useState<string>("Açıklama alanına Telegram ID'nizi veya kullanıcı adınızı yazınız.");
  const [savingBank, setSavingBank] = useState<boolean>(false);

  // Crypto wallet states
  const [usdtTrc20Address, setUsdtTrc20Address] = useState<string>("");
  const [trxAddress, setTrxAddress] = useState<string>("");
  const [cryptoBotToken, setCryptoBotToken] = useState<string>("");
  const [autoVerifyEnabled, setAutoVerifyEnabled] = useState<boolean>(true);
  const [savingCrypto, setSavingCrypto] = useState<boolean>(false);

  // Broadcast states
  const [broadcastTarget, setBroadcastTarget] = useState<"all" | "user">("all");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [broadcastMessage, setBroadcastMessage] = useState<string>("");
  const [sendingBroadcast, setSendingBroadcast] = useState<boolean>(false);

  // Reset stats state
  const [resettingStats, setResettingStats] = useState<boolean>(false);

  // TCMB automatic rate states
  const [useTcmbAutoRate, setUseTcmbAutoRate] = useState<boolean>(true);
  const [lastTcmbRate, setLastTcmbRate] = useState<number>(49.2);
  const [lastTcmbFetchTime, setLastTcmbFetchTime] = useState<string>("");
  const [tcmbRefreshing, setTcmbRefreshing] = useState<boolean>(false);

  // User management states
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const [userActionLoadingId, setUserActionLoadingId] = useState<number | null>(null);

  // Balance edit modal state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [balanceDelta, setBalanceDelta] = useState<string>("50");

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [ovRes, setRes, uRes, depRes] = await Promise.all([
        fetch("/api/admin/overview", { cache: "no-store" }),
        fetch("/api/admin/settings", { cache: "no-store" }),
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/deposits", { cache: "no-store" }),
      ]);

      const [ov, st, us, dep] = await Promise.all([
        ovRes.json(),
        setRes.json(),
        uRes.json(),
        depRes.json(),
      ]);

      if (ov.success) setOverview(ov);
      if (st.success) {
        setSettingsData(st);
        setMarginPercent(st.settings.globalMarginPercent);
        setFixedFee(st.settings.globalFixedFee);
        setRateToTry(st.settings.exchangeRateToTry);
        setMockMode(st.settings.mockMode);
        setUseTcmbAutoRate(st.settings.useTcmbAutoRate ?? true);
        setLastTcmbRate(st.tcmbRateInfo?.rate || st.settings.lastTcmbRate || 49.2);
        setLastTcmbFetchTime(st.settings.lastTcmbFetchTime || st.tcmbRateInfo?.timestamp || "");
        if (st.settings?.bankInfo) {
          setBankName(st.settings.bankInfo.bankName || "");
          setAccountHolder(st.settings.bankInfo.accountHolder || "");
          setIban(st.settings.bankInfo.iban || "");
          setDescriptionNote(st.settings.bankInfo.descriptionNote || "");
        }
        if (st.settings?.cryptoSettings) {
          setUsdtTrc20Address(st.settings.cryptoSettings.usdtTrc20Address || "");
          setTrxAddress(st.settings.cryptoSettings.trxAddress || "");
          setCryptoBotToken(st.settings.cryptoSettings.cryptoBotToken || "");
          setAutoVerifyEnabled(st.settings.cryptoSettings.autoVerifyEnabled ?? true);
        }
      }
      if (us.success) setUsers(us.users);
      if (dep.success) setDeposits(dep.deposits);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    haptic.impact("medium");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          globalMarginPercent: Number(marginPercent),
          globalFixedFee: Number(fixedFee),
          exchangeRateToTry: Number(rateToTry),
          mockMode,
          useTcmbAutoRate,
        }),
      });

      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg("Kâr marjı, TCMB ve sistem ayarları başarıyla kaydedildi!");
        setTimeout(() => setToastMsg(null), 3000);
      }
    } catch (e) {
      haptic.error();
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRefreshTcmb = async () => {
    setTcmbRefreshing(true);
    haptic.impact("medium");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh_tcmb" }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        const newRate = data.tcmbRateInfo?.rate || data.settings?.lastTcmbRate;
        if (newRate) {
          setRateToTry(newRate);
          setLastTcmbRate(newRate);
        }
        if (data.settings?.lastTcmbFetchTime) {
          setLastTcmbFetchTime(data.settings.lastTcmbFetchTime);
        }
        setToastMsg(`TCMB Canlı Kuru Alındı: ₺${Number(newRate).toFixed(4)}`);
        setTimeout(() => setToastMsg(null), 3500);
      } else {
        haptic.error();
        alert(data.error || "TCMB kuru güncellenemedi");
      }
    } catch (e) {
      haptic.error();
      alert("TCMB servisine bağlanılamadı");
    } finally {
      setTcmbRefreshing(false);
    }
  };

  const handleToggleHideService = async (code: string) => {
    if (!settingsData?.settings) return;
    haptic.selection();
    const hidden: string[] = settingsData.settings.hiddenServices || [];
    const newHidden = hidden.includes(code) ? hidden.filter((c) => c !== code) : [...hidden, code];

    setSettingsData({
      ...settingsData,
      settings: { ...settingsData.settings, hiddenServices: newHidden },
    });

    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hiddenServices: newHidden }),
    });
  };

  const handleToggleHideCountry = async (id: number) => {
    if (!settingsData?.settings) return;
    haptic.selection();
    const hidden: number[] = settingsData.settings.hiddenCountries || [];
    const newHidden = hidden.includes(id) ? hidden.filter((c) => c !== id) : [...hidden, id];

    setSettingsData({
      ...settingsData,
      settings: { ...settingsData.settings, hiddenCountries: newHidden },
    });

    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hiddenCountries: newHidden }),
    });
  };

  const handleDepositAction = async (depositId: string, status: "APPROVED" | "REJECTED") => {
    haptic.impact("medium");
    // Anında arayüzde talebin durumunu güncelle (0 gecikme)
    setDeposits((prev) =>
      prev.map((d) => (d.id === depositId ? { ...d, status } : d))
    );

    try {
      const res = await fetch("/api/admin/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositId, status }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        // Eğer kullanıcı verisi döndüyse anında bakiye listesinde güncelle
        if (data.user) {
          setUsers((prev) =>
            prev.map((u) => (u.telegramId === data.user.telegramId ? data.user : u))
          );
        }
        setToastMsg(status === "APPROVED" ? "Bakiye onaylandı ve hesaba eklendi!" : "Talep reddedildi.");
        setTimeout(() => setToastMsg(null), 3000);
        fetchAllData();
      }
    } catch (e) {
      haptic.error();
    }
  };

  const handleAdjustBalance = async (isAdd: boolean) => {
    if (!editingUser) return;
    const amount = parseFloat(balanceDelta);
    if (isNaN(amount) || amount <= 0) return;

    const delta = isAdd ? amount : -amount;
    haptic.impact("heavy");

    // Anında modalı kapat ve kullanıcı listesinde optimistik güncelle (0 gecikme)
    const targetId = editingUser.telegramId;
    const optimisticNewBalance = Math.max(0, Number((editingUser.balance + delta).toFixed(2)));
    setUsers((prev) =>
      prev.map((u) => (u.telegramId === targetId ? { ...u, balance: optimisticNewBalance } : u))
    );
    setEditingUser(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: targetId,
          delta,
          reason: "Admin manuel işlem",
        }),
      });

      const data = await res.json();
      if (data.success) {
        haptic.success();
        if (data.user) {
          setUsers((prev) =>
            prev.map((u) => (u.telegramId === data.user.telegramId ? data.user : u))
          );
        }
        setToastMsg(`Bakiye güncellendi: ${isAdd ? "+" : "-"}₺${amount.toFixed(2)} (Yeni: ₺${data.user?.balance?.toFixed(2) || optimisticNewBalance.toFixed(2)})`);
        setTimeout(() => setToastMsg(null), 3000);
        fetchAllData();
      } else {
        haptic.error();
        alert(data.error || "Bakiye güncellenemedi");
        fetchAllData();
      }
    } catch (e) {
      haptic.error();
      fetchAllData();
    }
  };

  // İstatistikleri Sıfırla
  const handleResetStats = async () => {
    if (
      !confirm(
        "⚠️ DİKKAT: Tüm sipariş geçmişi, toplam ciro ve harcama istatistikleri sıfırlanacaktır!\n\nBu işlem geri alınamaz. Sıfırlamak istediğinize emin misiniz?"
      )
    ) {
      return;
    }

    setResettingStats(true);
    haptic.impact("heavy");
    try {
      const res = await fetch("/api/admin/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_stats" }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg("İstatistikler ve sipariş geçmişi başarıyla sıfırlandı!");
        setTimeout(() => setToastMsg(null), 3500);
        fetchAllData();
      } else {
        haptic.error();
        alert(data.error || "Sıfırlama başarısız oldu");
      }
    } catch {
      haptic.error();
      alert("Hata oluştu");
    } finally {
      setResettingStats(false);
    }
  };

  // Banka ve IBAN Kaydet
  const handleSaveBankInfo = async () => {
    setSavingBank(true);
    haptic.impact("medium");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankInfo: {
            bankName,
            accountHolder,
            iban,
            descriptionNote,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg("Banka ve IBAN bilgileri başarıyla kaydedildi!");
        setTimeout(() => setToastMsg(null), 3000);
        fetchAllData();
      } else {
        haptic.error();
        alert(data.error || "Kayıt başarısız");
      }
    } catch {
      haptic.error();
      alert("Hata oluştu");
    } finally {
      setSavingBank(false);
    }
  };

  // Kripto Cüzdan Ayarlarını Kaydet
  const handleSaveCryptoSettings = async () => {
    setSavingCrypto(true);
    haptic.impact("medium");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cryptoSettings: {
            usdtTrc20Address,
            trxAddress,
            cryptoBotToken,
            autoVerifyEnabled,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg("Kripto cüzdan ayarları başarıyla kaydedildi!");
        setTimeout(() => setToastMsg(null), 3000);
        fetchAllData();
      } else {
        haptic.error();
        alert(data.error || "Kayıt başarısız");
      }
    } catch {
      haptic.error();
      alert("Hata oluştu");
    } finally {
      setSavingCrypto(false);
    }
  };

  // Duyuru / Mesaj Gönder
  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      alert("Lütfen gönderilecek mesajı yazınız.");
      return;
    }
    if (broadcastTarget === "user" && !selectedUserId) {
      alert("Lütfen mesaj gönderilecek kullanıcıyı seçiniz.");
      return;
    }

    const targetDesc =
      broadcastTarget === "all"
        ? `tüm ${users.length} kayıtlı kullanıcıya toplu duyuru olarak`
        : `${selectedUserId} ID'li kullanıcıya özel mesaj olarak`;

    if (!confirm(`Mesaj ${targetDesc} gönderilecektir. Devam etmek istiyor musunuz?`)) {
      return;
    }

    setSendingBroadcast(true);
    haptic.impact("heavy");
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: broadcastTarget,
          telegramId: selectedUserId,
          message: broadcastMessage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg(data.message);
        setTimeout(() => setToastMsg(null), 4000);
        setBroadcastMessage("");
      } else {
        haptic.error();
        alert(data.error || "Gönderim başarısız");
      }
    } catch {
      haptic.error();
      alert("Hata oluştu");
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Kullanıcı Banla / Engeli Kaldır
  const handleToggleBan = async (user: any) => {
    const nextBanStatus = !user.isBanned;
    if (
      !confirm(
        nextBanStatus
          ? `${user.firstName || user.telegramId} adlı kullanıcıyı engellemek (banlamak) istiyor musunuz? Kullanıcı yeni numara kiralayamaz.`
          : `${user.firstName || user.telegramId} adlı kullanıcının engelini kaldırmak istiyor musunuz?`
      )
    ) {
      return;
    }

    setUserActionLoadingId(user.telegramId);
    haptic.impact("heavy");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_ban",
          telegramId: user.telegramId,
          isBanned: nextBanStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg(data.message);
        setTimeout(() => setToastMsg(null), 3000);
        fetchAllData();
      } else {
        haptic.error();
        alert(data.error || "İşlem başarısız");
      }
    } catch (e) {
      haptic.error();
      alert("Hata oluştu");
    } finally {
      setUserActionLoadingId(null);
    }
  };

  // Admin Rolü Ver / Kaldır
  const handleToggleRole = async (user: any) => {
    const nextRole = user.role === "admin" ? "user" : "admin";
    if (
      !confirm(
        nextRole === "admin"
          ? `${user.firstName || user.telegramId} kullanıcısına YÖNETİCİ (Admin) yetkisi vermek istediğinize emin misiniz?`
          : `${user.firstName || user.telegramId} kullanıcısının admin yetkisini geri almak istediğinize emin misiniz?`
      )
    ) {
      return;
    }

    setUserActionLoadingId(user.telegramId);
    haptic.impact("heavy");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_role",
          telegramId: user.telegramId,
          role: nextRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg(data.message);
        setTimeout(() => setToastMsg(null), 3000);
        fetchAllData();
      } else {
        haptic.error();
        alert(data.error || "İşlem başarısız");
      }
    } catch (e) {
      haptic.error();
      alert("Hata oluştu");
    } finally {
      setUserActionLoadingId(null);
    }
  };

  // Kullanıcıyı Kalıcı Olarak Sil
  const handleDeleteUser = async (user: any) => {
    if (
      !confirm(
        `DİKKAT: ${user.firstName || user.telegramId} kullanıcısını sistemden ve veritabanından KALICI OLARAK silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`
      )
    ) {
      return;
    }

    setUserActionLoadingId(user.telegramId);
    haptic.impact("heavy");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_user",
          telegramId: user.telegramId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg("Kullanıcı başarıyla silindi");
        setTimeout(() => setToastMsg(null), 3000);
        fetchAllData();
      } else {
        haptic.error();
        alert(data.error || "Silinemedi");
      }
    } catch (e) {
      haptic.error();
      alert("Hata oluştu");
    } finally {
      setUserActionLoadingId(null);
    }
  };

  // Filtrelenmiş Kullanıcı Listesi
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return users;
    const q = userSearchQuery.toLowerCase();
    return users.filter(
      (u) =>
        (u.firstName && u.firstName.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        String(u.telegramId).includes(q)
    );
  }, [users, userSearchQuery]);

  return (
    <div className="space-y-4 pb-12">
      {/* Top Banner */}
      <div className="flex items-center justify-between bg-zinc-900/90 border border-white/10 rounded-2xl p-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>AzFur Yönetici Paneli</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                CANLI
              </span>
            </h2>
            <p className="text-[11px] text-zinc-400">Tüm sistem kontrolü, TCMB kur entegrasyonu ve kullanıcı yönetimi</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              haptic.impact("light");
              fetchAllData();
            }}
            className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
            title="Yenile"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 font-semibold transition-colors"
            >
              Uygulamaya Dön
            </button>
          )}
        </div>
      </div>

      {toastMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-semibold animate-in fade-in">
          {toastMsg}
        </div>
      )}

      {/* Admin Tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 bg-zinc-900/70 p-1.5 rounded-2xl border border-white/5 text-xs font-semibold">
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("overview");
          }}
          className={`py-2 px-1 rounded-xl transition-all text-center ${
            activeTab === "overview"
              ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Genel Bakış
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("pricing");
          }}
          className={`py-2 px-1 rounded-xl transition-all text-center ${
            activeTab === "pricing"
              ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Fiyat / Kâr
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("bank");
          }}
          className={`py-2 px-1 rounded-xl transition-all text-center ${
            activeTab === "bank"
              ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Banka & Kripto
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("users");
          }}
          className={`py-2 px-1 rounded-xl transition-all text-center ${
            activeTab === "users"
              ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Kullanıcı ({users.length})
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("deposits");
          }}
          className={`py-2 px-1 rounded-xl transition-all text-center ${
            activeTab === "deposits"
              ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Talepler ({deposits.filter((d) => d.status === "PENDING").length})
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("broadcast");
          }}
          className={`py-2 px-1 rounded-xl transition-all text-center ${
            activeTab === "broadcast"
              ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Duyuru & Mesaj
        </button>
      </div>

      {/* TAB 1: OVERVIEW & METRICS */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Servis Sağlayıcı Kasa Monitörü */}
          <Card className="p-4 bg-gradient-to-br from-[#12141e] to-[#0c0e15] border-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <Text>Servis Sağlayıcı Kasası</Text>
                <Metric isMono={true} className="mt-1 text-blue-400">
                  ${overview?.provider?.balance?.toFixed(2) || "0.00"}
                </Metric>
                <div className="text-[11px] font-mono text-zinc-400 mt-1">
                  API Durumu: <span className="text-zinc-200">{overview?.provider?.raw || "Online"}</span>
                </div>
              </div>

              <div className="text-right">
                <Badge color={overview?.provider?.balance > 0 ? "emerald" : "amber"}>
                  {overview?.provider?.balance > 0 ? "Bakiye Yeterli" : "Kasa 0 (Mock Aktif)"}
                </Badge>
                <p className="text-[10px] text-zinc-500 mt-2">Altyapı: AzFur SMS Motoru</p>
              </div>
            </div>
          </Card>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3.5">
              <Text>Toplam Ciro</Text>
              <Metric isMono={true} className="text-emerald-400 mt-1">
                ₺{overview?.stats?.totalRevenue?.toFixed(2) || "0.00"}
              </Metric>
              <div className="text-[11px] text-zinc-400 mt-1">Net Kâr: ₺{overview?.stats?.totalProfit?.toFixed(2) || "0.00"}</div>
            </Card>

            <Card className="p-3.5">
              <Text>Aktif Kullanıcı</Text>
              <Metric isMono={true} className="text-white mt-1">
                {overview?.stats?.totalUsers || 0}
              </Metric>
              <div className="text-[11px] text-zinc-400 mt-1">Toplam {overview?.stats?.totalActivations || 0} Sipariş</div>
            </Card>
          </div>

          {/* Callout: Kâr Durumu */}
          <Callout
            title="Dinamik Kâr Marjı Aktif"
            color="emerald"
          >
            {`Sistem alış maliyetleri üzerine %${marginPercent} marj ve ₺${fixedFee} sabit servis bedeli ekleyerek fiyatları otomatik belirler.`}
          </Callout>

          {/* İstatistikleri Sıfırla Kartı */}
          <Card className="p-3.5 bg-rose-950/20 border-rose-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">İstatistikleri Sıfırla</h4>
                <p className="text-[11px] text-zinc-400">Ciro, sipariş geçmişi ve harcama sayaçlarını temizler</p>
              </div>
            </div>

            <button
              onClick={handleResetStats}
              disabled={resettingStats}
              className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {resettingStats ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sıfırlanıyor...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>İstatistikleri Sıfırla</span>
                </>
              )}
            </button>
          </Card>

          {/* Area Chart: 7 Günlük Gelir Grafiği */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Son 7 Günlük Gelir Trendi
                </h4>
                <p className="text-[11px] text-zinc-500">Günlük ciro ve kâr akışı</p>
              </div>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>

            <AreaChart data={overview?.revenueTrend || overview?.chartDaily || []} />
          </Card>

          {/* Donut Chart: En Çok Satan Servisler */}
          <Card className="p-4 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                En Çok Tercih Edilen Servisler
              </h4>
              <p className="text-[11px] text-zinc-500">Satış adetlerine göre dağılım</p>
            </div>
            <DonutChart data={overview?.chartServices || []} />
          </Card>
        </div>
      )}

      {/* TAB 2: PRICING & DYNAMIC PROFIT ENGINE */}
      {activeTab === "pricing" && (
        <div className="space-y-4">
          {/* TCMB Otomatik Kur Kartı */}
          <Card className="p-4 space-y-3 bg-gradient-to-br from-[#10141f] to-[#0c0e15] border-blue-500/40 shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>TCMB Canlı Döviz Kuru (USD/TRY)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Resmi XML
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Fiyatlar TCMB resmi kuruna göre otomatik çevrilir
                  </p>
                </div>
              </div>

              <button
                onClick={handleRefreshTcmb}
                disabled={tcmbRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-xs font-semibold transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${tcmbRefreshing ? "animate-spin" : ""}`} />
                <span>{tcmbRefreshing ? "Çekiliyor..." : "Kuru Güncelle"}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-zinc-900/80 p-3 rounded-xl border border-white/5">
                <span className="text-[11px] text-zinc-400 block">Güncel TCMB Dolar Kuru:</span>
                <span className="text-xl font-bold font-mono text-blue-400 block mt-0.5">
                  ₺{lastTcmbRate.toFixed(4)}
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  {lastTcmbFetchTime ? `Son çekilme: ${lastTcmbFetchTime}` : "Otomatik senkronize"}
                </span>
              </div>

              <div className="bg-zinc-900/80 p-3 rounded-xl border border-white/5 flex flex-col justify-between">
                <span className="text-[11px] text-zinc-400 block">Kullanılan Kur Kaynağı:</span>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="tcmbToggle"
                    checked={useTcmbAutoRate}
                    onChange={(e) => setUseTcmbAutoRate(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                  <label htmlFor="tcmbToggle" className="text-xs font-semibold text-white cursor-pointer">
                    {useTcmbAutoRate ? "Otomatik TCMB Aktif" : "Manuel Kur Kullan"}
                  </label>
                </div>
                <span className="text-[10px] text-emerald-400 block mt-1">
                  {useTcmbAutoRate ? "✓ 30 dk aralıkla otomatik güncellenir" : "Sabit manuel kur geçerli"}
                </span>
              </div>
            </div>
          </Card>

          {/* Kâr Motoru Kartı */}
          <Card className="p-4 space-y-4 border-emerald-500/30">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <span>Dinamik Kâr Marjı Motoru</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Sağlayıcı alış fiyatı üzerine kâr ve kur kurallarını belirleyin.
                </p>
              </div>
            </div>

            {/* Margin Percent Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300 font-medium">Genel Kâr Marjı Oranı:</span>
                <span className="font-mono font-bold text-emerald-400">%{marginPercent}</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="150"
                  step="5"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(Number(e.target.value))}
                  className="w-full accent-emerald-500 h-2 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <input
                  type="number"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(Number(e.target.value))}
                  className="w-20 bg-zinc-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white text-center"
                />
              </div>
            </div>

            {/* Fixed Fee Addition */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300 font-medium">Sabit Ek Hizmet Ücreti (₺):</span>
                <span className="font-mono font-bold text-emerald-400">₺{fixedFee.toFixed(2)}</span>
              </div>
              <input
                type="number"
                step="0.5"
                value={fixedFee}
                onChange={(e) => setFixedFee(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white"
                placeholder="Örn: 5.00"
              />
            </div>

            {/* Exchange Rate To TRY */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300 font-medium">
                  {useTcmbAutoRate ? "TCMB Canlı Kur Değeri:" : "Manuel Dolar / TL Kuru:"}
                </span>
                <span className="font-mono font-bold text-blue-400">₺{rateToTry.toFixed(2)}</span>
              </div>
              <input
                type="number"
                step="0.1"
                value={rateToTry}
                onChange={(e) => setRateToTry(Number(e.target.value))}
                disabled={useTcmbAutoRate}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Örn: 49.20"
              />
              {useTcmbAutoRate && (
                <p className="text-[10px] text-zinc-500">
                  Otomatik TCMB kuru açık olduğu için bu alan canlı TCMB bülteninden çekilir.
                </p>
              )}
            </div>

            {/* Mock / Test Mode Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-white/10">
              <div>
                <span className="text-xs font-bold text-white block">Mock / Test Modu</span>
                <span className="text-[11px] text-zinc-400 block mt-0.5">
                  Sağlayıcı bakiyesi 0 iken gerçekçi OTP simülasyonu çalıştırır.
                </span>
              </div>
              <input
                type="checkbox"
                checked={mockMode}
                onChange={(e) => setMockMode(e.target.checked)}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {savingSettings ? "Kaydediliyor..." : "Ayarları Kaydet & Fiyatları Güncelle"}
            </button>
          </Card>

          {/* Hide / Show Services Toggles */}
          <Card className="p-4 space-y-3">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>Servis Görünürlük Kontrolü</span>
            </h4>
            <p className="text-[11px] text-zinc-400">
              Kullanıcıların görmesini istemediğiniz servisleri tek tıkla gizleyin.
            </p>

            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {(settingsData?.allServices || []).slice(0, 24).map((s: any) => {
                const isHidden = settingsData?.settings?.hiddenServices?.includes(s.code);
                return (
                  <div
                    key={s.code}
                    onClick={() => handleToggleHideService(s.code)}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                      isHidden
                        ? "bg-rose-950/20 border-rose-500/30 text-rose-300"
                        : "bg-zinc-900 border-white/5 text-zinc-200 hover:border-white/20"
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                    {isHidden ? <EyeOff className="w-3.5 h-3.5 text-rose-400" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* TAB: BANK & IBAN MANAGEMENT */}
      {activeTab === "bank" && (
        <div className="space-y-4">
          <Card className="p-4 space-y-4 border-blue-500/30">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Havale / EFT Banka Bilgileri</h3>
                  <p className="text-[11px] text-zinc-400">
                    Kullanıcılar bakiye yükleme ekranında bu bilgileri görür ve IBAN&apos;ı kopyalayabilir
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Banka Adı</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Örn: Ziraat Bankası, Garanti BBVA"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Alıcı / Hesap Sahibi</label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Örn: AzFur SMS / Ad Soyad"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">IBAN Numarası</label>
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="Örn: TR00 0000 0000 0000 0000 0000 00"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Açıklama / Havale Notu</label>
                <input
                  type="text"
                  value={descriptionNote}
                  onChange={(e) => setDescriptionNote(e.target.value)}
                  placeholder="Örn: Açıklama alanına Telegram ID'nizi yazmayı unutmayınız."
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Canlı Önizleme Kartı */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                Kullanıcı Ekranında Nasıl Görünür?
              </span>
              <div className="flex justify-between">
                <span className="text-zinc-400">Banka:</span>
                <span className="font-semibold text-white">{bankName || "Banka belirtilmedi"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Alıcı:</span>
                <span className="font-semibold text-white">{accountHolder || "Alıcı belirtilmedi"}</span>
              </div>
              <div className="p-2 rounded-lg bg-zinc-900 border border-white/10 font-mono text-emerald-400 text-[11px] font-bold">
                {iban || "TR..."}
              </div>
              <p className="text-[11px] text-amber-400">💡 {descriptionNote}</p>
            </div>

            <button
              onClick={handleSaveBankInfo}
              disabled={savingBank}
              className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-black font-bold text-xs shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingBank ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <span>Banka ve IBAN Bilgilerini Kaydet</span>
              )}
            </button>
          </Card>

          {/* Otomatik Kripto (TRX & USDT) Cüzdan Ayarları */}
          <Card className="p-4 space-y-4 border-emerald-500/30">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Otomatik Kripto (TRX & USDT) Ödeme Ayarları</h3>
                  <p className="text-[11px] text-zinc-400">
                    Kullanıcılar bu adrese transfer yapıp TXID yapıştırdığında TronScan ile anında otomatik bakiye eklenir
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">USDT (TRC-20) Cüzdan Adresi</label>
                <input
                  type="text"
                  value={usdtTrc20Address}
                  onChange={(e) => setUsdtTrc20Address(e.target.value)}
                  placeholder="Örn: T9yD14Nj9j7xAB4dbGeiX9h8unkKHXUnC"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">TRX (Tron) Cüzdan Adresi</label>
                <input
                  type="text"
                  value={trxAddress}
                  onChange={(e) => setTrxAddress(e.target.value)}
                  placeholder="Örn: T9yD14Nj9j7xAB4dbGeiX9h8unkKHXUnC"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-white/5">
                <div>
                  <span className="text-xs font-semibold text-white block">TronScan Canlı Otomatik Onay</span>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">
                    Kullanıcı işlem kodunu girdiğinde sistem Tron ağında transferi doğrular ve bakiyeyi anında yükler.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoVerifyEnabled}
                  onChange={(e) => setAutoVerifyEnabled(e.target.checked)}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">CryptoBot API Token (Opsiyonel @CryptoBot)</label>
                <input
                  type="password"
                  value={cryptoBotToken}
                  onChange={(e) => setCryptoBotToken(e.target.value)}
                  placeholder="Örn: 12345:AA..."
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={handleSaveCryptoSettings}
              disabled={savingCrypto}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingCrypto ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <span>Kripto Cüzdan Ayarlarını Kaydet</span>
              )}
            </button>
          </Card>
        </div>
      )}

      {/* TAB 3: USERS & FULL MANAGEMENT (BAN, ROLE, DELETE, BALANCE) */}
      {activeTab === "users" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Kayıtlı Telegram Kullanıcıları ({users.length})</span>
            </h3>
            <span className="text-[11px] text-zinc-400">Kullanıcı & Yetki Yönetimi</span>
          </div>

          {/* Arama Çubuğu */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="İsim, kullanıcı adı (@) veya Telegram ID ara..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/90 border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {filteredUsers.length === 0 ? (
            <Card className="p-6 text-center text-xs text-zinc-500">
              Arama kriterinize uygun kullanıcı bulunamadı.
            </Card>
          ) : (
            <div className="space-y-2.5">
              {filteredUsers.map((u) => {
                const isActionLoading = userActionLoadingId === u.telegramId;
                return (
                  <Card key={u.telegramId} className="p-3.5 space-y-3 border-white/10 hover:border-white/20 transition-all">
                    {/* Üst Kısım: Kullanıcı Bilgisi & Rozetler */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-white truncate">
                            {u.firstName} {u.lastName || ""}
                          </span>

                          {/* Rozetler */}
                          {u.isBanned ? (
                            <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded font-bold">
                              ⛔ BANLI
                            </span>
                          ) : u.role === "admin" ? (
                            <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded font-bold">
                              👑 ADMIN
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded font-semibold">
                              ✓ AKTİF
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] font-mono text-zinc-400 mt-0.5 truncate">
                          ID: <span className="text-zinc-200">{u.telegramId}</span> • @{u.username || "kullanıcı adı yok"}
                        </div>
                      </div>

                      {/* Bakiye & Harcama */}
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-sm text-emerald-400">
                          ₺{u.balance.toFixed(2)}
                        </div>
                        <span className="text-[10px] text-zinc-500 block">
                          Harcama: ₺{u.spent || 0}
                        </span>
                      </div>
                    </div>

                    {/* Alt Kısım: Hızlı Yönetici Aksiyonları */}
                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-1.5 flex-wrap">
                      {/* Bakiye Düzenle */}
                      <button
                        onClick={() => {
                          haptic.impact("light");
                          setEditingUser(u);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-all"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Bakiye Yönet</span>
                      </button>

                      {/* Admin Rolü Ver / Al */}
                      <button
                        onClick={() => handleToggleRole(u)}
                        disabled={isActionLoading}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                          u.role === "admin"
                            ? "bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/40 text-purple-300"
                            : "bg-zinc-800 hover:bg-zinc-700 border-white/10 text-zinc-300"
                        }`}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>{u.role === "admin" ? "Adminliği Al" : "Admin Yap"}</span>
                      </button>

                      {/* Banla / Engeli Kaldır */}
                      <button
                        onClick={() => handleToggleBan(u)}
                        disabled={isActionLoading}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                          u.isBanned
                            ? "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-300"
                            : "bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 text-amber-300"
                        }`}
                      >
                        {u.isBanned ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Engeli Aç</span>
                          </>
                        ) : (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            <span>Banla</span>
                          </>
                        )}
                      </button>

                      {/* Sil */}
                      <button
                        onClick={() => handleDeleteUser(u)}
                        disabled={isActionLoading}
                        className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs transition-all"
                        title="Kullanıcıyı Kalıcı Olarak Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DEPOSIT REQUESTS */}
      {activeTab === "deposits" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Bakiye Yükleme Talepleri ({deposits.length})
            </h3>
            <span className="text-[11px] text-zinc-400">Onay Bekleyenler</span>
          </div>

          {deposits.length === 0 ? (
            <Card className="p-6 text-center text-xs text-zinc-500">
              Henüz bakiye yükleme talebi bulunmuyor.
            </Card>
          ) : (
            <div className="space-y-2">
              {deposits.map((dep) => (
                <Card key={dep.id} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-white">
                        {dep.username || `Kullanıcı ${dep.telegramId}`}
                      </span>
                      <p className="text-[11px] font-mono text-zinc-400">
                        {dep.method} • {dep.referenceCode}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-sm text-emerald-400">
                        +₺{dep.amount.toFixed(2)}
                      </span>
                      <div>
                        {dep.status === "PENDING" ? (
                          <Badge color="amber" size="sm">
                            Onay Bekliyor
                          </Badge>
                        ) : dep.status === "APPROVED" ? (
                          <Badge color="emerald" size="sm">
                            Onaylandı
                          </Badge>
                        ) : (
                          <Badge color="rose" size="sm">
                            Reddedildi
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {dep.status === "PENDING" && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.04]">
                      <button
                        onClick={() => handleDepositAction(dep.id, "REJECTED")}
                        className="px-3 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-xs font-semibold hover:bg-rose-500/25"
                      >
                        Reddet
                      </button>
                      <button
                        onClick={() => handleDepositAction(dep.id, "APPROVED")}
                        className="px-3 py-1 rounded-lg bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 shadow-md shadow-emerald-500/20"
                      >
                        Onayla & Hesaba Ekle
                      </button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: BROADCAST & MESSAGING */}
      {activeTab === "broadcast" && (
        <div className="space-y-4">
          <Card className="p-4 space-y-4 border-purple-500/30">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Telegram Duyuru ve Mesaj Gönder</h3>
                  <p className="text-[11px] text-zinc-400">
                    Kullanıcılara bot üzerinden doğrudan mesaj veya genel duyuru iletin
                  </p>
                </div>
              </div>
            </div>

            {/* Hedef Seçimi */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 block">Mesaj Hedefi</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setBroadcastTarget("all");
                  }}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    broadcastTarget === "all"
                      ? "bg-purple-500/20 border-purple-500 text-purple-300 shadow-sm"
                      : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Tüm Kullanıcılar ({users.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setBroadcastTarget("user");
                  }}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    broadcastTarget === "user"
                      ? "bg-purple-500/20 border-purple-500 text-purple-300 shadow-sm"
                      : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>Belirli Bir Kullanıcı</span>
                </button>
              </div>
            </div>

            {/* Belirli Kullanıcı Seçimi */}
            {broadcastTarget === "user" && (
              <div className="space-y-1.5 p-3 rounded-xl bg-zinc-900 border border-white/5">
                <label className="text-xs font-semibold text-zinc-300">Hedef Kullanıcı Seçin</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-[#181a24] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- Kullanıcı Seçiniz --</option>
                  {users.map((u) => (
                    <option key={u.telegramId} value={u.telegramId}>
                      {u.firstName || "İsimsiz"} (@{u.username || "yok"}) - ID: {u.telegramId} (Bakiye: ₺{u.balance})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Veya Telegram ID giriniz"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full mt-2 bg-[#181a24] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            )}

            {/* Hızlı Şablonlar */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-zinc-400 font-medium">Hızlı Şablonlar:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    label: "📢 Sistem Duyurusu",
                    text: "📢 <b>SİSTEM DUYURUSU</b>\n\nDeğerli kullanıcılarımız, sistemimize yeni ülke ve servis numaraları eklenmiştir. Hemen dilediğiniz servisi kiralayabilirsiniz!",
                  },
                  {
                    label: "🎁 Bakiye Kampanyası",
                    text: "🎁 <b>ÖZEL KAMPANYA!</b>\n\nBugüne özel bakiye yüklemelerinizde avantajlı fırsatlar sizleri bekliyor. Fırsatı kaçırmayın!",
                  },
                  {
                    label: "⚡ Bilgilendirme",
                    text: "⚡ <b>BİLGİLENDİRME</b>\n\nNumara kiralama ve SMS onay işlemleriniz kesintisiz devam etmektedir. İyi kullanımlar dileriz!",
                  },
                ].map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => setBroadcastMessage(tpl.text)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/5 hover:border-white/20 text-[11px] text-zinc-300 transition-colors"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mesaj Metni */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Mesaj Metni (HTML Destekli)</label>
              <textarea
                rows={5}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Göndermek istediğiniz mesajı buraya yazınız... (Örn: <b>Kalın</b>, <i>İtalik</i>, <code>Kod</code> vb.)"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-sans"
              />
              <p className="text-[10px] text-zinc-500">
                Telegram HTML etiketleri kullanılabilir: &lt;b&gt;kalın&lt;/b&gt;, &lt;i&gt;italik&lt;/i&gt;, &lt;code&gt;kod&lt;/code&gt;
              </p>
            </div>

            {/* Gönder Butonu */}
            <button
              onClick={handleSendBroadcast}
              disabled={sendingBroadcast || !broadcastMessage.trim()}
              className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/25 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sendingBroadcast ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mesaj Gönderiliyor...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>
                    {broadcastTarget === "all"
                      ? `Tüm Kullanıcılara Gönder (${users.length} Kişi)`
                      : "Kullanıcıya Gönder"}
                  </span>
                </>
              )}
            </button>
          </Card>
        </div>
      )}

      {/* Manual Balance Adjustment Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#11131a] border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Bakiye Düzenle: {editingUser.firstName}
                </h3>
                <p className="text-[11px] text-zinc-400 font-mono">
                  Telegram ID: {editingUser.telegramId}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-zinc-500 block">Mevcut Bakiye</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  ₺{editingUser.balance.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Hızlı Miktar Butonları */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-zinc-400 font-medium">Hızlı Tutarlar:</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[20, 50, 100, 250].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBalanceDelta(String(val))}
                    className="py-1 px-2 rounded-lg bg-zinc-900 border border-white/5 hover:border-white/20 text-xs font-mono text-zinc-300"
                  >
                    +{val}₺
                  </button>
                ))}
              </div>
            </div>

            {/* Özel Miktar Girişi */}
            <div className="space-y-1">
              <span className="text-[11px] text-zinc-400 font-medium">Özel Tutar (₺):</span>
              <input
                type="number"
                value={balanceDelta}
                onChange={(e) => setBalanceDelta(e.target.value)}
                placeholder="Örn: 50"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Ekle / Düş Butonları */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => handleAdjustBalance(false)}
                className="py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Minus className="w-4 h-4" />
                <span>Bakiye Düş</span>
              </button>
              <button
                onClick={() => handleAdjustBalance(true)}
                className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Bakiye Ekle</span>
              </button>
            </div>

            <button
              onClick={() => setEditingUser(null)}
              className="w-full py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Kapat / Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

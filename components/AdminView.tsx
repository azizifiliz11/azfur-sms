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
  MessageSquare,
  Headphones,
  LifeBuoy,
  Clock,
  X,
  Sparkles,
  Save,
  Key,
  Copy,
  Check,
  Bot,
  Gift,
  Tag,
  Ticket,
  Phone,
  ExternalLink,
  Calendar,
  Hash,
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
  const [activeTab, setActiveTab] = useState<"overview" | "pricing" | "bank" | "users" | "deposits" | "broadcast" | "tickets" | "coupons">("overview");
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
  const [oxapayApiKey, setOxapayApiKey] = useState<string>("");
  const [autoVerifyEnabled, setAutoVerifyEnabled] = useState<boolean>(true);
  const [savingCrypto, setSavingCrypto] = useState<boolean>(false);
  const [testingOxapay, setTestingOxapay] = useState<boolean>(false);
  const [oxapayTestResult, setOxapayTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);
  const [settingWebhook, setSettingWebhook] = useState<boolean>(false);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [copiedTgWebhook, setCopiedTgWebhook] = useState<boolean>(false);

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

  // User detail inspection states (Tüm numaralar, SMS kodları, yüklemeler, detaylar)
  const [selectedUserDetail, setSelectedUserDetail] = useState<any | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState<boolean>(false);
  const [userActivations, setUserActivations] = useState<any[]>([]);
  const [userDeposits, setUserDeposits] = useState<any[]>([]);
  const [userTickets, setUserTickets] = useState<any[]>([]);
  const [userDetailTab, setUserDetailTab] = useState<"numbers" | "deposits" | "tickets" | "actions">("numbers");
  const [copiedDetailText, setCopiedDetailText] = useState<string | null>(null);

  // Balance edit modal state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [balanceDelta, setBalanceDelta] = useState<string>("50");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Support & Tickets states
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState<string>("Merhaba, talebiniz incelenmiştir. ");
  const [sendingTicketReply, setSendingTicketReply] = useState<boolean>(false);
  const [ticketFilter, setTicketFilter] = useState<"ALL" | "OPEN" | "ANSWERED" | "CLOSED">("ALL");

  // Support Telegram Usernames states
  const [supportTelegramUsername, setSupportTelegramUsername] = useState<string>("");
  const [supportTelegramUsernames, setSupportTelegramUsernames] = useState<string[]>([]);
  const [newSupportUsername, setNewSupportUsername] = useState<string>("");
  const [savingSupportUser, setSavingSupportUser] = useState<boolean>(false);

  // Custom Animated Sticker state
  const [customStickerFileId, setCustomStickerFileId] = useState<string>("");
  const [savingSticker, setSavingSticker] = useState<boolean>(false);

  // Hero-SMS API Key states
  const [heroSmsApiKey, setHeroSmsApiKey] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [savingApiKey, setSavingApiKey] = useState<boolean>(false);
  const [testingApiKey, setTestingApiKey] = useState<boolean>(false);
  const [apiKeyTestResult, setApiKeyTestResult] = useState<{ success: boolean; message: string; balance?: number } | null>(null);

  // Custom Country & Service Price Rules states
  const [customPriceRules, setCustomPriceRules] = useState<Record<string, any>>({});
  const [ruleCountryId, setRuleCountryId] = useState<number>(62);
  const [ruleServiceCode, setRuleServiceCode] = useState<string>("wa");
  const [ruleType, setRuleType] = useState<"fixed" | "margin">("fixed");
  const [ruleFixedPrice, setRuleFixedPrice] = useState<string>("15.00");
  const [ruleMarginPercent, setRuleMarginPercent] = useState<string>("50");
  const [ruleFixedFee, setRuleFixedFee] = useState<string>("5.00");
  const [savingRule, setSavingRule] = useState<boolean>(false);

  // Kupon & Kampanya Durumları
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponCode, setCouponCode] = useState<string>("");
  const [couponType, setCouponType] = useState<"BALANCE" | "DISCOUNT_PERCENT" | "DISCOUNT_FIXED">("BALANCE");
  const [couponValue, setCouponValue] = useState<string>("25");
  const [couponDesc, setCouponDesc] = useState<string>("");
  const [couponMaxUses, setCouponMaxUses] = useState<string>("50");
  const [couponExpiresAt, setCouponExpiresAt] = useState<string>("");
  const [savingCoupon, setSavingCoupon] = useState<boolean>(false);
  const [couponModalOpen, setCouponModalOpen] = useState<boolean>(false);

  // Güvenli Admin Başlıkları (Dahili Admin Doğrulaması)
  const getAdminHeaders = () => {
    const tg = typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null;
    const tgId = tg?.initDataUnsafe?.user?.id;
    return {
      "x-admin-request": "true",
      "x-admin-pin": "2026",
      ...(tgId ? { "x-telegram-id": String(tgId) } : {}),
    };
  };

  const adminFetch = (url: string, options: RequestInit = {}) => {
    const headers = {
      ...getAdminHeaders(),
      ...(options.headers || {}),
    };
    return fetch(url, { ...options, headers });
  };

  const fetchAllData = async () => {
    setRefreshing(true);
    const headers = getAdminHeaders();
    try {
      const [ovRes, setRes, uRes, depRes, tckRes, cpnRes] = await Promise.all([
        fetch("/api/admin/overview", { headers, cache: "no-store" }),
        fetch("/api/admin/settings", { headers, cache: "no-store" }),
        fetch("/api/admin/users", { headers, cache: "no-store" }),
        fetch("/api/admin/deposits", { headers, cache: "no-store" }),
        fetch("/api/admin/tickets", { headers, cache: "no-store" }),
        fetch("/api/admin/coupons", { headers, cache: "no-store" }),
      ]);

      const [ov, st, us, dep, tck, cpn] = await Promise.all([
        ovRes.json(),
        setRes.json(),
        uRes.json(),
        depRes.json(),
        tckRes.json(),
        cpnRes.json(),
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
          setOxapayApiKey(st.settings.cryptoSettings.oxapayApiKey || "");
          setAutoVerifyEnabled(st.settings.cryptoSettings.autoVerifyEnabled ?? true);
        }
        if (st.settings?.supportTelegramUsernames && Array.isArray(st.settings.supportTelegramUsernames)) {
          setSupportTelegramUsernames(st.settings.supportTelegramUsernames);
          setSupportTelegramUsername(st.settings.supportTelegramUsernames[0] || "");
        } else if (st.settings?.supportTelegramUsername) {
          setSupportTelegramUsername(st.settings.supportTelegramUsername);
          setSupportTelegramUsernames([st.settings.supportTelegramUsername]);
        } else {
          setSupportTelegramUsernames([]);
          setSupportTelegramUsername("");
        }
        if (st.settings?.customStickerFileId !== undefined) {
          setCustomStickerFileId(st.settings.customStickerFileId || "");
        }
        if (st.settings?.heroSmsApiKey !== undefined) {
          setHeroSmsApiKey(st.settings.heroSmsApiKey || "");
        }
        if (st.settings?.customPriceRules) {
          setCustomPriceRules(st.settings.customPriceRules);
        } else {
          setCustomPriceRules({});
        }
      }
      if (us.success) {
        setUsers(us.users || []);
        try {
          localStorage.removeItem("azfur_admin_users");
        } catch {}
      }
      if (dep.success) setDeposits(dep.deposits);
      if (tck.success) setTickets(tck.tickets || []);
      if (cpn.success) setCoupons(cpn.coupons || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Yeni Kupon Oluştur
  const handleCreateCoupon = async () => {
    if (!couponCode.trim()) {
      alert("Lütfen kupon kodu giriniz.");
      return;
    }
    const val = parseFloat(couponValue);
    if (isNaN(val) || val <= 0) {
      alert("Lütfen geçerli bir tutar veya yüzde giriniz.");
      return;
    }
    setSavingCoupon(true);
    haptic.impact("medium");
    try {
      const res = await adminFetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          code: couponCode.trim().toUpperCase(),
          type: couponType,
          value: val,
          description: couponDesc.trim(),
          maxUses: parseInt(couponMaxUses) || 0,
          expiresAt: couponExpiresAt || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg(`✅ '${couponCode.toUpperCase()}' kuponu başarıyla oluşturuldu!`);
        setTimeout(() => setToastMsg(null), 3500);
        setCouponCode("");
        setCouponDesc("");
        setCouponModalOpen(false);
        fetchAllData();
      } else {
        haptic.error();
        alert(data.error || "Kupon oluşturulamadı");
      }
    } catch {
      alert("Hata oluştu");
    } finally {
      setSavingCoupon(false);
    }
  };

  // Kupon Durumunu Değiştir (Aktif / Pasif)
  const handleToggleCouponActive = async (coupon: any) => {
    haptic.impact("light");
    try {
      const res = await adminFetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_active",
          id: coupon.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCoupons((prev) =>
          prev.map((c) => (c.id === coupon.id ? { ...c, isActive: !c.isActive } : c))
        );
        setToastMsg(data.message);
        setTimeout(() => setToastMsg(null), 2500);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Kupon Sil
  const handleDeleteCoupon = async (couponId: string, code: string) => {
    if (!confirm(`'${code}' kuponunu kalıcı olarak silmek istediğinize emin misiniz?`)) return;
    haptic.impact("heavy");
    try {
      const res = await adminFetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          id: couponId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setCoupons((prev) => prev.filter((c) => c.id !== couponId));
        setToastMsg("🗑️ Kupon başarıyla silindi.");
        setTimeout(() => setToastMsg(null), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    haptic.impact("medium");

    try {
      const res = await adminFetch("/api/admin/settings", {
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
      const res = await adminFetch("/api/admin/settings", {
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

    await adminFetch("/api/admin/settings", {
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

    await adminFetch("/api/admin/settings", {
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
      const res = await adminFetch("/api/admin/deposits", {
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
      const res = await adminFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: targetId,
          delta,
          reason: "Admin manuel işlem",
          userData: {
            telegramId: editingUser.telegramId,
            username: editingUser.username,
            firstName: editingUser.firstName,
            lastName: editingUser.lastName,
            balance: editingUser.balance,
            role: editingUser.role,
            isBanned: editingUser.isBanned,
          },
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
      const res = await adminFetch("/api/admin/overview", {
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
      const res = await adminFetch("/api/admin/settings", {
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
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cryptoSettings: {
            usdtTrc20Address,
            trxAddress,
            oxapayApiKey,
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

  // OxaPay API Anahtarını Test Et
  const handleTestOxapayKey = async () => {
    if (!oxapayApiKey.trim()) {
      alert("Lütfen önce bir OxaPay Merchant API Key giriniz.");
      return;
    }
    setTestingOxapay(true);
    setOxapayTestResult(null);
    haptic.impact("medium");
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_oxapay_key", key: oxapayApiKey.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setOxapayTestResult({
          success: true,
          message: data.message || "OxaPay Bağlantısı Başarılı!",
        });
      } else {
        haptic.error();
        setOxapayTestResult({
          success: false,
          message: data.error || "Geçersiz anahtar veya bağlantı hatası.",
        });
      }
    } catch {
      haptic.error();
      setOxapayTestResult({
        success: false,
        message: "OxaPay sunucusuna ulaşılamadı.",
      });
    } finally {
      setTestingOxapay(false);
    }
  };

  // Webhook URL Kopyala
  const handleCopyWebhookUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://azfur-sms.vercel.app";
    const webhookUrl = `${origin}/api/user/deposit/crypto-webhook`;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    haptic.success();
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  // Telegram Bot Webhook Otomatik Kurulum
  const handleSetupTelegramWebhook = async () => {
    setSettingWebhook(true);
    haptic.impact("heavy");
    try {
      const res = await fetch("/api/bot/webhook?action=setWebhook&drop=1", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        haptic.success();
        setWebhookStatus("✅ Telegram Webhook Başarıyla Kuruldu! Bot anında aktif.");
        setToastMsg("Telegram Webhook başarıyla bağlandı!");
        setTimeout(() => setToastMsg(null), 3000);
      } else {
        haptic.error();
        setWebhookStatus(`❌ Hata: ${data.telegramResponse?.description || data.error || "Bağlanamadı"}`);
      }
    } catch (e: any) {
      haptic.error();
      setWebhookStatus(`❌ Bağlantı hatası: ${e.message}`);
    } finally {
      setSettingWebhook(false);
    }
  };

  const handleCopyTgWebhookUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://azfur-sms.vercel.app";
    const webhookUrl = `${origin}/api/bot/webhook`;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedTgWebhook(true);
    haptic.success();
    setTimeout(() => setCopiedTgWebhook(false), 2500);
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
      const res = await adminFetch("/api/admin/broadcast", {
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

  // Destek Kullanıcı Listesini Kaydet
  const persistSupportUsers = async (list: string[]) => {
    setSavingSupportUser(true);
    haptic.impact("medium");
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supportTelegramUsernames: list,
          supportTelegramUsername: list[0] || "",
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg("Destek kullanıcı adları başarıyla güncellendi!");
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
      setSavingSupportUser(false);
    }
  };

  // Yeni Kullanıcı Adı Ekle
  const handleAddSupportUser = async () => {
    const clean = newSupportUsername.trim().replace(/^@/, "");
    if (!clean) {
      alert("Lütfen bir kullanıcı adı giriniz.");
      return;
    }
    if (supportTelegramUsernames.includes(clean)) {
      alert(`@${clean} zaten listede mevcut.`);
      return;
    }
    const updated = [...supportTelegramUsernames, clean];
    setSupportTelegramUsernames(updated);
    setNewSupportUsername("");
    await persistSupportUsers(updated);
  };

  // Kullanıcı Adı Sil
  const handleDeleteSupportUser = async (targetUser: string) => {
    if (!confirm(`@${targetUser} kullanıcısını destek listesinden silmek istediğinize emin misiniz?`)) {
      return;
    }
    const updated = supportTelegramUsernames.filter((u) => u !== targetUser);
    setSupportTelegramUsernames(updated);
    await persistSupportUsers(updated);
  };

  // Bot Hareketli Sticker Kaydet
  const handleSaveSticker = async (newVal?: string) => {
    const fileIdToSave = newVal !== undefined ? newVal : customStickerFileId;
    setSavingSticker(true);
    haptic.impact("medium");
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customStickerFileId: fileIdToSave.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg(fileIdToSave ? "Hareketli sticker başarıyla kaydedildi!" : "Sticker kaldırıldı, 3D animasyonlar aktif.");
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
      setSavingSticker(false);
    }
  };

  // Hero-SMS API Key Kaydet / Kaldır
  const handleSaveHeroApiKey = async (newVal?: string) => {
    const keyToSave = newVal !== undefined ? newVal : heroSmsApiKey;
    setSavingApiKey(true);
    setApiKeyTestResult(null);
    haptic.impact("medium");
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroSmsApiKey: keyToSave.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg(keyToSave.trim() ? "Hero-SMS API anahtarı başarıyla güncellendi!" : "Hero-SMS API anahtarı kaldırıldı!");
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
      setSavingApiKey(false);
    }
  };

  // Hero-SMS API Key Bağlantısını Test Et
  const handleTestHeroApiKey = async () => {
    setTestingApiKey(true);
    setApiKeyTestResult(null);
    haptic.impact("light");
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_hero_key",
          heroSmsApiKey: heroSmsApiKey.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setApiKeyTestResult({
          success: true,
          message: data.message,
          balance: data.balance,
        });
      } else {
        haptic.error();
        setApiKeyTestResult({
          success: false,
          message: data.error || "Bağlantı başarısız",
        });
      }
    } catch (err: any) {
      haptic.error();
      setApiKeyTestResult({
        success: false,
        message: "Ağ veya sunucu hatası oluştu",
      });
    } finally {
      setTestingApiKey(false);
    }
  };

  // Ülke ve Servise Özel Manuel Fiyat Kuralı Kaydet
  const handleSaveCustomPriceRule = async () => {
    if (!ruleCountryId || !ruleServiceCode) {
      alert("Lütfen ülke ve servis seçiniz.");
      return;
    }
    setSavingRule(true);
    haptic.impact("medium");

    const countries = settingsData?.allCountries || [];
    const services = settingsData?.allServices || [];
    const country = countries.find((c: any) => c.id === Number(ruleCountryId));
    const service = services.find((s: any) => s.code === ruleServiceCode);

    const ruleKey = `${ruleCountryId}_${ruleServiceCode}`;
    const newRule: any = {
      countryId: Number(ruleCountryId),
      countryName: country ? country.eng : `Country ${ruleCountryId}`,
      countryFlag: country ? country.flag || "🌐" : "🌐",
      serviceCode: ruleServiceCode,
      serviceName: service ? service.name : ruleServiceCode.toUpperCase(),
    };

    if (ruleType === "fixed") {
      const p = parseFloat(ruleFixedPrice);
      if (isNaN(p) || p <= 0) {
        alert("Lütfen geçerli bir sabit fiyat giriniz.");
        setSavingRule(false);
        return;
      }
      newRule.fixedPriceTry = Number(p.toFixed(2));
    } else {
      const m = parseFloat(ruleMarginPercent);
      const f = parseFloat(ruleFixedFee);
      newRule.marginPercent = isNaN(m) ? 40 : m;
      newRule.fixedFee = isNaN(f) ? 5 : f;
    }

    const updatedRules = { ...customPriceRules, [ruleKey]: newRule };
    setCustomPriceRules(updatedRules);

    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPriceRules: updatedRules }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMsg(`✅ ${newRule.countryName} - ${newRule.serviceName} için özel fiyatlandırma kaydedildi!`);
        setTimeout(() => setToastMsg(null), 3500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingRule(false);
    }
  };

  // Özel Fiyat Kuralını Sil
  const handleDeleteCustomPriceRule = async (ruleKey: string) => {
    if (!confirm("Bu özel fiyatlandırma kuralını silmek istediğinize emin misiniz?")) return;
    haptic.impact("medium");

    const updatedRules = { ...customPriceRules };
    delete updatedRules[ruleKey];
    setCustomPriceRules(updatedRules);

    try {
      await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPriceRules: updatedRules }),
      });
      setToastMsg("🗑️ Özel fiyat kuralı silindi.");
      setTimeout(() => setToastMsg(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  // Destek Talebine Yanıt Ver
  const handleReplyTicket = async () => {
    if (!selectedTicket || !ticketReplyText.trim()) return;
    setSendingTicketReply(true);
    haptic.impact("medium");
    try {
      const res = await adminFetch("/api/admin/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          ticketId: selectedTicket.id,
          message: ticketReplyText.trim(),
          adminName: "AzFur Yönetici Destek",
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setTicketReplyText("");
        setSelectedTicket(data.ticket);
        setTickets((prev) => prev.map((t) => (t.id === data.ticket.id ? data.ticket : t)));
        setToastMsg("Yanıt gönderildi ve kullanıcıya Telegram'dan bildirildi!");
        setTimeout(() => setToastMsg(null), 3500);
      } else {
        haptic.error();
        alert(data.error || "Yanıt gönderilemedi");
      }
    } catch {
      haptic.error();
      alert("Hata oluştu");
    } finally {
      setSendingTicketReply(false);
    }
  };

  // Destek Talebi Durumunu Değiştir (Açık / Kapat)
  const handleToggleTicketStatus = async (ticketId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "CLOSED" ? "OPEN" : "CLOSED";
    haptic.impact("light");
    try {
      const res = await adminFetch("/api/admin/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          ticketId,
          status: nextStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        if (selectedTicket?.id === ticketId) setSelectedTicket(data.ticket);
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? data.ticket : t)));
        setToastMsg(nextStatus === "CLOSED" ? "Talep kapatıldı." : "Talep yeniden açıldı.");
        setTimeout(() => setToastMsg(null), 3000);
      }
    } catch {
      haptic.error();
    }
  };

  // Destek Talebini Kalıcı Olarak Sil
  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm("Bu destek talebini ve tüm mesaj geçmişini kalıcı olarak silmek istediğinize emin misiniz?")) {
      return;
    }
    haptic.impact("heavy");
    try {
      const res = await adminFetch("/api/admin/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          ticketId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        if (selectedTicket?.id === ticketId) setSelectedTicket(null);
        setTickets((prev) => prev.filter((t) => t.id !== ticketId));
        setToastMsg("Destek talebi başarıyla silindi.");
        setTimeout(() => setToastMsg(null), 3000);
      }
    } catch {
      haptic.error();
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
      const res = await adminFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_ban",
          telegramId: user.telegramId,
          isBanned: nextBanStatus,
          userData: user,
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setUsers((prev) =>
          prev.map((u) => (u.telegramId === user.telegramId ? { ...u, isBanned: nextBanStatus } : u))
        );
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
      const res = await adminFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_role",
          telegramId: user.telegramId,
          role: nextRole,
          userData: user,
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setUsers((prev) =>
          prev.map((u) => (u.telegramId === user.telegramId ? { ...u, role: nextRole } : u))
        );
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
      const res = await adminFetch("/api/admin/users", {
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
        setUsers((prev) => prev.filter((u) => u.telegramId !== user.telegramId));
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

  // Kullanıcı Detay Metnini Kopyalama
  const handleCopyDetail = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDetailText(label);
    haptic.impact("light");
    setTimeout(() => setCopiedDetailText(null), 2000);
  };

  // Kullanıcı Detayını Aç ve Tüm Numaraları/Kodları Çek
  const handleOpenUserDetail = async (user: any) => {
    setSelectedUserDetail(user);
    setUserDetailTab("numbers");
    setUserDetailLoading(true);
    setUserActivations([]);
    setUserDeposits([]);
    setUserTickets([]);
    haptic.selection();

    try {
      const res = await adminFetch(`/api/admin/users?telegramId=${user.telegramId}`);
      const data = await res.json();
      if (data.success) {
        if (data.user) setSelectedUserDetail(data.user);
        setUserActivations(data.activations || []);
        setUserDeposits(data.deposits || []);
        setUserTickets(data.tickets || []);
      }
    } catch (e) {
      console.error("User detail fetch error:", e);
    } finally {
      setUserDetailLoading(false);
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

  // Yükleme Durumu
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="text-xs text-zinc-400 font-medium">Yönetici yetkileri ve sistem verileri kontrol ediliyor...</span>
      </div>
    );
  }



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
            disabled={refreshing}
            className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-400" : ""}`} />
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
      <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-1.5 bg-zinc-900/70 p-1.5 rounded-2xl border border-white/5 text-xs font-semibold">
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
          Kripto & Ayar
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("coupons");
          }}
          className={`py-2 px-1 rounded-xl transition-all text-center ${
            activeTab === "coupons"
              ? "bg-purple-500 text-white shadow-md shadow-purple-500/20"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Kuponlar ({coupons.length})
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
            setActiveTab("tickets");
          }}
          className={`py-2 px-1 rounded-xl transition-all text-center relative ${
            activeTab === "tickets"
              ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>Destek ({tickets.filter((t) => t.status === "OPEN").length})</span>
          {tickets.some((t) => t.status === "OPEN") && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          )}
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

          {/* 🎯 Ülke ve Servise Özel Manuel Fiyatlandırma Kartı */}
          <Card className="p-4 space-y-4 border-amber-500/40 bg-gradient-to-br from-[#161208] to-[#0c0e15] shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Ülke & Servise Özel Manuel Fiyatlandırma</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {Object.keys(customPriceRules).length} Özel Kural
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Belirli ülke ve servis kombinasyonlarına özel sabit satış fiyatı veya kâr marjı tanımlayın.
                  </p>
                </div>
              </div>
            </div>

            {/* Form Alanı */}
            <div className="space-y-3 p-3 rounded-xl bg-zinc-900/90 border border-white/5">
              <div className="grid grid-cols-2 gap-2">
                {/* Ülke Seçimi */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-300 block">Ülke Seçin:</label>
                  <select
                    value={ruleCountryId}
                    onChange={(e) => setRuleCountryId(Number(e.target.value))}
                    className="w-full bg-[#181a24] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {(settingsData?.allCountries || []).map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.flag || "🌐"} {c.eng} (ID: {c.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Servis Seçimi */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-300 block">Servis Seçin:</label>
                  <select
                    value={ruleServiceCode}
                    onChange={(e) => setRuleServiceCode(e.target.value)}
                    className="w-full bg-[#181a24] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {(settingsData?.allServices || []).map((s: any) => (
                      <option key={s.code} value={s.code}>
                        {s.icon || "📱"} {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fiyatlandırma Modu Tabları */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRuleType("fixed")}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                      ruleType === "fixed"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-zinc-800 text-zinc-400 border border-transparent"
                    }`}
                  >
                    🏷️ Sabit Satış Fiyatı (₺)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRuleType("margin")}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                      ruleType === "margin"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-zinc-800 text-zinc-400 border border-transparent"
                    }`}
                  >
                    📈 Özel Kâr % + Sabit Ücret
                  </button>
                </div>

                {ruleType === "fixed" ? (
                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400 block">
                      Sabit Satış Fiyatı (Maliyet ve kurdan bağımsız bu fiyata satılır):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-zinc-500">₺</span>
                      <input
                        type="number"
                        step="0.5"
                        value={ruleFixedPrice}
                        onChange={(e) => setRuleFixedPrice(e.target.value)}
                        className="w-full pl-7 bg-[#12141c] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-amber-500"
                        placeholder="Örn: 18.00"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 block">Özel Kâr Oranı (%):</label>
                      <input
                        type="number"
                        step="5"
                        value={ruleMarginPercent}
                        onChange={(e) => setRuleMarginPercent(e.target.value)}
                        className="w-full bg-[#12141c] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-amber-500"
                        placeholder="%50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 block">Ek Hizmet Ücreti (₺):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={ruleFixedFee}
                        onChange={(e) => setRuleFixedFee(e.target.value)}
                        className="w-full bg-[#12141c] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-amber-500"
                        placeholder="5.00"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSaveCustomPriceRule}
                disabled={savingRule}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{savingRule ? "Kaydediliyor..." : "Özel Fiyat Kuralını Tanımla"}</span>
              </button>
            </div>

            {/* Tanımlı Kurallar Listesi */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-zinc-300 block">
                Aktif Özel Fiyat Kuralları ({Object.keys(customPriceRules).length}):
              </span>

              {Object.keys(customPriceRules).length === 0 ? (
                <div className="p-4 rounded-xl bg-zinc-900/40 border border-dashed border-white/10 text-center text-xs text-zinc-500">
                  Henüz özel fiyat kuralı eklenmedi. Tüm servis ve ülkelerde genel kâr marjı (%{marginPercent} + ₺{fixedFee}) geçerlidir.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {Object.entries(customPriceRules).map(([key, rule]: [string, any]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/90 border border-white/5 hover:border-amber-500/30 transition-all text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{rule.countryFlag || "🌐"}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white">{rule.countryName || `Ülke ${rule.countryId}`}</span>
                            <span className="text-zinc-600">•</span>
                            <span className="text-amber-300 font-semibold">{rule.serviceName || rule.serviceCode}</span>
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            {rule.fixedPriceTry !== undefined ? (
                              <span className="text-emerald-400 font-bold">Sabit Fiyat: ₺{Number(rule.fixedPriceTry).toFixed(2)}</span>
                            ) : (
                              <span>Özel Kâr: %{rule.marginPercent || 0} + ₺{rule.fixedFee || 0}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setRuleCountryId(rule.countryId);
                            setRuleServiceCode(rule.serviceCode);
                            if (rule.fixedPriceTry !== undefined) {
                              setRuleType("fixed");
                              setRuleFixedPrice(String(rule.fixedPriceTry));
                            } else {
                              setRuleType("margin");
                              setRuleMarginPercent(String(rule.marginPercent || 40));
                              setRuleFixedFee(String(rule.fixedFee || 5));
                            }
                            haptic.selection();
                          }}
                          className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomPriceRule(key)}
                          className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                          title="Kuralı Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

      {/* TAB: CRYPTO WALLET & INTEGRATION SETTINGS */}
      {activeTab === "bank" && (
        <div className="space-y-4">
          {/* Otomatik Kripto (TRX & USDT & CryptoBot) Cüzdan Ayarları */}
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

              {/* Otomatik Kripto (OxaPay White-Label) API & Test Bölümü */}
              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-emerald-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Otomatik Kripto Ödeme Sistemi (OxaPay API)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                    Bot İçi QR + Otomatik Onay
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-300">OxaPay Merchant API Key</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={oxapayApiKey}
                      onChange={(e) => setOxapayApiKey(e.target.value)}
                      placeholder="Örn: 2B9X-XXXX-XXXX-XXXX"
                      className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleTestOxapayKey}
                      disabled={testingOxapay || !oxapayApiKey.trim()}
                      className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 font-bold text-xs border border-emerald-500/30 flex items-center gap-1.5 shrink-0 transition-all disabled:opacity-50"
                    >
                      {testingOxapay ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Test Ediliyor...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Bağlantıyı Test Et</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Test Sonucu Bildirimi */}
                {oxapayTestResult && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-medium border ${
                      oxapayTestResult.success
                        ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                        : "bg-rose-950/60 border-rose-500/40 text-rose-300"
                    }`}
                  >
                    {oxapayTestResult.message}
                  </div>
                )}

                {/* Webhook URL Kopyalama Kutusu */}
                <div className="space-y-1 pt-1 border-t border-white/5">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>OxaPay Webhook Callback URL:</span>
                    <span className="text-[10px] text-zinc-500">Otomatik Anında Bakiye Yükleme İçin</span>
                  </div>
                  <div className="flex items-center justify-between bg-black/60 p-2 rounded-xl border border-white/10 font-mono text-[11px]">
                    <span className="truncate text-zinc-300 mr-2 select-all">
                      {typeof window !== "undefined"
                        ? `${window.location.origin}/api/user/deposit/crypto-webhook`
                        : "https://azfur-sms.vercel.app/api/user/deposit/crypto-webhook"}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyWebhookUrl}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 text-emerald-400 hover:text-emerald-300 shrink-0 text-[10px] font-sans font-bold transition-all active:scale-95"
                    >
                      {copiedWebhook ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Kopyalandı</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Kopyala</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500 pt-0.5">
                    💡 <b>Nasıl Çalışır:</b> OxaPay panelinizden (Merchant Services) aldığınız API Key&apos;i buraya girin. Kullanıcılar bot veya web panelden ayrılmadan doğrudan bot mesajında QR kod ve cüzdan adresi alır; ödeme blokzincirinde onaylandığında bakiye anında otomatik hesaba geçer.
                  </p>
                </div>
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

          {/* Telegram Bot Webhook Kurulum & Hızlı Bağlantı Kutusu */}
          <Card className="p-4 space-y-4 border-cyan-500/30">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Telegram Bot Webhook Kurulumu</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                      0 Gecikme
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Botun /start ve butonlara anında tepki vermesi için webhook bağlantısını kurun.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Bot Webhook Endpoint URL:</span>
              </div>
              <div className="flex items-center justify-between bg-black/60 p-2 rounded-xl border border-white/10 font-mono text-[11px]">
                <span className="truncate text-zinc-300 mr-2 select-all">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/api/bot/webhook`
                    : "https://azfur-sms.vercel.app/api/bot/webhook"}
                </span>
                <button
                  type="button"
                  onClick={handleCopyTgWebhookUrl}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 text-cyan-400 hover:text-cyan-300 shrink-0 text-[10px] font-sans font-bold transition-all active:scale-95"
                >
                  {copiedTgWebhook ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Kopyalandı</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Kopyala</span>
                    </>
                  )}
                </button>
              </div>

              {webhookStatus && (
                <div className={`p-2.5 rounded-xl text-xs font-semibold ${webhookStatus.startsWith("✅") ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300" : "bg-rose-500/15 border border-rose-500/30 text-rose-300"}`}>
                  {webhookStatus}
                </div>
              )}

              <button
                type="button"
                onClick={handleSetupTelegramWebhook}
                disabled={settingWebhook}
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow-md shadow-cyan-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {settingWebhook ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Telegram Bağlanıyor...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>⚡ Webhook&apos;u Anında Otomatik Bağla (0 Gecikme)</span>
                  </>
                )}
              </button>
            </div>
          </Card>

          {/* Canlı Destek & Telegram Yönetici İletişim Ayarları */}
          <Card className="p-4 space-y-4 border-purple-500/30">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Canlı Destek & Yönetici Kullanıcı Adları</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                      {supportTelegramUsernames.length} Hesap
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Bot ve Mini App yardım menülerinde gösterilir. İstediğiniz kadar yönetici ekleyip silebilirsiniz.
                  </p>
                </div>
              </div>
            </div>

            {/* Mevcut Ekli Kullanıcı Adları Listesi */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 block">
                Aktif Destek Hesapları ({supportTelegramUsernames.length})
              </label>

              {supportTelegramUsernames.length === 0 ? (
                <div className="p-3 rounded-xl bg-zinc-900 border border-white/5 text-center text-xs text-zinc-500">
                  Henüz destek hesabı eklenmedi. Aşağıdan ekleyebilirsiniz.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {supportTelegramUsernames.map((user, idx) => (
                    <div
                      key={user}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/90 border border-white/10 hover:border-purple-500/30 transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-mono text-xs font-bold text-purple-300">
                            @{user}
                          </span>
                          <span className="ml-2 text-[10px] text-zinc-500">
                            (t.me/{user})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <a
                          href={`https://t.me/${user}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 hover:text-white transition-colors"
                        >
                          Test Et ↗
                        </a>
                        <button
                          onClick={() => handleDeleteSupportUser(user)}
                          disabled={savingSupportUser}
                          className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                          title="Bu hesabı sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Yeni Kullanıcı Adı Ekleme Alanı */}
            <div className="space-y-2 pt-2 border-t border-white/[0.06]">
              <label className="text-xs font-semibold text-zinc-300 block">
                Yeni Destek / Yönetici Hesabı Ekle
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono">@</span>
                  <input
                    type="text"
                    value={newSupportUsername}
                    onChange={(e) => setNewSupportUsername(e.target.value.replace(/^@/, ""))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSupportUser();
                      }
                    }}
                    placeholder="Örn: azfur_admin veya mehmet_destek"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-8 pr-3.5 py-2.5 text-xs font-mono text-purple-300 font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>
                <button
                  onClick={handleAddSupportUser}
                  disabled={savingSupportUser || !newSupportUsername.trim()}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/25 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {savingSupportUser ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  )}
                  <span>Ekle</span>
                </button>
              </div>
              <p className="text-[10px] text-zinc-500">
                Eklenen tüm hesaplar botun yardım mesajında ve Mini App destek penceresinde buton olarak yer alır.
              </p>
            </div>
          </Card>

          {/* BOT HAREKETLİ STİCKER / ANİMASYON YÖNETİMİ */}
          <Card className="p-4 bg-zinc-950/80 border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Telegram Bot Hareketli Sticker & Animasyon</span>
                    {customStickerFileId ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                        Özel Sticker Aktif
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">
                        3D Animasyon (🎯 / 🎰)
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Botta /start, /bakiye, /yardim ve siparişlerde gösterilen animasyonlu görseli yönetin.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 space-y-2">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span>💡 En Pratik Tanımlama Yöntemi:</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Telegram&apos;da bota yönetici hesabınızdan <b>herhangi bir hareketli veya video sticker</b> göndermeniz yeterlidir! Bot gönderdiğiniz sticker&apos;ı otomatik olarak yakalar ve anında aktif eder.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 block">
                Sticker File ID (Manuel Giriş veya Değiştirme)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customStickerFileId}
                  onChange={(e) => setCustomStickerFileId(e.target.value)}
                  placeholder="Örn: CAACAgIAAxkBAAE..."
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={() => handleSaveSticker()}
                  disabled={savingSticker}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/25 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {savingSticker ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Kaydet</span>
                </button>
              </div>
              {customStickerFileId && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[220px]">
                    ID: {customStickerFileId}
                  </span>
                  <button
                    onClick={() => {
                      setCustomStickerFileId("");
                      handleSaveSticker("");
                    }}
                    className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Sticker&apos;ı Kaldır (Varsayılan 3D Animasyona Dön)
                  </button>
                </div>
              )}
            </div>
          </Card>

          {/* HERO-SMS API KEY YÖNETİMİ */}
          <Card className="p-4 bg-zinc-950/80 border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Hero-SMS API Anahtarı</span>
                    {heroSmsApiKey.trim() ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                        Aktif
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono">
                        Anahtar Yok
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Sanal numara sağlama, ülke/servis listesi ve SMS kod çekme işlemlerinde kullanılan sağlayıcı anahtarı.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 block">
                API Key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={heroSmsApiKey}
                    onChange={(e) => setHeroSmsApiKey(e.target.value)}
                    placeholder="Örn: e1006858662edcAd8d348c9f07dfe8c5"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 pr-10 py-2.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => handleSaveHeroApiKey()}
                  disabled={savingApiKey}
                  className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/25 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {savingApiKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Kaydet</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={handleTestHeroApiKey}
                  disabled={testingApiKey || !heroSmsApiKey.trim()}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {testingApiKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Bağlantıyı & Bakiyeyi Test Et</span>
                </button>

                {heroSmsApiKey.trim() && (
                  <button
                    onClick={() => {
                      if (confirm("Hero-SMS API anahtarını kaldırmak istediğinize emin misiniz?")) {
                        setHeroSmsApiKey("");
                        handleSaveHeroApiKey("");
                      }
                    }}
                    className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Anahtarı Kaldır
                  </button>
                )}
              </div>

              {apiKeyTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium transition-all ${
                    apiKeyTestResult.success
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                  }`}
                >
                  {apiKeyTestResult.success ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>{apiKeyTestResult.message}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{apiKeyTestResult.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
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
                        {(() => {
                          const hasRealName =
                            u.firstName &&
                            u.firstName !== "Kullanıcı" &&
                            u.firstName !== "Misafir" &&
                            u.firstName !== "Telegram Kullanıcısı";
                          const fullName = hasRealName ? `${u.firstName} ${u.lastName || ""}`.trim() : "";
                          const hasRealUsername = Boolean(u.username && !u.username.startsWith("user_") && u.username.trim() !== "");
                          const displayTitle = fullName || (hasRealUsername ? `@${u.username}` : `Kullanıcı #${u.telegramId}`);

                          const lastActiveTime = u.lastActiveAt ? new Date(u.lastActiveAt).getTime() : 0;
                          // Son 5 dakika içinde aktif olan kullanıcı canlı / çevrimiçi sayılır
                          const isOnline = lastActiveTime > 0 && Date.now() - lastActiveTime < 5 * 60 * 1000;

                          const formatLastActive = (dateStr?: string) => {
                            if (!dateStr) return "Bilinmiyor";
                            try {
                              const d = new Date(dateStr);
                              const diffMs = Date.now() - d.getTime();
                              if (diffMs < 60000) return "Az önce";
                              const diffMins = Math.floor(diffMs / 60000);
                              if (diffMins < 60) return `${diffMins} dk önce`;
                              const diffHours = Math.floor(diffMins / 60);
                              if (diffHours < 24) return `${diffHours} sa önce`;
                              const diffDays = Math.floor(diffHours / 24);
                              if (diffDays === 1) return `Dün ${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
                              if (diffDays < 7) return `${diffDays} gün önce`;
                              return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
                            } catch {
                              return dateStr;
                            }
                          };

                          return (
                            <>
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {isOnline ? (
                                    <span className="relative flex h-2.5 w-2.5 shrink-0" title="Şu An Çevrimiçi">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
                                    </span>
                                  ) : (
                                    <span className="h-2 w-2 rounded-full bg-zinc-600 shrink-0" title="Çevrimdışı" />
                                  )}
                                  <span className="font-bold text-xs text-white truncate">
                                    {displayTitle}
                                  </span>
                                </div>

                                {/* Rozetler */}
                                {u.isBanned ? (
                                  <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded font-bold">
                                    ⛔ BANLI
                                  </span>
                                ) : u.role === "admin" ? (
                                  <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded font-bold">
                                    👑 ADMIN
                                  </span>
                                ) : null}

                                {isOnline ? (
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    ÇEVRİMİÇİ
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-zinc-400 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">
                                    {formatLastActive(u.lastActiveAt)}
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] font-mono text-zinc-400 mt-1 truncate flex items-center gap-1.5 flex-wrap">
                                <span>ID: <span className="text-zinc-200">{u.telegramId}</span></span>
                                {hasRealUsername ? (
                                  <>
                                    <span className="text-zinc-600">•</span>
                                    <span className="text-emerald-400 font-semibold">@{u.username}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-zinc-600">•</span>
                                    <span className="text-zinc-500 text-[10px] bg-white/[0.04] px-1.5 py-0.5 rounded">kullanıcı adı yok</span>
                                  </>
                                )}
                                <span className="text-zinc-600">•</span>
                                <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                                  <Clock className="w-3 h-3 text-zinc-500" />
                                  Son aktif: <span className={isOnline ? "text-emerald-400 font-semibold" : "text-zinc-300"}>{isOnline ? "Şu an aktif" : formatLastActive(u.lastActiveAt)}</span>
                                </span>
                              </div>
                            </>
                          );
                        })()}
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

                    {/* Alt Kısım: Hızlı Yönetici Aksiyonları & Detay Butonu */}
                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-1.5 flex-wrap">
                      {/* Detay & Numaraları İncele (Ana İstek) */}
                      <button
                        onClick={() => handleOpenUserDetail(u)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Detay & Numaralar ({u.totalOrdersCount || 0})</span>
                      </button>

                      {/* Bakiye Düzenle */}
                      <button
                        onClick={() => {
                          haptic.impact("light");
                          setEditingUser(u);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-all"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Bakiye</span>
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
                        <span>{u.role === "admin" ? "Adminliği Al" : "Admin"}</span>
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
                        {dep.username && !dep.username.startsWith("user_")
                          ? `@${dep.username.replace(/^@/, "")}`
                          : `Kullanıcı #${dep.telegramId}`}
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
                  {users.map((u) => {
                    const uName = u.username && !u.username.startsWith("user_") ? `@${u.username}` : "kullanıcı adı yok";
                    const fName =
                      u.firstName && u.firstName !== "Kullanıcı" && u.firstName !== "Misafir" && u.firstName !== "Telegram Kullanıcısı"
                        ? u.firstName
                        : `Kullanıcı #${u.telegramId}`;
                    return (
                      <option key={u.telegramId} value={u.telegramId}>
                        {fName} ({uName}) - ID: {u.telegramId} (Bakiye: ₺{u.balance.toFixed(2)})
                      </option>
                    );
                  })}
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

      {/* TAB: SUPPORT TICKETS (DESTEK TALEPLERİ) */}
      {activeTab === "tickets" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Headphones className="w-4 h-4 text-emerald-400" />
              <span>Kullanıcı Destek Talepleri ({tickets.length})</span>
            </h3>
            <button
              onClick={() => {
                haptic.impact("light");
                fetchAllData();
              }}
              className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              <span>Yenile</span>
            </button>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-zinc-900/60 rounded-xl border border-white/5 text-xs font-semibold">
            {[
              { id: "ALL", label: `Tümü (${tickets.length})` },
              { id: "OPEN", label: `Bekleyen (${tickets.filter((t) => t.status === "OPEN").length})` },
              { id: "ANSWERED", label: `Cevaplanan (${tickets.filter((t) => t.status === "ANSWERED").length})` },
              { id: "CLOSED", label: `Kapatılan (${tickets.filter((t) => t.status === "CLOSED").length})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  haptic.selection();
                  setTicketFilter(f.id as any);
                }}
                className={`py-1.5 px-3 rounded-lg transition-all ${
                  ticketFilter === f.id
                    ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Ticket List */}
          <div className="space-y-2">
            {tickets
              .filter((t) => {
                if (ticketFilter === "ALL") return true;
                return t.status === ticketFilter;
              })
              .length === 0 ? (
              <Card className="p-8 text-center text-zinc-500 text-xs">
                Bu filtrede destek talebi bulunmamaktadır.
              </Card>
            ) : (
              tickets
                .filter((t) => {
                  if (ticketFilter === "ALL") return true;
                  return t.status === ticketFilter;
                })
                .map((t) => {
                  const userObj = users.find((u) => u.telegramId === t.telegramId);
                  const isPending = t.status === "OPEN";
                  return (
                    <Card
                      key={t.id}
                      className={`p-3.5 space-y-2.5 transition-all border ${
                        isPending
                          ? "border-amber-500/40 bg-gradient-to-r from-amber-950/15 to-zinc-900"
                          : "border-white/5 bg-zinc-900/80 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-zinc-400 font-bold">
                            #{t.id}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-medium">
                            {t.category === "BALANCE"
                              ? "💳 Bakiye"
                              : t.category === "SMS_NUMBER"
                              ? "📱 Numara/SMS"
                              : t.category === "GENERAL"
                              ? "⚙️ Sistem"
                              : "📌 Diğer"}
                          </span>
                        </div>

                        {t.status === "OPEN" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                            <Clock className="w-3 h-3" />
                            <span>BEKLİYOR (AÇIK)</span>
                          </span>
                        ) : t.status === "ANSWERED" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            <CheckCircle className="w-3 h-3" />
                            <span>CEVAPLANDI</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400">
                            <span>KAPATILDI</span>
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-white">{t.subject}</h4>
                        {(() => {
                          const tUserRealName =
                            userObj?.firstName && userObj.firstName !== "Kullanıcı" && userObj.firstName !== "Misafir"
                              ? `${userObj.firstName} ${userObj.lastName || ""}`.trim()
                              : t.userFirstName && t.userFirstName !== "Kullanıcı" && t.userFirstName !== "Misafir"
                              ? t.userFirstName
                              : `Kullanıcı #${t.telegramId}`;
                          const tUsername =
                            userObj?.username && !userObj.username.startsWith("user_")
                              ? `@${userObj.username}`
                              : t.username && !t.username.startsWith("user_")
                              ? `@${t.username}`
                              : "kullanıcı adı yok";

                          return (
                            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                              <span>👤 {tUserRealName}</span>
                              <span>•</span>
                              <span className="font-mono">{tUsername}</span>
                              <span>•</span>
                              <span className="font-mono text-zinc-500">ID: {t.telegramId}</span>
                              {userObj && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-emerald-400 font-semibold">
                                    ₺{userObj.balance.toFixed(2)}
                                  </span>
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs text-zinc-300">
                        <span className="text-[10px] text-zinc-500 block mb-0.5">Son Mesaj:</span>
                        <p className="line-clamp-2">
                          {t.messages[t.messages.length - 1]?.text || "Mesaj yok"}
                        </p>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] text-xs">
                        <span className="text-[10px] text-zinc-500">
                          {new Date(t.updatedAt).toLocaleString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              haptic.selection();
                              setSelectedTicket(t);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 active:scale-95 transition-all flex items-center gap-1"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Görüşmeyi Aç & Yanıtla ({t.messages.length})</span>
                          </button>

                          <button
                            onClick={() => handleToggleTicketStatus(t.id, t.status)}
                            className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                            title={t.status === "CLOSED" ? "Yeniden Aç" : "Talebi Kapat"}
                          >
                            {t.status === "CLOSED" ? (
                              <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-amber-400" />
                            )}
                          </button>

                          <button
                            onClick={() => handleDeleteTicket(t.id)}
                            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                            title="Talebi Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Admin Ticket Conversation Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-[#0f111a] border border-white/10 rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-zinc-900/60">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-purple-400 font-bold">
                    #{selectedTicket.id}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-semibold">
                    {selectedTicket.category}
                  </span>
                  {selectedTicket.status === "OPEN" ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                      AÇIK
                    </span>
                  ) : selectedTicket.status === "ANSWERED" ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                      CEVAPLANDI
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-bold">
                      KAPALI
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-white mt-1">{selectedTicket.subject}</h3>
                <p className="text-[11px] text-zinc-400">
                  {selectedTicket.userFirstName} (@{selectedTicket.username || "yok"}) • Telegram ID:{" "}
                  <code>{selectedTicket.telegramId}</code>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleTicketStatus(selectedTicket.id, selectedTicket.status)}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 transition-colors"
                >
                  {selectedTicket.status === "CLOSED" ? "Yeniden Aç" : "Kapat"}
                </button>
                <button
                  onClick={() => handleDeleteTicket(selectedTicket.id)}
                  className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                  title="Talebi Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedTicket.messages.map((m: any) => {
                const isAdmin = m.sender === "admin";
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isAdmin ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mb-1 px-1">
                      {isAdmin ? (
                        <>
                          <span className="font-semibold text-purple-300">AzFur Yönetici (Siz)</span>
                          <ShieldCheck className="w-3 h-3 text-purple-400" />
                        </>
                      ) : (
                        <span className="font-semibold text-zinc-200">
                          {m.senderName || selectedTicket.userFirstName} (Kullanıcı)
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        {new Date(m.createdAt).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div
                      className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                        isAdmin
                          ? "bg-purple-600 text-white rounded-tr-sm shadow-md font-medium"
                          : "bg-zinc-800/90 border border-white/10 text-zinc-100 rounded-tl-sm shadow-md"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Templates & Reply Box */}
            <div className="p-3.5 bg-zinc-900/90 border-t border-white/[0.08] space-y-2.5 shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {[
                  "✅ Bakiyeniz hesabınıza eklenmiştir. Kontrol edebilirsiniz.",
                  "⏳ İşleminiz inceleniyor, lütfen biraz bekleyiniz.",
                  "❌ Belirtilen ödeme kaydı bulunamadı. Lütfen dekont veya TxID iletiniz.",
                ].map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => setTicketReplyText(tpl)}
                    className="px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 transition-colors"
                  >
                    {tpl.slice(0, 32)}...
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <textarea
                  rows={2}
                  value={ticketReplyText}
                  onChange={(e) => setTicketReplyText(e.target.value)}
                  placeholder="Kullanıcıya iletilecek yanıtı yazınız..."
                  className="flex-1 bg-zinc-950 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 resize-none font-sans"
                />
                <button
                  onClick={handleReplyTicket}
                  disabled={sendingTicketReply || !ticketReplyText.trim()}
                  className="px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/25 active:scale-95 transition-all disabled:opacity-40 flex flex-col items-center justify-center gap-1"
                >
                  {sendingTicketReply ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span className="text-[10px]">Gönder</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500">
                💡 Yanıtınız kaydedildiği anda kullanıcının Telegram hesabına anlık bildirim iletilir.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: KUPONLAR & KAMPANYALAR */}
      {activeTab === "coupons" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Gift className="w-4 h-4 text-purple-400" />
                <span>Kuponlar & İndirim Kampanyaları</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Kullanıcılar için hediye bakiye ve SMS onay indirim kodları tanımlayın
              </p>
            </div>
            <button
              onClick={() => {
                haptic.impact("medium");
                setCouponModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs shadow-md shadow-purple-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Kupon Oluştur</span>
            </button>
          </div>

          {/* İstatistikler */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-3 bg-zinc-950/80 border-white/5">
              <span className="text-[10px] text-zinc-400 block font-medium">Toplam Kupon</span>
              <span className="text-lg font-bold text-white font-mono mt-0.5 block">{coupons.length}</span>
            </Card>
            <Card className="p-3 bg-zinc-950/80 border-white/5">
              <span className="text-[10px] text-zinc-400 block font-medium">Aktif Kuponlar</span>
              <span className="text-lg font-bold text-emerald-400 font-mono mt-0.5 block">
                {coupons.filter((c) => c.isActive).length}
              </span>
            </Card>
            <Card className="p-3 bg-zinc-950/80 border-white/5">
              <span className="text-[10px] text-zinc-400 block font-medium">Toplam Kullanım</span>
              <span className="text-lg font-bold text-purple-400 font-mono mt-0.5 block">
                {coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0)} kez
              </span>
            </Card>
          </div>

          {/* Kupon Listesi */}
          {coupons.length === 0 ? (
            <Card className="p-8 text-center bg-zinc-950/60 border-white/5 space-y-2">
              <Gift className="w-8 h-8 mx-auto text-zinc-600" />
              <p className="text-xs text-zinc-400">Henüz tanımlanmış bir kupon kodu bulunmuyor.</p>
              <button
                onClick={() => setCouponModalOpen(true)}
                className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
              >
                + İlk kuponu hemen oluşturun
              </button>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {coupons.map((c) => {
                const isExpired = c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();
                const isFull = c.maxUses > 0 && c.usedCount >= c.maxUses;
                return (
                  <Card
                    key={c.id}
                    className={`p-3.5 space-y-2.5 border transition-all ${
                      !c.isActive || isExpired || isFull
                        ? "bg-zinc-950/40 border-white/5 opacity-70"
                        : "bg-zinc-900/80 border-white/10 hover:border-purple-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 font-mono font-black text-sm text-white tracking-wider flex items-center gap-1.5 select-all">
                          <span>🎟️</span>
                          <span>{c.code}</span>
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(c.code);
                            haptic.success();
                            setToastMsg(`📋 '${c.code}' kodu kopyalandı!`);
                            setTimeout(() => setToastMsg(null), 2000);
                          }}
                          className="p-1 rounded-lg text-zinc-400 hover:text-white"
                          title="Kodu Kopyala"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            c.type === "BALANCE"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : c.type === "DISCOUNT_PERCENT"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          }`}
                        >
                          {c.type === "BALANCE"
                            ? `+₺${c.value} Hediye Bakiye`
                            : c.type === "DISCOUNT_PERCENT"
                            ? `-%${c.value} İndirim`
                            : `-₺${c.value} Sabit İndirim`}
                        </span>

                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            !c.isActive
                              ? "bg-zinc-800 text-zinc-400"
                              : isExpired
                              ? "bg-rose-500/20 text-rose-300"
                              : isFull
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {!c.isActive
                            ? "Pasif"
                            : isExpired
                            ? "Süresi Doldu"
                            : isFull
                            ? "Kota Doldu"
                            : "Aktif"}
                        </span>
                      </div>
                    </div>

                    {c.description && (
                      <p className="text-xs text-zinc-300 leading-relaxed font-sans">{c.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-[11px] text-zinc-400">
                      <div className="flex items-center gap-3">
                        <span>
                          Kullanım:{" "}
                          <b className="text-white font-mono">{c.usedCount || 0}</b> /{" "}
                          <span className="font-mono">{c.maxUses > 0 ? c.maxUses : "Sınırsız"}</span>
                        </span>
                        {c.expiresAt && (
                          <span>
                            Bitiş:{" "}
                            <b className="text-zinc-300">
                              {new Date(c.expiresAt).toLocaleDateString("tr-TR")}
                            </b>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleCouponActive(c)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            c.isActive
                              ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
                              : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          {c.isActive ? "Pasife Al" : "Aktif Et"}
                        </button>
                        <button
                          onClick={() => handleDeleteCoupon(c.id, c.code)}
                          className="p-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                          title="Kuponu Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Yeni Kupon Oluşturma Modalı */}
      {couponModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#11131a] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
                  <Gift className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Yeni Kupon / Kampanya Tanımla</h3>
              </div>
              <button
                onClick={() => setCouponModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Kupon Kodu</label>
                <input
                  type="text"
                  placeholder="ÖRN: HOSGELDIN, YAZ2026, VIP50"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold tracking-wider text-white uppercase focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Kupon Türü</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "BALANCE", label: "🎁 Bakiye", desc: "Doğrudan TL Yükler" },
                    { id: "DISCOUNT_PERCENT", label: "📉 Yüzde %", desc: "SMS'te % İndirim" },
                    { id: "DISCOUNT_FIXED", label: "🏷️ Sabit TL", desc: "SMS'te Sabit ₺" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setCouponType(t.id as any)}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        couponType === t.id
                          ? "bg-purple-500/20 border-purple-500 text-purple-200"
                          : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span className="text-xs font-bold block">{t.label}</span>
                      <span className="text-[9px] text-zinc-500 block">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    {couponType === "DISCOUNT_PERCENT" ? "İndirim Oranı (%)" : "Tutar (₺)"}
                  </label>
                  <input
                    type="number"
                    placeholder={couponType === "DISCOUNT_PERCENT" ? "Örn: 20" : "Örn: 25"}
                    value={couponValue}
                    onChange={(e) => setCouponValue(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-emerald-400 font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Kullanım Limiti (0 = Sınırsız)
                  </label>
                  <input
                    type="number"
                    placeholder="Örn: 100"
                    value={couponMaxUses}
                    onChange={(e) => setCouponMaxUses(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Son Geçerlilik Tarihi (Opsiyonel)
                </label>
                <input
                  type="date"
                  value={couponExpiresAt}
                  onChange={(e) => setCouponExpiresAt(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Kampanya Açıklaması / Notu
                </label>
                <textarea
                  rows={2}
                  placeholder="Örn: İlk defa kayıt olan kullanıcılara hoş geldin hediyesi."
                  value={couponDesc}
                  onChange={(e) => setCouponDesc(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCouponModalOpen(false)}
                className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition-all"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleCreateCoupon}
                disabled={savingCoupon || !couponCode.trim()}
                className="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/25 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {savingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Kuponu Yayınla</span>
              </button>
            </div>
          </div>
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

      {/* 7. DETAYLI KULLANICI İNCELEME MODALI (TÜM NUMARALAR, SMS KODLARI, YÜKLEMELER) */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl bg-[#11131a] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-base shadow-inner">
                  {selectedUserDetail.firstName ? selectedUserDetail.firstName[0].toUpperCase() : "U"}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white">
                      {selectedUserDetail.firstName || "Kullanıcı"} {selectedUserDetail.lastName || ""}
                    </h3>
                    {selectedUserDetail.role === "admin" && (
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-bold">
                        👑 ADMIN
                      </span>
                    )}
                    {selectedUserDetail.isBanned && (
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold">
                        ⛔ BANLI
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mt-0.5">
                    {selectedUserDetail.username ? (
                      <span className="text-emerald-400 font-semibold">@{selectedUserDetail.username}</span>
                    ) : (
                      <span className="text-zinc-500">kullanıcı adı yok</span>
                    )}
                    <span className="text-zinc-600">•</span>
                    <button
                      onClick={() => handleCopyDetail(String(selectedUserDetail.telegramId), "id")}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                      title="ID Kopyala"
                    >
                      <span>ID: {selectedUserDetail.telegramId}</span>
                      {copiedDetailText === "id" ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-zinc-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedUserDetail(null)}
                className="p-1.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* İstatistik Özet Kartları */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-white/5">
                <span className="text-[10px] text-zinc-400 block">Mevcut Bakiye</span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  ₺{selectedUserDetail.balance?.toFixed(2) || "0.00"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-white/5">
                <span className="text-[10px] text-zinc-400 block">Toplam Harcama</span>
                <span className="text-sm font-bold font-mono text-blue-400">
                  ₺{selectedUserDetail.spent || 0}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-white/5">
                <span className="text-[10px] text-zinc-400 block">Alınan Numara</span>
                <span className="text-sm font-bold font-mono text-purple-400">
                  {userActivations.length} Adet
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-white/5">
                <span className="text-[10px] text-zinc-400 block">Gelen SMS Kodu</span>
                <span className="text-sm font-bold font-mono text-amber-400">
                  {userActivations.filter((a) => a.smsCode).length} Adet
                </span>
              </div>
            </div>

            {/* İç Sekmeler */}
            <div className="flex items-center gap-1.5 p-1 bg-zinc-900 rounded-xl border border-white/5 text-xs font-semibold overflow-x-auto no-scrollbar">
              <button
                onClick={() => setUserDetailTab("numbers")}
                className={`py-1.5 px-3 rounded-lg shrink-0 transition-all ${
                  userDetailTab === "numbers"
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                📱 Aldığı Numaralar ({userActivations.length})
              </button>
              <button
                onClick={() => setUserDetailTab("deposits")}
                className={`py-1.5 px-3 rounded-lg shrink-0 transition-all ${
                  userDetailTab === "deposits"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                💳 Bakiye Yüklemeleri ({userDeposits.length})
              </button>
              <button
                onClick={() => setUserDetailTab("tickets")}
                className={`py-1.5 px-3 rounded-lg shrink-0 transition-all ${
                  userDetailTab === "tickets"
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                🎫 Destek Talepleri ({userTickets.length})
              </button>
              <button
                onClick={() => setUserDetailTab("actions")}
                className={`py-1.5 px-3 rounded-lg shrink-0 transition-all ${
                  userDetailTab === "actions"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                ⚡ Yönetici İşlemleri
              </button>
            </div>

            {/* Sekme İçerikleri */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-2 max-h-[50vh]">
              {userDetailLoading ? (
                <div className="p-8 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto" />
                  <p className="text-xs text-zinc-400">Kullanıcının sipariş ve numara geçmişi yükleniyor...</p>
                </div>
              ) : (
                <>
                  {/* 1. NUMARALAR & KODLAR SEKMESİ */}
                  {userDetailTab === "numbers" && (
                    <div className="space-y-2">
                      {userActivations.length === 0 ? (
                        <div className="p-6 text-center text-xs text-zinc-500 bg-zinc-900/40 rounded-2xl border border-white/5">
                          Bu kullanıcı henüz hiç numara satın almamış.
                        </div>
                      ) : (
                        userActivations.map((a) => (
                          <div
                            key={a.id}
                            className="p-3 rounded-2xl bg-zinc-900/90 border border-white/10 space-y-2 hover:border-blue-500/30 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{a.countryFlag || "🌐"}</span>
                                <span className="font-bold text-xs text-white">
                                  {a.serviceName} ({a.countryName})
                                </span>
                              </div>

                              <div>
                                {a.smsCode ? (
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-bold">
                                    ✅ KOD ALINDI
                                  </span>
                                ) : a.status === "WAIT_CODE" ? (
                                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-bold animate-pulse">
                                    ⏳ KOD BEKLENİYOR
                                  </span>
                                ) : a.status === "CANCELLED" ? (
                                  <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded font-bold">
                                    🚫 İPTAL EDİLDİ
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-bold">
                                    {a.status}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Telefon Numarası & Kopyalama Kutusu */}
                            <div className="p-2.5 rounded-xl bg-black/60 border border-white/5 flex items-center justify-between gap-2">
                              <div>
                                <span className="text-[10px] text-zinc-400 block font-sans">Tahsis Edilen Numara:</span>
                                <span className="font-mono font-bold text-sm text-zinc-200 select-all">
                                  {a.phoneNumber}
                                </span>
                              </div>

                              <button
                                onClick={() => handleCopyDetail(a.phoneNumber, `phone_${a.id}`)}
                                className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-xs flex items-center gap-1 font-mono transition-colors"
                              >
                                {copiedDetailText === `phone_${a.id}` ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>Kopyalandı</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Kopyala</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Gelen SMS Kodu Vurgusu */}
                            {a.smsCode ? (
                              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                                <div>
                                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                                    Gelen SMS Onay Kodu:
                                  </span>
                                  <span className="text-base font-black font-mono text-emerald-300 tracking-wider">
                                    {a.smsCode}
                                  </span>
                                  {a.smsText && (
                                    <p className="text-[11px] text-zinc-400 mt-1 italic select-all">
                                      &ldquo;{a.smsText}&rdquo;
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleCopyDetail(a.smsCode, `code_${a.id}`)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-1 transition-all"
                                >
                                  {copiedDetailText === `code_${a.id}` ? "Kopyalandı" : "Kodu Kopyala"}
                                </button>
                              </div>
                            ) : null}

                            {/* Fiyat ve Tarih */}
                            <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-white/[0.04]">
                              <span className="font-mono">Ücret: ₺{a.chargedPrice?.toFixed(2) || "0.00"}</span>
                              <span>
                                {a.createdAt ? new Date(a.createdAt).toLocaleString("tr-TR") : ""}
                              </span>
                              <span className="font-mono text-[10px] text-zinc-600">#{a.id}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* 2. BAKİYE YÜKLEMELERİ SEKMESİ */}
                  {userDetailTab === "deposits" && (
                    <div className="space-y-2">
                      {userDeposits.length === 0 ? (
                        <div className="p-6 text-center text-xs text-zinc-500 bg-zinc-900/40 rounded-2xl border border-white/5">
                          Bu kullanıcı henüz bakiye yükleme talebinde bulunmamış.
                        </div>
                      ) : (
                        userDeposits.map((dep) => (
                          <div
                            key={dep.id}
                            className="p-3 rounded-2xl bg-zinc-900/90 border border-white/10 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-emerald-400 font-mono">
                                +₺{dep.amount?.toFixed(2)}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  dep.status === "APPROVED"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : dep.status === "REJECTED"
                                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                }`}
                              >
                                {dep.status === "APPROVED" ? "ONAYLANDI" : dep.status === "REJECTED" ? "REDDEDİLDİ" : "BEKLEMEDE"}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                              <span>Yöntem: {dep.method || "Kripto / Havale"}</span>
                              <span>{dep.createdAt ? new Date(dep.createdAt).toLocaleString("tr-TR") : ""}</span>
                            </div>
                            {dep.txid && (
                              <p className="text-[10px] font-mono text-zinc-500 truncate">
                                TXID: {dep.txid}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* 3. DESTEK TALEPLERİ SEKMESİ */}
                  {userDetailTab === "tickets" && (
                    <div className="space-y-2">
                      {userTickets.length === 0 ? (
                        <div className="p-6 text-center text-xs text-zinc-500 bg-zinc-900/40 rounded-2xl border border-white/5">
                          Bu kullanıcının henüz destek talebi bulunmuyor.
                        </div>
                      ) : (
                        userTickets.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 rounded-2xl bg-zinc-900/90 border border-white/10 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-white">{t.subject}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  t.status === "OPEN"
                                    ? "bg-amber-500/20 text-amber-300"
                                    : t.status === "ANSWERED"
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-zinc-800 text-zinc-400"
                                }`}
                              >
                                {t.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 truncate">
                              Son Güncelleme: {new Date(t.updatedAt).toLocaleString("tr-TR")}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* 4. YÖNETİCİ HIZLI AKSİYONLARI */}
                  {userDetailTab === "actions" && (
                    <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-white/5 space-y-3">
                      <span className="text-xs font-bold text-white block">
                        Kullanıcıya Özel Yönetici İşlemleri
                      </span>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Bakiye Düzenle */}
                        <button
                          onClick={() => {
                            setEditingUser(selectedUserDetail);
                          }}
                          className="p-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                        >
                          <DollarSign className="w-4 h-4" />
                          <span>Bakiye Ekle / Düzenle</span>
                        </button>

                        {/* Admin Yap / Kaldır */}
                        <button
                          onClick={async () => {
                            await handleToggleRole(selectedUserDetail);
                            setSelectedUserDetail((prev: any) =>
                              prev ? { ...prev, role: prev.role === "admin" ? "user" : "admin" } : prev
                            );
                          }}
                          className="p-3 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                        >
                          <ShieldAlert className="w-4 h-4" />
                          <span>
                            {selectedUserDetail.role === "admin" ? "Adminliği Kaldır" : "Admin Yap"}
                          </span>
                        </button>

                        {/* Banla / Engeli Aç */}
                        <button
                          onClick={async () => {
                            await handleToggleBan(selectedUserDetail);
                            setSelectedUserDetail((prev: any) =>
                              prev ? { ...prev, isBanned: !prev.isBanned } : prev
                            );
                          }}
                          className="p-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                        >
                          {selectedUserDetail.isBanned ? (
                            <>
                              <UserCheck className="w-4 h-4" />
                              <span>Engeli Aç</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-4 h-4" />
                              <span>Kullanıcıyı Banla</span>
                            </>
                          )}
                        </button>

                        {/* Sil */}
                        <button
                          onClick={async () => {
                            await handleDeleteUser(selectedUserDetail);
                            setSelectedUserDetail(null);
                          }}
                          className="p-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Kullanıcıyı Kalıcı Sil</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Alt Kapatma */}
            <div className="pt-2 border-t border-white/[0.08] flex justify-end">
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 hover:text-white font-semibold transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  ArrowRight,
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
  Archive,
  Download,
  Upload,
  HardDrive,
  FileText,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Star,
  Filter,
  Wrench,
  Power,
  CheckCircle2,
} from "lucide-react";
import { Card } from "./tremor/Card";
import { Metric, Text } from "./tremor/Metric";
import { Badge } from "./tremor/Badge";
import { Callout, ProgressBar } from "./tremor/Callout";
import { AreaChart, DonutChart } from "./tremor/Charts";
import { haptic } from "@/lib/haptic";
import { appAlert, appConfirm } from "@/lib/app-dialog";
import { ThemeToggle } from "./ThemeToggle";
import { getTelegramInitData } from "@/lib/telegram-fetch";
import { AdminOrdersTab } from "./admin/AdminOrdersTab";
import { AdminReportsTab } from "./admin/AdminReportsTab";
import { AdminAuditTab } from "./admin/AdminAuditTab";
import { UserLedgerPanel } from "./admin/UserLedgerPanel";
import { MaintenanceScheduleCard } from "./admin/MaintenanceScheduleCard";
import { RentPricingCard } from "./admin/RentPricingCard";
import { fmtAgo } from "./admin/api";
import { HaloSwitch } from "./ui/halo-switch";
import { RollingNumber } from "./ui/rolling-number";
import { ServiceIcon } from "./ServiceIcon";

interface AdminViewProps {
  onBackToApp?: () => void;
  onCurrentUserUpdated?: (user: any) => void;
  /** "support": yalnızca destek talepleri sekmesi (diğer admin API'leri zaten reddeder) */
  staffRole?: "admin" | "support";
}

export function AdminView({ onBackToApp, onCurrentUserUpdated, staffRole = "admin" }: AdminViewProps) {
  const isSupportOnly = staffRole === "support";
  const [activeTab, setActiveTab] = useState<"overview" | "pricing" | "bank" | "users" | "deposits" | "broadcast" | "tickets" | "coupons" | "backups" | "logs" | "orders" | "reports" | "audit">(staffRole === "support" ? "tickets" : "overview");
  const [overview, setOverview] = useState<any>(null);
  const [settingsData, setSettingsData] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Maintenance mode states
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>("");
  const [togglingMaintenance, setTogglingMaintenance] = useState<boolean>(false);
  const [savingMaintenance, setSavingMaintenance] = useState<boolean>(false);

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
  const [apironeAccount, setApironeAccount] = useState<string>("");
  const [apironeTransferKey, setApironeTransferKey] = useState<string>("");
  const [oxapayApiKey, setOxapayApiKey] = useState<string>("");
  const [autoVerifyEnabled, setAutoVerifyEnabled] = useState<boolean>(true);
  const [savingCrypto, setSavingCrypto] = useState<boolean>(false);
  const [testingApirone, setTestingApirone] = useState<boolean>(false);
  const [creatingApirone, setCreatingApirone] = useState<boolean>(false);
  const [settingForwarding, setSettingForwarding] = useState<boolean>(false);
  const [apironeTestResult, setApironeTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
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
  const [tcmbUpdateIntervalMinutes, setTcmbUpdateIntervalMinutes] = useState<number>(30);
  const [lastTcmbRate, setLastTcmbRate] = useState<number>(49.2);
  const [lastTcmbFetchTime, setLastTcmbFetchTime] = useState<string>("");
  const [tcmbRefreshing, setTcmbRefreshing] = useState<boolean>(false);

  // User management states
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  // Servis görünürlük kontrolü: tüm servisler + arama / filtre
  const [serviceVisSearch, setServiceVisSearch] = useState<string>("");
  const [serviceVisFilter, setServiceVisFilter] = useState<"all" | "hidden" | "visible">("all");
  // Sunucu araması (telefon numarası / TXID ile): eşleşen Telegram ID'leri; null = yerel filtre
  const [serverSearchIds, setServerSearchIds] = useState<Set<number> | null>(null);
  const [serverSearching, setServerSearching] = useState<boolean>(false);
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "banned" | "balance" | "staff">("all");
  const [userActionLoadingId, setUserActionLoadingId] = useState<number | null>(null);

  // User detail inspection states (Tüm numaralar, SMS kodları, yüklemeler, detaylar)
  const [selectedUserDetail, setSelectedUserDetail] = useState<any | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState<boolean>(false);
  const [userActivations, setUserActivations] = useState<any[]>([]);
  const [userDeposits, setUserDeposits] = useState<any[]>([]);
  const [userTickets, setUserTickets] = useState<any[]>([]);
  const [userDetailTab, setUserDetailTab] = useState<"numbers" | "deposits" | "tickets" | "ledger" | "actions">("numbers");
  const [copiedDetailText, setCopiedDetailText] = useState<string | null>(null);

  // Balance edit modal state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [balanceDelta, setBalanceDelta] = useState<string>("50");
  const [balanceEditMode, setBalanceEditMode] = useState<"exact" | "delta">("exact");
  const [exactBalanceInput, setExactBalanceInput] = useState<string>("0");
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

  // Yedekleme & Geri Yükleme Durumları
  const [backups, setBackups] = useState<any[]>([]);
  const [backupSettings, setBackupSettings] = useState<{
    autoBackupEnabled: boolean;
    autoBackupIntervalHours: number;
    maxBackupsCount: number;
    lastBackupAt?: string;
    lastBackupTime?: string;
    lastAutoBackupTime?: string;
  }>({
    autoBackupEnabled: true,
    autoBackupIntervalHours: 6,
    maxBackupsCount: 20,
  });
  const [creatingBackup, setCreatingBackup] = useState<boolean>(false);
  const [restoringBackup, setRestoringBackup] = useState<boolean>(false);
  const [savingBackupSettings, setSavingBackupSettings] = useState<boolean>(false);
  const [selectedBackupToRestore, setSelectedBackupToRestore] = useState<any | null>(null);
  const [uploadedFileBackup, setUploadedFileBackup] = useState<any | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [restoreConfirmModalOpen, setRestoreConfirmModalOpen] = useState<boolean>(false);
  const [restoreTargetType, setRestoreTargetType] = useState<"snapshot" | "file">("snapshot");
  const [backupSecurityPin, setBackupSecurityPin] = useState<string>("");

  // Sistem Logları (Audit Logs) Durumları
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [logCategoryFilter, setLogCategoryFilter] = useState<string>("ALL");
  const [logLevelFilter, setLogLevelFilter] = useState<string>("ALL");
  const [logSearchQuery, setLogSearchQuery] = useState<string>("");
  const [clearingLogs, setClearingLogs] = useState<boolean>(false);

  // VIP Üyelik Durumları & Ayarları
  const [userVipFilter, setUserVipFilter] = useState<"all" | "vip" | "standard">("all");
  const [vipModalOpen, setVipModalOpen] = useState<boolean>(false);
  const [vipTargetUser, setVipTargetUser] = useState<any | null>(null);
  const [vipDiscountInput, setVipDiscountInput] = useState<number>(15);
  const [vipSettingsDefaultDiscount, setVipSettingsDefaultDiscount] = useState<number>(15);
  const [vipSettingsAutoDeposit, setVipSettingsAutoDeposit] = useState<number>(500);
  const [vipSettingsEnabled, setVipSettingsEnabled] = useState<boolean>(true);
  const [savingVipSettings, setSavingVipSettings] = useState<boolean>(false);

  // Güvenli Admin Başlıkları (Dahili Admin Doğrulaması)
  const getAdminTelegramId = () => {
    const tg = typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null;
    return tg?.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : "";
  };

  const getAdminHeaders = () => {
    const tgId = getAdminTelegramId();
    return {
      "x-admin-request": "true",
      ...(tgId ? { "x-telegram-id": tgId } : {}),
    };
  };

  const adminFetch = (url: string, options: RequestInit = {}) => {
    const headers = {
      ...getAdminHeaders(),
      ...(options.headers || {}),
    };
    return fetch(url, { ...options, headers });
  };

  // Kullanıcı Son Görülme ve Canlılık Formatlayıcı (Tüm alanlarda tutarlı)
  const formatUserLastActive = (dateStr?: string) => {
    if (!dateStr) return "Bilinmiyor";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "Bilinmiyor";
      const now = Date.now();
      const diffMs = Math.max(0, now - d.getTime());
      if (diffMs < 60 * 1000) return "Az önce";
      const diffMins = Math.floor(diffMs / (60 * 1000));
      if (diffMins < 60) return `${diffMins} dk önce`;
      const diffHours = Math.floor(diffMs / (3600 * 1000));
      const timeStr = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      if (diffHours < 24) return `${diffHours} sa önce (${timeStr})`;
      const diffDays = Math.floor(diffMs / (86400 * 1000));
      if (diffDays === 1) return `Dün ${timeStr}`;
      if (diffDays < 7) return `${diffDays} gün önce (${timeStr})`;
      return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  const fetchAllData = async () => {
    setRefreshing(true);
    const headers = getAdminHeaders();
    if (isSupportOnly) {
      // Destek görevlisi yalnızca destek taleplerine erişebilir
      try {
        const tck = await fetch("/api/admin/tickets", { headers, cache: "no-store" }).then((r) => r.json());
        if (tck.success) setTickets(tck.tickets || []);
      } catch {}
      setRefreshing(false);
      return;
    }
    try {
      const [ovRes, setRes, uRes, depRes, tckRes, cpnRes, bkpRes] = await Promise.all([
        fetch("/api/admin/overview", { headers, cache: "no-store" }),
        fetch("/api/admin/settings", { headers, cache: "no-store" }),
        fetch("/api/admin/users", { headers, cache: "no-store" }),
        fetch("/api/admin/deposits", { headers, cache: "no-store" }),
        fetch("/api/admin/tickets", { headers, cache: "no-store" }),
        fetch("/api/admin/coupons", { headers, cache: "no-store" }),
        fetch("/api/admin/backups?action=list", { headers, cache: "no-store" }),
      ]);

      const [ov, st, us, dep, tck, cpn, bkp] = await Promise.all([
        ovRes.json(),
        setRes.json(),
        uRes.json(),
        depRes.json(),
        tckRes.json(),
        cpnRes.json(),
        bkpRes.json(),
      ]);

      if (ov.success) setOverview(ov);
      if (st.success) {
        setSettingsData(st);
        setMarginPercent(st.settings.globalMarginPercent);
        setFixedFee(st.settings.globalFixedFee);
        setRateToTry(st.settings.exchangeRateToTry);
        setMockMode(st.settings.mockMode);
        if (st.settings?.maintenanceMode !== undefined) {
          setMaintenanceMode(Boolean(st.settings.maintenanceMode));
        }
        if (st.settings?.maintenanceMessage !== undefined) {
          setMaintenanceMessage(st.settings.maintenanceMessage || "");
        }
        setUseTcmbAutoRate(st.settings.useTcmbAutoRate ?? true);
        setTcmbUpdateIntervalMinutes(st.settings.tcmbUpdateIntervalMinutes ?? 30);
        setLastTcmbRate(st.tcmbRateInfo?.rate || st.settings.lastTcmbRate || 49.2);
        setLastTcmbFetchTime(st.settings.lastTcmbFetchTime || st.tcmbRateInfo?.timestamp || "");
        if (st.settings?.bankInfo) {
          setBankName(st.settings.bankInfo.bankName || "");
          setAccountHolder(st.settings.bankInfo.accountHolder || "");
          setIban(st.settings.bankInfo.iban || "");
          setDescriptionNote(st.settings.bankInfo.descriptionNote || "");
        }
        if (st.settings?.cryptoSettings) {
          const cs = st.settings.cryptoSettings;
          if (cs.usdtTrc20Address) {
            setUsdtTrc20Address(cs.usdtTrc20Address);
            try { localStorage.setItem("azfur_usdt_trc20_address", cs.usdtTrc20Address); } catch {}
          }
          if (cs.trxAddress) {
            setTrxAddress(cs.trxAddress);
            try { localStorage.setItem("azfur_trx_address", cs.trxAddress); } catch {}
          }
          if (cs.apironeAccount) {
            setApironeAccount(cs.apironeAccount);
            try { localStorage.setItem("azfur_apirone_account", cs.apironeAccount); } catch {}
          }
          if (cs.apironeTransferKey) {
            setApironeTransferKey(cs.apironeTransferKey);
          }
          setOxapayApiKey(cs.oxapayApiKey || "");
          setAutoVerifyEnabled(cs.autoVerifyEnabled ?? true);
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
        if (st.settings?.vipSettings) {
          setVipSettingsDefaultDiscount(st.settings.vipSettings.defaultDiscountPercent ?? 15);
          setVipSettingsAutoDeposit(st.settings.vipSettings.autoVipOnDepositAmount ?? 500);
          setVipSettingsEnabled(st.settings.vipSettings.enabled ?? true);
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
      if (bkp?.success) {
        setBackups(bkp.backups || []);
        if (bkp.backupSettings) {
          setBackupSettings(bkp.backupSettings);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Apirone ve cüzdan bilgilerini yerel depolamadan (localStorage) anında yükle (Asla silinmez)
  useEffect(() => {
    try {
      const localAcc = localStorage.getItem("azfur_apirone_account");
      // Gizli transfer anahtarı artık cihazda saklanmaz; eski sürümlerden kalan kaydı temizle
      localStorage.removeItem("azfur_apirone_transfer_key");
      const localUsdt = localStorage.getItem("azfur_usdt_trc20_address");
      const localTrx = localStorage.getItem("azfur_trx_address");
      if (localAcc) setApironeAccount(localAcc);
      if (localUsdt) setUsdtTrc20Address(localUsdt);
      if (localTrx) setTrxAddress(localTrx);
    } catch {}
  }, []);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => {
      fetchAllData();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // Yeni Kupon Oluştur
  const handleCreateCoupon = async () => {
    if (!couponCode.trim()) {
      appAlert("Lütfen kupon kodu giriniz.");
      return;
    }
    const val = parseFloat(couponValue);
    if (isNaN(val) || val <= 0) {
      appAlert("Lütfen geçerli bir tutar veya yüzde giriniz.");
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
        appAlert(data.error || "Kupon oluşturulamadı");
      }
    } catch {
      appAlert("Hata oluştu");
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
    if (!await appConfirm(`'${code}' kuponunu kalıcı olarak silmek istediğinize emin misiniz?`)) return;
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
      } else {
        haptic.error();
        appAlert(data.error || "Kupon silinemedi. Lütfen tekrar deneyin.");
      }
    } catch (e) {
      console.error(e);
      haptic.error();
      appAlert("Kupon silinirken sunucuya ulaşılamadı. Lütfen tekrar deneyin.");
    }
  };

  // Sistem Bakım Modunu Aç / Kapat
  const handleToggleMaintenance = async (targetMode?: boolean) => {
    const nextMode = targetMode !== undefined ? targetMode : !maintenanceMode;
    haptic.impact("heavy");
    setTogglingMaintenance(true);
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenanceMode: nextMode,
          maintenanceMessage: maintenanceMessage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMaintenanceMode(nextMode);
        if (nextMode) {
          haptic.impact("heavy");
        } else {
          haptic.success();
        }
        setToastMsg(
          nextMode
            ? "🛠️ Sistem Bakım Moduna Alındı! (Normal kullanıcıların erişimi kapalı)"
            : "🟢 Bakım Modu Kapatıldı! Sistem tüm kullanıcılara açıldı."
        );
        setTimeout(() => setToastMsg(null), 4000);
      } else {
        haptic.error();
        appAlert(data.error || "Bakım modu güncellenemedi.");
      }
    } catch (e: any) {
      haptic.error();
      appAlert("Hata: " + e.message);
    } finally {
      setTogglingMaintenance(false);
    }
  };

  // Özel Bakım Mesajını Kaydet
  const handleSaveMaintenanceMessage = async () => {
    haptic.impact("medium");
    setSavingMaintenance(true);
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenanceMessage: maintenanceMessage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg("✅ Özel bakım mesajı başarıyla güncellendi.");
        setTimeout(() => setToastMsg(null), 3000);
      } else {
        haptic.error();
        appAlert(data.error || "Kayıt hatası");
      }
    } catch (e: any) {
      haptic.error();
      appAlert("Hata: " + e.message);
    } finally {
      setSavingMaintenance(false);
    }
  };

  // Manuel Sistem Yedeği Oluştur
  const handleCreateBackup = async (customLabel?: string) => {
    setCreatingBackup(true);
    haptic.impact("medium");
    try {
      const res = await adminFetch("/api/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          type: "MANUAL",
          label:
            customLabel ||
            `Manuel Sistem Yedeği - ${new Date().toLocaleDateString("tr-TR")} ${new Date().toLocaleTimeString(
              "tr-TR",
              { hour: "2-digit", minute: "2-digit" }
            )}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg("✅ Sistem yedeği başarıyla oluşturuldu ve buluta kaydedildi!");
        setTimeout(() => setToastMsg(null), 3500);
        if (data.backup) {
          setBackups((prev) => [data.backup, ...prev.filter((x) => x.id !== data.backup.id)]);
        }
        if (data.backupSettings) {
          setBackupSettings(data.backupSettings);
        } else if (data.backup?.createdAt || data.backup?.timestamp) {
          const ts = data.backup.createdAt || data.backup.timestamp;
          setBackupSettings((prev) => ({
            ...prev,
            lastBackupAt: ts,
            lastBackupTime: ts,
          }));
        }
        fetchAllData();
      } else {
        haptic.error();
        appAlert(data.error || "Yedek oluşturulamadı");
      }
    } catch (e: any) {
      haptic.error();
      appAlert("Yedek oluşturulurken hata oluştu: " + (e?.message || ""));
    } finally {
      setCreatingBackup(false);
    }
  };

  // Canlı Veritabanını SQL Olarak İndir (.sql)
  const handleDownloadCurrentDatabase = async () => {
    haptic.impact("light");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    // Tarayıcıda açılan indirmelerde başlık gönderilemez: imzalı Telegram oturumu sorguda taşınır
    const initData = getTelegramInitData();
    const authQuery = initData ? `&initData=${encodeURIComponent(initData)}` : "";
    const downloadUrl = `${origin}/api/admin/backups?action=download_current${authQuery}`;

    const tg = typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null;

    // 1. Telegram WebApp içindeyse blob indirme WebView tarafından engellenir; openLink ile aç
    if (tg?.openLink) {
      try {
        tg.openLink(downloadUrl);
        setToastMsg("📥 Canlı SQL veritabanı indirme bağlantısı tarayıcınızda açıldı!");
        setTimeout(() => setToastMsg(null), 3500);
        return;
      } catch (err) {
        console.warn("tg.openLink failed, falling back to blob:", err);
      }
    }

    // 2. Normal tarayıcı için: Fetch ile Blob olarak indir
    try {
      const res = await adminFetch("/api/admin/backups?action=download_current");
      if (!res.ok) {
        window.location.href = downloadUrl;
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const datePart = new Date().toISOString().slice(0, 10);
      a.download = `azfur_veritabani_canli_${datePart}.sql`;
      document.body.appendChild(a);
      a.click();

      // DİKKAT: revokeObjectURL hemen çağrılırsa Chromium/Safari indirmeyi iptal eder! 60 saniye sonra serbest bırak
      setTimeout(() => {
        try {
          window.URL.revokeObjectURL(url);
          if (document.body.contains(a)) document.body.removeChild(a);
        } catch {}
      }, 60000);

      haptic.success();
      setToastMsg("📥 Canlı PostgreSQL veritabanı SQL yedeği başarıyla indirildi!");
      setTimeout(() => setToastMsg(null), 3500);
    } catch {
      try {
        window.location.href = downloadUrl;
      } catch (e: any) {
        haptic.error();
        appAlert("Canlı veritabanı indirilemedi: " + (e?.message || ""));
      }
    }
  };

  // Kayıtlı Snapshot'ı SQL Olarak İndir (.sql)
  const handleDownloadSnapshot = async (backupId: string, rawDate?: string) => {
    haptic.impact("light");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    // Tarayıcıda açılan indirmelerde başlık gönderilemez: imzalı Telegram oturumu sorguda taşınır
    const initData = getTelegramInitData();
    const authQuery = initData ? `&initData=${encodeURIComponent(initData)}` : "";
    const downloadUrl = `${origin}/api/admin/backups?action=download&id=${encodeURIComponent(backupId)}${authQuery}`;

    const tg = typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null;

    // 1. Telegram WebApp içindeyse blob indirme WebView tarafından engellenir; openLink ile aç
    if (tg?.openLink) {
      try {
        tg.openLink(downloadUrl);
        setToastMsg("📥 SQL yedek indirme bağlantısı tarayıcınızda açıldı!");
        setTimeout(() => setToastMsg(null), 3500);
        return;
      } catch (err) {
        console.warn("tg.openLink failed, falling back to blob:", err);
      }
    }

    // 2. Normal tarayıcı için: Fetch ile Blob olarak indir
    try {
      const res = await adminFetch(
        `/api/admin/backups?action=download&id=${encodeURIComponent(backupId)}`
      );
      if (!res.ok) {
        window.location.href = downloadUrl;
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let datePart = "backup";
      try {
        const d = rawDate ? new Date(rawDate) : new Date();
        datePart = isNaN(d.getTime())
          ? new Date().toISOString().slice(0, 10)
          : d.toISOString().slice(0, 19).replace(/[:T]/g, "_");
      } catch {
        datePart = new Date().toISOString().slice(0, 10);
      }
      a.download = `azfur_yedek_${datePart}.sql`;
      document.body.appendChild(a);
      a.click();

      // DİKKAT: revokeObjectURL hemen çağrılırsa Chromium/Safari indirmeyi iptal eder! 60 saniye sonra serbest bırak
      setTimeout(() => {
        try {
          window.URL.revokeObjectURL(url);
          if (document.body.contains(a)) document.body.removeChild(a);
        } catch {}
      }, 60000);

      haptic.success();
      setToastMsg("📥 SQL yedek dosyası başarıyla indirildi!");
      setTimeout(() => setToastMsg(null), 3500);
    } catch {
      try {
        window.location.href = downloadUrl;
      } catch (e: any) {
        haptic.error();
        appAlert("Yedek dosyası indirilemedi: " + (e?.message || ""));
      }
    }
  };

  // Yedek Kaydını Sil
  const handleDeleteBackup = async (backupId: string) => {
    if (!await appConfirm("Bu sistem yedeğini silmek istediğinize emin misiniz?")) return;
    haptic.impact("medium");
    try {
      const res = await adminFetch("/api/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", backupId }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setBackups((prev) => prev.filter((b) => b.id !== backupId));
        setToastMsg("🗑️ Yedek kaydı başarıyla silindi.");
        setTimeout(() => setToastMsg(null), 3000);
      } else {
        haptic.error();
        appAlert(data.error || "Silinemedi");
      }
    } catch {
      haptic.error();
      appAlert("Hata oluştu");
    }
  };

  // Otomatik Yedekleme Ayarlarını Kaydet
  const handleSaveBackupSettings = async (overrides?: any) => {
    setSavingBackupSettings(true);
    haptic.impact("medium");
    const payload = {
      ...backupSettings,
      ...(overrides || {}),
    };
    try {
      const res = await adminFetch("/api/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_settings",
          settings: payload,
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setBackupSettings(data.backupSettings);
        setToastMsg("⚙️ Otomatik yedekleme ayarları kaydedildi!");
        setTimeout(() => setToastMsg(null), 3000);
      } else {
        haptic.error();
        appAlert(data.error || "Ayarlar kaydedilemedi");
      }
    } catch {
      haptic.error();
      appAlert("Ayarlar kaydedilirken hata oluştu");
    } finally {
      setSavingBackupSettings(false);
    }
  };

  // Bilgisayardan/Telefondan Yedek Dosyası Seç (.sql / .json)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isSql = lowerName.endsWith(".sql");
    const isJson = lowerName.endsWith(".json");

    if (!isSql && !isJson) {
      appAlert("Lütfen yalnızca .sql veya .json uzantılı yedek dosyası seçiniz!");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let dbData: any = null;

        if (isSql) {
          const match = text.match(/-- AZFUR_SNAPSHOT_JSON_BEGIN\s*\n-- ([\s\S]*?)\s*\n-- AZFUR_SNAPSHOT_JSON_END/);
          if (match && match[1]) {
            dbData = JSON.parse(match[1]);
          } else {
            throw new Error("Seçilen SQL dosyası içerisinde AzFur veritabanı yedeği verileri bulunamadı.");
          }
        } else {
          const parsed = JSON.parse(text);
          dbData = parsed;
          if (
            parsed.data &&
            typeof parsed.data === "object" &&
            (parsed.data.users || parsed.data.settings)
          ) {
            dbData = parsed.data;
          }
        }

        if (!dbData.users) {
          throw new Error(
            "Dosya içeriğinde kullanıcı listesi ('users') bulunamadı! Lütfen geçerli bir AzFur yedek dosyası seçiniz."
          );
        }

        setUploadedFileBackup(dbData);
        setUploadedFileName(file.name);
        setRestoreTargetType("file");
        setRestoreConfirmModalOpen(true);
        haptic.selection();
      } catch (err: any) {
        haptic.error();
        appAlert("Geçersiz yedek dosyası: " + (err?.message || "Dosya okunamadı"));
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  // Geri Yükleme Onayla ve Uygula (Güvenlik PIN'i ve Rate Limit korumalı)
  const handleConfirmRestore = async () => {
    if (!backupSecurityPin.trim()) {
      appAlert("Lütfen Yönetici PIN kodunu giriniz!");
      return;
    }

    setRestoringBackup(true);
    haptic.impact("heavy");
    try {
      let res;
      const headers = {
        "Content-Type": "application/json",
        "x-admin-pin": backupSecurityPin.trim(),
      };

      if (restoreTargetType === "file" && uploadedFileBackup) {
        res = await adminFetch("/api/admin/backups", {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "restore_upload",
            payload: uploadedFileBackup,
          }),
        });
      } else if (restoreTargetType === "snapshot" && selectedBackupToRestore) {
        res = await adminFetch("/api/admin/backups", {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "restore_id",
            backupId: selectedBackupToRestore.id,
          }),
        });
      } else {
        appAlert("Geri yüklenecek geçerli bir yedek seçilmedi");
        setRestoringBackup(false);
        return;
      }

      const data = await res.json();
      if (res.status === 429) {
        haptic.error();
        appAlert(
          data.error ||
            "⚠️ Çok fazla hatalı PIN denemesi yapıldı! Brute-force koruması nedeniyle sistem 15 dakika kilitlendi."
        );
        return;
      }

      if (data.success) {
        haptic.success();
        setToastMsg("🎉 Yedek başarıyla geri yüklendi! Sistem verileri güncellendi.");
        setTimeout(() => setToastMsg(null), 4000);
        setRestoreConfirmModalOpen(false);
        setSelectedBackupToRestore(null);
        setUploadedFileBackup(null);
        setUploadedFileName("");
        fetchAllData();
      } else {
        haptic.error();
        appAlert(data.error || "Geri yükleme işlemi başarısız oldu");
      }
    } catch (e: any) {
      haptic.error();
      appAlert("Geri yükleme sırasında hata oluştu: " + (e?.message || ""));
    } finally {
      setRestoringBackup(false);
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
          tcmbUpdateIntervalMinutes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg("Kur ve sistem ayarları veritabanına kaydedildi.");
        setTimeout(() => setToastMsg(null), 3000);
      } else {
        haptic.error();
        appAlert(data.error || "Ayarlar kaydedilemedi");
      }
    } catch (e: any) {
      haptic.error();
      appAlert(e?.message || "Ayarlar kaydedilemedi");
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
          setLastTcmbRate(newRate);
          if (useTcmbAutoRate) setRateToTry(newRate);
        }
        if (data.settings?.lastTcmbFetchTime) {
          setLastTcmbFetchTime(data.settings.lastTcmbFetchTime);
        }
        setToastMsg(`TCMB Canlı Kuru Alındı: ₺${Number(newRate).toFixed(4)}`);
        setTimeout(() => setToastMsg(null), 3500);
      } else {
        haptic.error();
        appAlert(data.error || "TCMB kuru güncellenemedi");
      }
    } catch (e) {
      haptic.error();
      appAlert("TCMB servisine bağlanılamadı");
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
        if (data.user && onCurrentUserUpdated) {
          onCurrentUserUpdated(data.user);
        }
        setTimeout(() => setToastMsg(null), 3000);
        fetchAllData();
      } else {
        haptic.error();
        appAlert(data.error || "Bakiye güncellenemedi");
        fetchAllData();
      }
    } catch (e) {
      haptic.error();
      fetchAllData();
    }
  };

  const handleSetExactBalance = async () => {
    if (!editingUser) return;
    const targetBal = parseFloat(exactBalanceInput);
    if (isNaN(targetBal) || targetBal < 0) {
      appAlert("Lütfen geçerli bir bakiye tutarı giriniz (0 veya daha büyük)");
      return;
    }

    haptic.impact("heavy");
    const targetId = editingUser.telegramId;
    setUsers((prev) =>
      prev.map((u) => (u.telegramId === targetId ? { ...u, balance: targetBal } : u))
    );
    setEditingUser(null);

    try {
      const res = await adminFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_balance",
          telegramId: targetId,
          newBalance: targetBal,
          reason: "Admin doğrudan bakiye belirleme",
          userData: {
            telegramId: editingUser.telegramId,
            username: editingUser.username,
            firstName: editingUser.firstName,
            lastName: editingUser.lastName,
            balance: targetBal,
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
          if (onCurrentUserUpdated) {
            onCurrentUserUpdated(data.user);
          }
        }
        setToastMsg(`Bakiye doğrudan ₺${targetBal.toFixed(2)} olarak belirlendi.`);
        setTimeout(() => setToastMsg(null), 3000);
        fetchAllData();
      } else {
        haptic.error();
        appAlert(data.error || "Bakiye güncellenemedi");
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
      !await appConfirm(
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
        appAlert(data.error || "Sıfırlama başarısız oldu");
      }
    } catch {
      haptic.error();
      appAlert("Hata oluştu");
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
        appAlert(data.error || "Kayıt başarısız");
      }
    } catch {
      haptic.error();
      appAlert("Hata oluştu");
    } finally {
      setSavingBank(false);
    }
  };

  // Kripto Cüzdan Ayarlarını Kaydet
  const handleSaveCryptoSettings = async () => {
    setSavingCrypto(true);
    haptic.impact("medium");
    try {
      const acc = apironeAccount.trim();
      const key = apironeTransferKey.trim();
      const trc = usdtTrc20Address.trim();
      const trx = trxAddress.trim();

      // Client tarafında da anında kalıcı olarak sakla
      if (acc) {
        try { localStorage.setItem("azfur_apirone_account", acc); } catch {}
      }
      if (key) {
      }
      if (trc) {
        try { localStorage.setItem("azfur_usdt_trc20_address", trc); } catch {}
      }
      if (trx) {
        try { localStorage.setItem("azfur_trx_address", trx); } catch {}
      }

      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cryptoSettings: {
            usdtTrc20Address: trc,
            trxAddress: trx,
            apironeAccount: acc,
            apironeTransferKey: key,
            oxapayApiKey,
            autoVerifyEnabled,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg("✅ Kripto cüzdan ve Apirone ayarları kalıcı olarak kaydedildi!");
        setTimeout(() => setToastMsg(null), 3000);
        if (data.settings?.cryptoSettings) {
          const cs = data.settings.cryptoSettings;
          if (cs.apironeAccount) {
            setApironeAccount(cs.apironeAccount);
            try { localStorage.setItem("azfur_apirone_account", cs.apironeAccount); } catch {}
          }
          if (cs.apironeTransferKey) {
            setApironeTransferKey(cs.apironeTransferKey);
          }
          if (cs.usdtTrc20Address) {
            setUsdtTrc20Address(cs.usdtTrc20Address);
            try { localStorage.setItem("azfur_usdt_trc20_address", cs.usdtTrc20Address); } catch {}
          }
        }
      } else {
        haptic.error();
        appAlert(data.error || "Kayıt başarısız");
      }
    } catch {
      haptic.error();
      appAlert("Hata oluştu");
    } finally {
      setSavingCrypto(false);
    }
  };

  // Apirone Hesabını Test Et
  const handleTestApironeAccount = async () => {
    if (!apironeAccount.trim()) {
      appAlert("Lütfen önce bir Apirone Account ID (örn: apr-...) giriniz.");
      return;
    }
    setTestingApirone(true);
    setApironeTestResult(null);
    haptic.impact("medium");
    try {
      const acc = apironeAccount.trim();
      const key = apironeTransferKey.trim();
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_apirone_account",
          account: acc,
          transferKey: key,
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        try {
          if (acc) localStorage.setItem("azfur_apirone_account", acc);
        } catch {}
        setApironeTestResult({
          success: true,
          message: data.message || "Apirone Bağlantısı Başarılı ve Hesap Aktif!",
        });
      } else {
        haptic.error();
        setApironeTestResult({
          success: false,
          message: data.error || "Geçersiz hesap veya bağlantı hatası.",
        });
      }
    } catch {
      haptic.error();
      setApironeTestResult({
        success: false,
        message: "Apirone sunucusuna ulaşılamadı.",
      });
    } finally {
      setTestingApirone(false);
    }
  };

  // Tek Tıkla Otomatik Apirone Hesabı Oluştur
  const handleCreateApironeAccount = async () => {
    setCreatingApirone(true);
    setApironeTestResult(null);
    haptic.impact("heavy");
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_apirone_account" }),
      });
      const data = await res.json();
      if (data.success && data.account) {
        haptic.success();
        setApironeAccount(data.account);
        if (data.transferKey) setApironeTransferKey(data.transferKey);
        setApironeTestResult({
          success: true,
          message: `🎉 Yeni Apirone Hesabı Oluşturuldu: ${data.account}`,
        });
        setToastMsg("✅ Apirone hesabı oluşturuldu ve sisteme bağlandı!");
        setTimeout(() => setToastMsg(null), 3500);
        fetchAllData();
      } else {
        haptic.error();
        setApironeTestResult({
          success: false,
          message: data.error || "Hesap oluşturulamadı.",
        });
      }
    } catch {
      haptic.error();
      setApironeTestResult({
        success: false,
        message: "Apirone sunucusuna bağlanırken hata oluştu.",
      });
    } finally {
      setCreatingApirone(false);
    }
  };

  // Apirone Cüzdan Yönlendirmesini (Forwarding) Ayarla
  const handleSetApironeForwarding = async () => {
    if (!apironeAccount.trim() || !apironeTransferKey.trim()) {
      appAlert("Yönlendirme için lütfen önce Apirone Account ID ve Transfer Key alanlarını doldurunuz.");
      return;
    }
    const targetAddr = (usdtTrc20Address || trxAddress || "").trim();
    if (!targetAddr || targetAddr === "TR7NHqJEKQxGTCi8q8ZY4pL8otSzgjLj6t") {
      appAlert("⚠️ Lütfen yukarıdaki 'USDT (TRC-20) Cüzdan Adresi' kutusuna kendi şahsi TRON cüzdan adresinizi (örn: TrustWallet, TronLink, Binance veya BtcTurk cüzdanınız) giriniz.\n\nVarsayılan 'TR7NHq...' adresi Tether akıllı kontrat adresidir ve bir kişisel cüzdan değildir.");
      return;
    }
    if (!targetAddr.startsWith("T") || targetAddr.length !== 34) {
      appAlert("⚠️ Girdiğiniz cüzdan adresi geçerli bir TRON cüzdan formatında değil! (Tron cüzdan adresleri 'T' harfi ile başlamalı ve tam 34 karakter olmalıdır).");
      return;
    }
    setSettingForwarding(true);
    haptic.impact("medium");
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_apirone_forwarding",
          account: apironeAccount.trim(),
          transferKey: apironeTransferKey.trim(),
          destinationAddress: targetAddr,
          currency: "usdt@trx",
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        try {
          if (apironeAccount.trim()) localStorage.setItem("azfur_apirone_account", apironeAccount.trim());
          if (targetAddr) localStorage.setItem("azfur_usdt_trc20_address", targetAddr);
        } catch {}
        appAlert("✅ Gelen tüm USDT (TRC-20) ödemelerinin kişisel cüzdanınıza otomatik aktarılması (Forwarding) başarıyla aktif edildi!");
      } else {
        haptic.error();
        appAlert(data.error || "Yönlendirme ayarlanamadı.");
      }
    } catch {
      haptic.error();
      appAlert("İşlem sırasında hata oluştu.");
    } finally {
      setSettingForwarding(false);
    }
  };

  // OxaPay API Anahtarını Test Et
  const handleTestOxapayKey = async () => {
    if (!oxapayApiKey.trim()) {
      appAlert("Lütfen önce bir OxaPay Merchant API Key giriniz.");
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
      appAlert("Lütfen gönderilecek mesajı yazınız.");
      return;
    }
    if (broadcastTarget === "user" && !selectedUserId) {
      appAlert("Lütfen mesaj gönderilecek kullanıcıyı seçiniz.");
      return;
    }

    const targetDesc =
      broadcastTarget === "all"
        ? `tüm ${users.length} kayıtlı kullanıcıya toplu duyuru olarak`
        : `${selectedUserId} ID'li kullanıcıya özel mesaj olarak`;

    if (!await appConfirm(`Mesaj ${targetDesc} gönderilecektir. Devam etmek istiyor musunuz?`)) {
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
        appAlert(data.error || "Gönderim başarısız");
      }
    } catch {
      haptic.error();
      appAlert("Hata oluştu");
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
        appAlert(data.error || "Kayıt başarısız");
      }
    } catch {
      haptic.error();
      appAlert("Hata oluştu");
    } finally {
      setSavingSupportUser(false);
    }
  };

  // Yeni Kullanıcı Adı Ekle
  const handleAddSupportUser = async () => {
    const clean = newSupportUsername.trim().replace(/^@/, "");
    if (!clean) {
      appAlert("Lütfen bir kullanıcı adı giriniz.");
      return;
    }
    if (supportTelegramUsernames.includes(clean)) {
      appAlert(`@${clean} zaten listede mevcut.`);
      return;
    }
    const updated = [...supportTelegramUsernames, clean];
    setSupportTelegramUsernames(updated);
    setNewSupportUsername("");
    await persistSupportUsers(updated);
  };

  // Kullanıcı Adı Sil
  const handleDeleteSupportUser = async (targetUser: string) => {
    if (!await appConfirm(`@${targetUser} kullanıcısını destek listesinden silmek istediğinize emin misiniz?`)) {
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
        appAlert(data.error || "Kayıt başarısız");
      }
    } catch {
      haptic.error();
      appAlert("Hata oluştu");
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
        appAlert(data.error || "Kayıt başarısız");
      }
    } catch {
      haptic.error();
      appAlert("Hata oluştu");
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
      appAlert("Lütfen ülke ve servis seçiniz.");
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
        appAlert("Lütfen geçerli bir sabit fiyat giriniz.");
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
    if (!await appConfirm("Bu özel fiyatlandırma kuralını silmek istediğinize emin misiniz?")) return;
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
        appAlert(data.error || "Yanıt gönderilemedi");
      }
    } catch {
      haptic.error();
      appAlert("Hata oluştu");
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
    if (!await appConfirm("Bu destek talebini ve tüm mesaj geçmişini kalıcı olarak silmek istediğinize emin misiniz?")) {
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
      !await appConfirm(
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
        appAlert(data.error || "İşlem başarısız");
      }
    } catch (e) {
      haptic.error();
      appAlert("Hata oluştu");
    } finally {
      setUserActionLoadingId(null);
    }
  };

  // Admin Rolü Ver / Kaldır
  const handleToggleRole = async (user: any, targetRole?: "admin" | "support" | "user") => {
    const nextRole = targetRole ?? (user.role === "admin" ? "user" : "admin");
    const name = user.firstName || user.telegramId;
    if (
      !await appConfirm(
        nextRole === "admin"
          ? `${name} kullanıcısına YÖNETİCİ (Admin) yetkisi vermek istediğinize emin misiniz?`
          : nextRole === "support"
          ? `${name} kullanıcısı DESTEK GÖREVLİSİ yapılsın mı? Yalnızca destek taleplerini görüp yanıtlayabilir; bakiye, ayar ve kullanıcılara erişemez.`
          : `${name} kullanıcısının yönetici/destek yetkisini geri almak istediğinize emin misiniz?`
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
        appAlert(data.error || "İşlem başarısız");
      }
    } catch (e) {
      haptic.error();
      appAlert("Hata oluştu");
    } finally {
      setUserActionLoadingId(null);
    }
  };

  // Kullanıcıyı Kalıcı Olarak Sil
  const handleDeleteUser = async (user: any) => {
    if (
      !await appConfirm(
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
        appAlert(data.error || "Silinemedi");
      }
    } catch (e) {
      haptic.error();
      appAlert("Hata oluştu");
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
    let list = users;
    if (userVipFilter === "vip") {
      list = list.filter((u) => u.isVip);
    } else if (userVipFilter === "standard") {
      list = list.filter((u) => !u.isVip);
    }

    if (userRoleFilter === "banned") list = list.filter((u) => u.isBanned);
    else if (userRoleFilter === "balance") list = list.filter((u) => Number(u.balance) > 0);
    else if (userRoleFilter === "staff") list = list.filter((u) => u.role === "admin" || u.role === "support");

    if (serverSearchIds) return list.filter((u) => serverSearchIds.has(Number(u.telegramId)));
    if (!userSearchQuery.trim()) return list;
    const q = userSearchQuery.toLowerCase().replace(/^@/, "");
    return list.filter(
      (u) =>
        (u.firstName && u.firstName.toLowerCase().includes(q)) ||
        (u.lastName && u.lastName.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        String(u.telegramId).includes(q)
    );
  }, [users, userSearchQuery, userVipFilter, userRoleFilter, serverSearchIds]);

  // Sunucuda ara: telefon numarası (aldığı numaralar) ve TXID (ödemeler) dahil
  const runServerUserSearch = async () => {
    const q = userSearchQuery.trim();
    if (!q) {
      setServerSearchIds(null);
      return;
    }
    setServerSearching(true);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) setServerSearchIds(new Set((data.users || []).map((u: any) => Number(u.telegramId))));
    } catch {
    } finally {
      setServerSearching(false);
    }
  };

  // Filtrelenmiş Sistem Logları Listesi
  const filteredLogs = useMemo(() => {
    let list = logs;
    if (logCategoryFilter && logCategoryFilter !== "ALL") {
      list = list.filter((l) => l.category === logCategoryFilter);
    }
    if (logLevelFilter && logLevelFilter !== "ALL") {
      list = list.filter((l) => l.level === logLevelFilter);
    }
    if (!logSearchQuery.trim()) return list;
    const q = logSearchQuery.toLowerCase();
    return list.filter(
      (l) =>
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.category && l.category.toLowerCase().includes(q)) ||
        (l.username && l.username.toLowerCase().includes(q)) ||
        (l.telegramId && String(l.telegramId).includes(q)) ||
        (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
    );
  }, [logs, logCategoryFilter, logLevelFilter, logSearchQuery]);

  // VIP Durumunu Değiştir / İndirim Güncelle
  const handleToggleVip = async (u: any, customDiscount?: number, forceVipState?: boolean) => {
    setUserActionLoadingId(u.telegramId);
    haptic.impact("medium");
    try {
      const willBeVip = forceVipState !== undefined ? forceVipState : (customDiscount !== undefined ? true : !u.isVip);
      const res = await adminFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_vip",
          telegramId: u.telegramId,
          isVip: willBeVip,
          discountPercent:
            customDiscount !== undefined
              ? customDiscount
              : willBeVip
              ? u.vipDiscountPercent || vipSettingsDefaultDiscount || 15
              : undefined,
          userData: u,
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg(data.message || (willBeVip ? "Kullanıcı VIP yapıldı!" : "VIP kaldırıldı"));
        setTimeout(() => setToastMsg(null), 3000);
        fetchAllData();
      } else {
        haptic.error();
        appAlert(data.error || "İşlem başarısız");
      }
    } catch {
      haptic.error();
      appAlert("Hata oluştu");
    } finally {
      setUserActionLoadingId(null);
    }
  };

  // VIP Ayarlarını Kaydet
  const handleSaveVipSettings = async () => {
    setSavingVipSettings(true);
    haptic.impact("medium");
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vipSettings: {
            defaultDiscountPercent: Number(vipSettingsDefaultDiscount),
            autoVipOnDepositAmount: Number(vipSettingsAutoDeposit),
            enabled: vipSettingsEnabled,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg("VIP üyelik ayarları başarıyla güncellendi!");
        setTimeout(() => setToastMsg(null), 3000);
        fetchAllData();
      } else {
        haptic.error();
        appAlert(data.error || "Kayıt başarısız");
      }
    } catch {
      haptic.error();
      appAlert("Hata oluştu");
    } finally {
      setSavingVipSettings(false);
    }
  };

  // Sistem Loglarını Getir
  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      if (logCategoryFilter && logCategoryFilter !== "ALL") params.set("category", logCategoryFilter);
      if (logLevelFilter && logLevelFilter !== "ALL") params.set("level", logLevelFilter);
      if (logSearchQuery.trim()) params.set("search", logSearchQuery.trim());
      params.set("limit", "250");

      const res = await adminFetch(`/api/admin/logs?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error("Fetch logs error:", e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === "logs") {
      fetchLogs();
    }
  }, [activeTab, logCategoryFilter, logLevelFilter]);

  // Sistem Loglarını Temizle
  const handleClearLogs = async () => {
    if (!await appConfirm("Tüm sistem loglarını kalıcı olarak temizlemek istediğinize emin misiniz?")) {
      return;
    }
    setClearingLogs(true);
    haptic.impact("medium");
    try {
      const res = await adminFetch("/api/admin/logs", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        setToastMsg("Sistem logları başarıyla temizlendi!");
        setTimeout(() => setToastMsg(null), 3000);
        fetchLogs();
      } else {
        haptic.error();
        appAlert(data.error || "Loglar silinemedi");
      }
    } catch {
      haptic.error();
      appAlert("Hata oluştu");
    } finally {
      setClearingLogs(false);
    }
  };

  // Yükleme Durumu
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <span className="text-xs text-muted-foreground font-medium">Yönetici yetkileri ve sistem verileri kontrol ediliyor...</span>
      </div>
    );
  }



  return (
    <div className="space-y-4 pb-12">
      {/* Top Banner */}
      <div className="sticky top-[calc(env(safe-area-inset-top)+0.75rem)] z-40 flex items-center justify-between gap-2 rounded-full border border-border bg-background/80 p-1.5 pl-2 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.1)] backdrop-blur-xl dark:border-muted-foreground/20">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 leading-none">
            <h2 className="truncate text-[15px] font-medium tracking-tight text-foreground">Yönetici</h2>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-brand" />
              Canlı panel
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => {
              haptic.impact("light");
              fetchAllData();
            }}
            disabled={refreshing}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted disabled:opacity-50 dark:hover:bg-muted/50"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-brand" : ""}`} />
          </button>
          <ThemeToggle />
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="inline-flex h-9 items-center justify-center rounded-full bg-foreground px-3.5 text-xs font-medium text-background transition-colors hover:bg-foreground/85"
            >
              Uygulama
            </button>
          )}
        </div>
      </div>

      {toastMsg && (
        <div className="p-3 rounded-xl bg-brand/10 border border-brand/50 text-brand text-xs font-medium animate-in fade-in">
          {toastMsg}
        </div>
      )}

      {/* Admin Tabs */}
      {isSupportOnly && (
        <div className="rounded-3xl bg-background/70 p-3.5 text-xs text-muted-foreground ring-1 ring-foreground/10">
          Destek görevlisi olarak yalnızca destek taleplerini görüntüleyip yanıtlayabilirsiniz.
        </div>
      )}
      <div className={`grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-1 bg-background/70 p-1.5 rounded-3xl ring-1 ring-foreground/10 backdrop-blur-xl text-xs font-medium ${isSupportOnly ? "hidden" : ""}`}>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("overview");
          }}
          className={`py-2 px-1 rounded-full transition-all text-center ${
            activeTab === "overview"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Genel Bakış
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("pricing");
          }}
          className={`py-2 px-1 rounded-full transition-all text-center ${
            activeTab === "pricing"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Fiyat / Kâr
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("bank");
          }}
          className={`py-2 px-1 rounded-full transition-all text-center ${
            activeTab === "bank"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Kripto & Ayar
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("coupons");
          }}
          className={`py-2 px-1 rounded-full transition-all text-center ${
            activeTab === "coupons"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Kuponlar ({coupons.length})
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("users");
          }}
          className={`py-2 px-1 rounded-full transition-all text-center ${
            activeTab === "users"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Kullanıcı ({users.length})
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("deposits");
          }}
          className={`py-2 px-1 rounded-full transition-all text-center ${
            activeTab === "deposits"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Talepler ({deposits.filter((d) => d.status === "PENDING").length})
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("tickets");
          }}
          className={`py-2 px-1 rounded-full transition-all text-center relative ${
            activeTab === "tickets"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
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
          className={`py-2 px-1 rounded-full transition-all text-center ${
            activeTab === "broadcast"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Duyuru
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("backups");
          }}
          className={`py-2 px-1 rounded-full transition-all text-center flex items-center justify-center gap-1 ${
            activeTab === "backups"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Archive className="w-3.5 h-3.5 shrink-0" />
          <span>Yedekleme ({backups.length})</span>
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab("logs");
          }}
          className={`py-2 px-1 rounded-full transition-all text-center flex items-center justify-center gap-1 ${
            activeTab === "logs"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span>Loglar</span>
        </button>
        {(
          [
            { id: "orders", label: "Siparişler" },
            { id: "reports", label: "Raporlar" },
            { id: "audit", label: "İşlem Kaydı" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => {
              haptic.selection();
              setActiveTab(t.id);
            }}
            className={`py-2 px-1 rounded-full transition-all text-center ${
              activeTab === t.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Yeni sekmeler (components/admin/) */}
      {activeTab === "orders" && <AdminOrdersTab />}
      {activeTab === "reports" && <AdminReportsTab />}
      {activeTab === "audit" && <AdminAuditTab />}

      {/* TAB 1: OVERVIEW & METRICS */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <MaintenanceScheduleCard />
          {/* SİSTEM BAKIM DURUMU & ANINDA MESAJ DÜZENLEMELİ BAKIMA ALMA KARTI */}
          <div
            className={`p-4 rounded-2xl border transition-all duration-300 ${
              maintenanceMode
                ? "bg-gradient-to-br from-red-950/40 via-red-900/25 to-background/90 border-red-500/50 shadow-xl ring-1 ring-red-500/30"
                : "bg-gradient-to-br from-card via-card to-background border-brand/30 shadow-md "
            }`}
          >
            {/* Kart Başlığı ve Durum Rozeti */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    maintenanceMode
                      ? "bg-red-500/20 border-red-500/40 text-red-400"
                      : "bg-brand/20 border-brand/40 text-brand"
                  }`}
                >
                  <Wrench className={`w-5 h-5 ${maintenanceMode ? "text-red-400 animate-pulse" : ""}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground">Sistem Bakım Modu</h3>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        maintenanceMode
                          ? "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse"
                          : "bg-brand/20 text-brand border-brand/40"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          maintenanceMode ? "bg-red-400" : "bg-brand"
                        }`}
                      />
                      {maintenanceMode ? "BAKIMDA (Kullanıcılara Kapalı)" : "AÇIK (Normal Çalışma)"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {maintenanceMode
                      ? "⚠️ Bakım aktif: Normal kullanıcılar bot ve Mini App'te samimi bakım ekranı ile yönetici iletişim butonlarını görür. Yöneticiler her yere tam erişebilir."
                      : "Sistem aktif: Tüm kullanıcılar Telegram botundan ve Mini App'ten kesintisiz işlem yapabilir."}
                  </p>
                </div>
              </div>
            </div>

            {/* Bakım Mesajı Düzenleme Alanı (Bakıma Alırken / Bakımdayken Değiştirilebilir) */}
            <div className="mt-3.5 pt-3 border-t border-border space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span>Bakım Duyurusu / Mesajı:</span>
                </label>
                <span className="text-[10px] text-muted-foreground/80 font-mono">
                  {maintenanceMessage.length} karakter
                </span>
              </div>

              {/* Hızlı Şablon Butonları */}
              <div className="flex items-center gap-1.5 flex-wrap pb-1">
                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setMaintenanceMessage(
                      "Değerli Kullanıcımız, altyapımızda kısa süreli bakım ve iyileştirme çalışması yapmaktayız. Numara almak veya bakiye yüklemek için yöneticilerimizle iletişime geçebilirsiniz."
                    );
                  }}
                  className="px-2 py-1 rounded-lg bg-muted/80 hover:bg-input/80 border border-border text-[10px] text-foreground/80 transition-colors"
                >
                  ⚡ Standart Bakım
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setMaintenanceMessage(
                      "Sistemimizde hız ve sunucu altyapı güncellemesi yapılmaktadır. Acil numara talepleriniz için lütfen yöneticilerimize doğrudan yazınız."
                    );
                  }}
                  className="px-2 py-1 rounded-lg bg-muted/80 hover:bg-input/80 border border-border text-[10px] text-foreground/80 transition-colors"
                >
                  🚀 Altyapı Güncellemesi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setMaintenanceMessage(
                      "SMS sağlayıcı altyapısında geçici bir bakım çalışması mevcuttur. Bilgi ve işlemleriniz için yöneticilerimize hemen ulaşabilirsiniz."
                    );
                  }}
                  className="px-2 py-1 rounded-lg bg-muted/80 hover:bg-input/80 border border-border text-[10px] text-foreground/80 transition-colors"
                >
                  🛡️ Sağlayıcı Bakımı
                </button>
                {maintenanceMessage && (
                  <button
                    type="button"
                    onClick={() => {
                      haptic.selection();
                      setMaintenanceMessage("");
                    }}
                    className="px-2 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/40 border border-red-500/20 text-[10px] text-red-300 transition-colors"
                  >
                    🧹 Temizle (Varsayılan)
                  </button>
                )}
              </div>

              <textarea
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder="Özel bakım mesajınızı buraya yazınız... (Boş bırakırsanız sistemin samimi varsayılan mesajı gösterilir)"
                rows={3}
                className="w-full bg-card/90 border border-border rounded-xl p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber-500 transition-all leading-relaxed font-sans"
              />
              <p className="text-[10px] text-muted-foreground">
                💡 Bu mesaj kullanıcı /start verdiğinde, bot butonlarına tıkladığında ve Mini App bakım ekranında canlı olarak görüntülenir.
              </p>
            </div>

            {/* Aksiyon Butonları */}
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
              <div className="text-[11px] text-muted-foreground">
                {maintenanceMode ? (
                  <span className="text-amber-300 font-medium flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> Yöneticiler her yere tam erişebilir
                  </span>
                ) : (
                  <span className="text-muted-foreground/80">
                    Mesajınızı yazıp tek tıkla sistemi bakıma alabilirsiniz.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Mesajı Kaydet Butonu */}
                <button
                  type="button"
                  onClick={handleSaveMaintenanceMessage}
                  disabled={savingMaintenance || togglingMaintenance}
                  className="px-3 py-2 rounded-xl bg-muted hover:bg-input border border-border text-foreground font-medium text-xs flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                  title="Yalnızca mesajı kaydeder"
                >
                  {savingMaintenance ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Mesajı Kaydet</span>
                </button>

                {/* Bakıma Al / Bakımı Kapat Butonu */}
                <button
                  type="button"
                  onClick={() => handleToggleMaintenance()}
                  disabled={togglingMaintenance}
                  className={`px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-md disabled:opacity-50 ${
                    maintenanceMode
                      ? "bg-foreground hover:bg-foreground/85 text-background "
                      : "bg-red-600 hover:bg-red-500 text-white "
                  }`}
                >
                  {togglingMaintenance ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Power className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {maintenanceMode ? "Bakımı Kapat (Sistemi Aç)" : "Sistemi Bakıma Al"}
                  </span>
                </button>
              </div>
            </div>
          </div>
          {/* Servis Sağlayıcı Kasa Monitörü */}
          <Card className="p-4 bg-gradient-to-br from-card to-card border-foreground/15">
            <div className="flex items-center justify-between">
              <div>
                <Text>Servis Sağlayıcı Kasası</Text>
                <Metric isMono={true} className="mt-1 text-foreground/90">
                  $<RollingNumber value={Number(overview?.provider?.balance) || 0} precision={2} format={(n) => n.toFixed(2)} />
                </Metric>
                <div className="text-[11px] font-mono text-muted-foreground mt-1">
                  API Durumu: <span className="text-foreground">{overview?.provider?.raw || "Online"}</span>
                </div>
              </div>

              <div className="text-right">
                <Badge color={overview?.provider?.balance > 0 ? "emerald" : "amber"}>
                  {overview?.provider?.balance > 0 ? "Bakiye Yeterli" : "Kasa 0 (Mock Aktif)"}
                </Badge>
                <p className="text-[10px] text-muted-foreground/80 mt-2">Altyapı: AzFur SMS Motoru</p>
              </div>
            </div>
          </Card>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3.5">
              <Text>Toplam Ciro</Text>
              <Metric isMono={true} className="text-brand mt-1">
                ₺<RollingNumber value={Number(overview?.stats?.totalRevenue) || 0} precision={2} format={(n) => n.toFixed(2)} />
              </Metric>
              <div className="text-[11px] text-muted-foreground mt-1">Net Kâr: ₺{overview?.stats?.totalProfit?.toFixed(2) || "0.00"}</div>
            </Card>

            <Card className="p-3.5">
              <Text>Aktif Kullanıcı</Text>
              <Metric isMono={true} className="text-foreground mt-1">
                <RollingNumber value={Number(overview?.stats?.totalUsers) || 0} />
              </Metric>
              <div className="text-[11px] text-muted-foreground mt-1">Toplam {overview?.stats?.totalActivations || 0} Sipariş</div>
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
                <h4 className="text-xs font-semibold text-foreground">İstatistikleri Sıfırla</h4>
                <p className="text-[11px] text-muted-foreground">Ciro, sipariş geçmişi ve harcama sayaçlarını temizler</p>
              </div>
            </div>

            <button
              onClick={handleResetStats}
              disabled={resettingStats}
              className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
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
                <h4 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                  Son 7 Günlük Gelir Trendi
                </h4>
                <p className="text-[11px] text-muted-foreground/80">Günlük ciro ve kâr akışı</p>
              </div>
              <TrendingUp className="w-4 h-4 text-brand" />
            </div>

            <AreaChart data={overview?.revenueTrend || overview?.chartDaily || []} />
          </Card>

          {/* Donut Chart: En Çok Satan Servisler */}
          <Card className="p-4 space-y-3">
            <div>
              <h4 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                En Çok Tercih Edilen Servisler
              </h4>
              <p className="text-[11px] text-muted-foreground/80">Satış adetlerine göre dağılım</p>
            </div>
            <DonutChart data={overview?.chartServices || []} />
          </Card>
        </div>
      )}

      {/* TAB 2: PRICING & DYNAMIC PROFIT ENGINE */}
      {activeTab === "pricing" && (
        <div className="space-y-4">
          {/* TCMB Otomatik Kur Kartı */}
          <Card className="p-4 space-y-3 bg-gradient-to-br from-card to-card border-foreground/20 shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-foreground/90" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>TCMB Canlı Döviz Kuru (USD/TRY)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/10 text-foreground border border-foreground/15">
                      Resmi XML
                    </span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Fiyatlar TCMB resmi kuruna göre otomatik çevrilir
                  </p>
                </div>
              </div>

              <button
                onClick={handleRefreshTcmb}
                disabled={tcmbRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-foreground/10 hover:bg-foreground/15 text-foreground border border-foreground/20 text-xs font-medium transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${tcmbRefreshing ? "animate-spin" : ""}`} />
                <span>{tcmbRefreshing ? "Çekiliyor..." : "Kuru Güncelle"}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-card/80 p-3 rounded-xl border border-border">
                <span className="text-[11px] text-muted-foreground block">Güncel TCMB Dolar Kuru:</span>
                <span className="text-xl font-semibold font-mono text-foreground/90 block mt-0.5">
                  ₺{lastTcmbRate.toFixed(4)}
                </span>
                <span className="text-[10px] text-muted-foreground/80 block mt-0.5 truncate" title={lastTcmbFetchTime}>
                  {lastTcmbFetchTime
                    ? !isNaN(Date.parse(lastTcmbFetchTime))
                      ? `Son güncelleme: ${new Date(lastTcmbFetchTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                      : `Son güncelleme: ${lastTcmbFetchTime}`
                    : "Otomatik senkronize"}
                </span>
              </div>

              <div className="bg-card/80 p-3 rounded-xl border border-border flex flex-col justify-between gap-2">
                <span className="text-[11px] text-muted-foreground block">Kullanılan Kur Kaynağı:</span>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="tcmbToggle"
                    checked={useTcmbAutoRate}
                    onChange={(e) => setUseTcmbAutoRate(e.target.checked)}
                    className="w-4 h-4 accent-brand rounded cursor-pointer"
                  />
                  <label htmlFor="tcmbToggle" className="text-xs font-medium text-foreground cursor-pointer">
                    {useTcmbAutoRate ? "Otomatik TCMB Aktif" : "Manuel Kur Kullan"}
                  </label>
                </div>
                {useTcmbAutoRate ? (
                  <div className="space-y-1">
                    <label htmlFor="tcmbUpdateIntervalMinutes" className="text-[10px] text-muted-foreground block">
                      Kur kontrol aralığı
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="tcmbUpdateIntervalMinutes"
                        type="number"
                        min={1}
                        max={1440}
                        step={1}
                        value={tcmbUpdateIntervalMinutes}
                        onChange={(e) => setTcmbUpdateIntervalMinutes(Number(e.target.value))}
                        className="w-20 bg-background border border-border rounded-lg px-2 py-1.5 text-xs font-mono text-foreground"
                      />
                      <span className="text-xs text-muted-foreground">dakika</span>
                    </div>
                    <span className="text-[10px] text-brand block">
                      Uygulamaya istek geldiğinde bu süre dolmuşsa kur yenilenir.
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground block">Sabit manuel kur geçerli</span>
                )}
              </div>
            </div>
          </Card>

          {/* Kâr Motoru Kartı */}
          <Card className="p-4 space-y-4 border-brand/30">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-brand" />
                  <span>Dinamik Kâr Marjı Motoru</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Sağlayıcı alış fiyatı üzerine kâr ve kur kurallarını belirleyin.
                </p>
              </div>
            </div>

            {/* Margin Percent Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-foreground/80 font-medium">Genel Kâr Marjı Oranı:</span>
                <span className="font-mono font-semibold text-brand">%{marginPercent}</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="150"
                  step="5"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(Number(e.target.value))}
                  className="w-full accent-brand h-2 bg-muted rounded-lg cursor-pointer"
                />
                <input
                  type="number"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(Number(e.target.value))}
                  className="w-20 bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs font-mono text-foreground text-center"
                />
              </div>
            </div>

            {/* Fixed Fee Addition */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-foreground/80 font-medium">Sabit Ek Hizmet Ücreti (₺):</span>
                <span className="font-mono font-semibold text-brand">₺{fixedFee.toFixed(2)}</span>
              </div>
              <input
                type="number"
                step="0.5"
                value={fixedFee}
                onChange={(e) => setFixedFee(Number(e.target.value))}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground"
                placeholder="Örn: 5.00"
              />
            </div>

            {/* Exchange Rate To TRY */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-foreground/80 font-medium">
                  {useTcmbAutoRate ? "TCMB Canlı Kur Değeri:" : "Manuel Dolar / TL Kuru:"}
                </span>
                <span className="font-mono font-semibold text-foreground/90">₺{rateToTry.toFixed(2)}</span>
              </div>
              <input
                type="number"
                step="0.1"
                value={rateToTry}
                onChange={(e) => setRateToTry(Number(e.target.value))}
                disabled={useTcmbAutoRate}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Örn: 49.20"
              />
              {useTcmbAutoRate && (
                <p className="text-[10px] text-muted-foreground/80">
                  Otomatik TCMB kuru açık olduğu için bu alan canlı TCMB bülteninden çekilir.
                </p>
              )}
            </div>

            {/* Mock / Test Mode Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-card/80 border border-border">
              <div>
                <span className="text-xs font-semibold text-foreground block">Mock / Test Modu</span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  Sağlayıcı bakiyesi 0 iken gerçekçi OTP simülasyonu çalıştırır.
                </span>
              </div>
              <input
                type="checkbox"
                checked={mockMode}
                onChange={(e) => setMockMode(e.target.checked)}
                className="w-5 h-5 accent-brand rounded cursor-pointer"
              />
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="w-full py-3 rounded-xl bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {savingSettings ? "Kaydediliyor..." : "Ayarları Kaydet & Fiyatları Güncelle"}
            </button>
          </Card>

          {/* Full rent (süreli numara kiralama) için ayrı kâr marjı */}
          <RentPricingCard />

          {/* 🎯 Ülke ve Servise Özel Manuel Fiyatlandırma Kartı */}
          <Card className="p-4 space-y-4 border-amber-500/40 bg-gradient-to-br from-card to-card shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>Ülke & Servise Özel Manuel Fiyatlandırma</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {Object.keys(customPriceRules).length} Özel Kural
                    </span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Belirli ülke ve servis kombinasyonlarına özel sabit satış fiyatı veya kâr marjı tanımlayın.
                  </p>
                </div>
              </div>
            </div>

            {/* Form Alanı */}
            <div className="space-y-3 p-3 rounded-xl bg-card/90 border border-border">
              <div className="grid grid-cols-2 gap-2">
                {/* Ülke Seçimi */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground/80 block">Ülke Seçin:</label>
                  <select
                    value={ruleCountryId}
                    onChange={(e) => setRuleCountryId(Number(e.target.value))}
                    className="w-full bg-card border border-border rounded-xl px-2.5 py-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
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
                  <label className="text-[11px] font-medium text-foreground/80 block">Servis Seçin:</label>
                  <select
                    value={ruleServiceCode}
                    onChange={(e) => setRuleServiceCode(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-2.5 py-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
                  >
                    {(settingsData?.allServices || []).map((s: any) => (
                      <option key={s.code} value={s.code}>
                        {s.name} ({s.code})
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
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                      ruleType === "fixed"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-muted text-muted-foreground border border-transparent"
                    }`}
                  >
                    🏷️ Sabit Satış Fiyatı (₺)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRuleType("margin")}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                      ruleType === "margin"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-muted text-muted-foreground border border-transparent"
                    }`}
                  >
                    📈 Özel Kâr % + Sabit Ücret
                  </button>
                </div>

                {ruleType === "fixed" ? (
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground block">
                      Sabit Satış Fiyatı (Maliyet ve kurdan bağımsız bu fiyata satılır):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground/80">₺</span>
                      <input
                        type="number"
                        step="0.5"
                        value={ruleFixedPrice}
                        onChange={(e) => setRuleFixedPrice(e.target.value)}
                        className="w-full pl-7 bg-card border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:border-amber-500"
                        placeholder="Örn: 18.00"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground block">Özel Kâr Oranı (%):</label>
                      <input
                        type="number"
                        step="5"
                        value={ruleMarginPercent}
                        onChange={(e) => setRuleMarginPercent(e.target.value)}
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:border-amber-500"
                        placeholder="%50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground block">Ek Hizmet Ücreti (₺):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={ruleFixedFee}
                        onChange={(e) => setRuleFixedFee(e.target.value)}
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:border-amber-500"
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
                className="w-full py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{savingRule ? "Kaydediliyor..." : "Özel Fiyat Kuralını Tanımla"}</span>
              </button>
            </div>

            {/* Tanımlı Kurallar Listesi */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-foreground/80 block">
                Aktif Özel Fiyat Kuralları ({Object.keys(customPriceRules).length}):
              </span>

              {Object.keys(customPriceRules).length === 0 ? (
                <div className="p-4 rounded-xl bg-card/40 border border-dashed border-border text-center text-xs text-muted-foreground/80">
                  Henüz özel fiyat kuralı eklenmedi. Tüm servis ve ülkelerde genel kâr marjı (%{marginPercent} + ₺{fixedFee}) geçerlidir.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {Object.entries(customPriceRules).map(([key, rule]: [string, any]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-card/90 border border-border hover:border-amber-500/30 transition-all text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{rule.countryFlag || "🌐"}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">{rule.countryName || `Ülke ${rule.countryId}`}</span>
                            <span className="text-muted-foreground/60">•</span>
                            <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                              <ServiceIcon code={rule.serviceCode} name={rule.serviceName} size="xs" />
                              {rule.serviceName || rule.serviceCode}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {rule.fixedPriceTry !== undefined ? (
                              <span className="text-brand font-semibold">Sabit Fiyat: ₺{Number(rule.fixedPriceTry).toFixed(2)}</span>
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
                          className="px-2 py-1 rounded-lg bg-muted hover:bg-input text-foreground/80 text-[10px] font-medium"
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
            <h4 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-brand" />
              <span>Servis Görünürlük Kontrolü</span>
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Kullanıcıların görmesini istemediğiniz servisleri tek tıkla gizleyin. Sağlayıcının sunduğu tüm servisler listelenir
              ({(settingsData?.allServices || []).length} servis, {(settingsData?.settings?.hiddenServices || []).length} gizli).
            </p>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-muted-foreground/80 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={serviceVisSearch}
                  onChange={(e) => setServiceVisSearch(e.target.value)}
                  placeholder="Servis adı veya kodu ara..."
                  className="w-full bg-card/90 border border-border rounded-full pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-brand/50"
                />
              </div>
            </div>
            <div className="flex gap-1.5">
              {[
                { id: "all", label: "Hepsi" },
                { id: "visible", label: "Görünen" },
                { id: "hidden", label: "Gizli" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setServiceVisFilter(f.id as any)}
                  className={`h-7 rounded-full px-3 text-[11px] font-medium ${
                    serviceVisFilter === f.id ? "bg-foreground text-background" : "border border-border text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
              {(settingsData?.allServices || [])
                .filter((s: any) => {
                  const hidden = settingsData?.settings?.hiddenServices?.includes(s.code);
                  if (serviceVisFilter === "hidden" && !hidden) return false;
                  if (serviceVisFilter === "visible" && hidden) return false;
                  const q = serviceVisSearch.trim().toLowerCase();
                  return !q || String(s.name).toLowerCase().includes(q) || String(s.code).toLowerCase().includes(q);
                })
                .map((s: any) => {
                const isHidden = settingsData?.settings?.hiddenServices?.includes(s.code);
                return (
                  <div
                    key={s.code}
                    onClick={() => handleToggleHideService(s.code)}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                      isHidden
                        ? "bg-rose-950/20 border-rose-500/30 text-rose-300"
                        : "bg-card border-border text-foreground hover:border-foreground/15"
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                    {isHidden ? <EyeOff className="w-3.5 h-3.5 text-rose-400" /> : <Eye className="w-3.5 h-3.5 text-brand" />}
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
          {/* SİSTEM BAKIM MODU & DUYURU AYARLARI */}
          <Card className="p-4 bg-background/80 border-border space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                    maintenanceMode
                      ? "bg-red-500/20 border-red-500/40 text-red-400"
                      : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  }`}
                >
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>Sistem Bakım Modu & Duyuru</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        maintenanceMode
                          ? "bg-red-500/20 text-red-300 border-red-500/40"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {maintenanceMode ? "Aktif (Kullanıcılara Kapalı)" : "Pasif (Sistem Açık)"}
                    </span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Bakım modundayken kullanıcılara gösterilecek samimi duyuruyu belirleyin.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleMaintenance()}
                disabled={togglingMaintenance}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 ${
                  maintenanceMode
                    ? "bg-foreground hover:bg-foreground/85 text-background shadow-md "
                    : "bg-red-600 hover:bg-red-500 text-white shadow-md "
                }`}
              >
                {togglingMaintenance ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Power className="w-3.5 h-3.5" />
                )}
                <span>{maintenanceMode ? "Bakımı Kapat" : "Bakımı Aç"}</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80 block">
                Özel Bakım Mesajı / Duyurusu (İsteğe Bağlı)
              </label>
              <textarea
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder="Boş bırakılırsa samimi varsayılan mesaj kullanılır: 'Değerli Kullanıcımız, sistemimizde bakım çalışması yapılmaktadır. Numara almak için yöneticilerle iletişime geçiniz...'"
                rows={4}
                className="w-full bg-card border border-border rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
              />
              <p className="text-[10px] text-muted-foreground/80">
                Bu mesaj hem Telegram botunda (/start, menü butonları) hem de Web Mini App bakım ekranında gösterilir. Yöneticilerin Telegram iletişim butonları otomatik olarak altına eklenir.
              </p>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleSaveMaintenanceMessage}
                  disabled={savingMaintenance}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50"
                >
                  {savingMaintenance ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Mesajı Kaydet</span>
                </button>
              </div>
            </div>
          </Card>

          {/* Otomatik Kripto (TRX & USDT & CryptoBot) Cüzdan Ayarları */}
          <Card className="p-4 space-y-4 border-brand/30">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-brand/20 text-brand">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Otomatik Kripto (TRX & USDT) Ödeme Ayarları</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Kullanıcılar bu adrese transfer yapıp TXID yapıştırdığında TronScan ile anında otomatik bakiye eklenir
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground/80">USDT (TRC-20) Cüzdan Adresi</label>
                <input
                  type="text"
                  value={usdtTrc20Address}
                  onChange={(e) => setUsdtTrc20Address(e.target.value)}
                  placeholder="Örn: T9yD14Nj9j7xAB4dbGeiX9h8unkKHXUnC"
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono text-brand font-semibold focus:outline-none focus:border-brand"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground/80">TRX (Tron) Cüzdan Adresi</label>
                <input
                  type="text"
                  value={trxAddress}
                  onChange={(e) => setTrxAddress(e.target.value)}
                  placeholder="Örn: T9yD14Nj9j7xAB4dbGeiX9h8unkKHXUnC"
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono text-brand font-semibold focus:outline-none focus:border-brand"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-card/80 border border-border">
                <div>
                  <span className="text-xs font-medium text-foreground block">TronScan Canlı Otomatik Onay</span>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    Kullanıcı işlem kodunu girdiğinde sistem Tron ağında transferi doğrular ve bakiyeyi anında yükler.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoVerifyEnabled}
                  onChange={(e) => setAutoVerifyEnabled(e.target.checked)}
                  className="w-5 h-5 accent-brand rounded cursor-pointer"
                />
              </div>

              {/* Otomatik Kripto (Apirone Non-Custodial Gateway) API & Ayarlar Bölümü */}
              <div className="p-3.5 rounded-xl bg-card/90 border border-brand/35 space-y-3.5 shadow-lg ">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-brand" />
                    <span className="text-xs font-semibold text-foreground">Otomatik Kripto Ödeme Sistemi (Apirone Gateway)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/20 text-brand font-medium border border-brand/30">
                    KYC Yok • Non-Custodial Forwarding
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Apirone, OxaPay gibi KYC veya şirket onayı istemez. Kullanıcılar ödeme yaptığında blokzincir onayından sonra para <b>doğrudan kişisel TRC20/TRX cüzdanınıza</b> aktarılır ve bakiyeleri anında yüklenir.
                </p>

                {/* Kişisel Apirone Hesap Girdileri */}
                <div className="space-y-2.5 bg-foreground/5 p-3 rounded-xl border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground">Kişisel Apirone Hesap Bilgileri</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-brand/10 text-brand font-medium border border-brand/20">
                      Özel Hesap • Otomatik Oluşturulmaz
                    </span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                    Kendi Apirone Account ID ve Transfer Key bilgilerinizi aşağıya girin. Sistem yalnızca sizin girdiğiniz bu hesabı kullanır; arka planda asla otomatik yeni hesap üretilmez.
                  </p>

                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Apirone Account ID</label>
                    <input
                      type="text"
                      value={apironeAccount}
                      onChange={(e) => setApironeAccount(e.target.value)}
                      placeholder="Örn: apr-28a9319739bc0e540fe5f4b2930e1bef"
                      className="w-full bg-muted border border-border rounded-xl px-3.5 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Apirone Transfer Key (Güvenlik Anahtarı)</label>
                    <input
                      type="password"
                      value={apironeTransferKey}
                      onChange={(e) => setApironeTransferKey(e.target.value)}
                      placeholder="Örn: 9vze07JpR0JOpUfUaV1dK8fNXowYQaCE"
                      className="w-full bg-muted border border-border rounded-xl px-3.5 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveCryptoSettings}
                      disabled={savingCrypto || !apironeAccount.trim()}
                      className="px-3.5 py-1.5 rounded-xl bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
                      title="Girdiğiniz Apirone Account ID ve Transfer Key bilgilerini veritabanına ve buluta kalıcı olarak kaydeder"
                    >
                      {savingCrypto ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Kaydediliyor...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Apirone Bilgilerini Kaydet</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleTestApironeAccount}
                      disabled={testingApirone || !apironeAccount.trim()}
                      className="px-3 py-1.5 rounded-xl bg-muted hover:bg-input text-brand font-semibold text-xs border border-brand/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {testingApirone ? (
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

                    <button
                      type="button"
                      onClick={handleSetApironeForwarding}
                      disabled={settingForwarding || !apironeAccount.trim() || !apironeTransferKey.trim()}
                      className="px-3 py-1.5 rounded-xl bg-brand/10 hover:bg-brand/10 text-brand font-semibold text-xs border border-brand/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {settingForwarding ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Kaydediliyor...</span>
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Cüzdanıma Otomatik Yönlendirmeyi Bağla</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Test Sonucu Bildirimi */}
                  {apironeTestResult && (
                    <div
                      className={`p-2.5 rounded-xl text-xs font-medium border ${
                        apironeTestResult.success
                          ? "bg-brand/10 border-brand/40 text-brand"
                          : "bg-rose-950/60 border-rose-500/40 text-rose-300"
                      }`}
                    >
                      {apironeTestResult.message}
                    </div>
                  )}
                </div>

                {/* Webhook URL Kopyalama Kutusu */}
                <div className="space-y-1 pt-1 border-t border-border">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Apirone Webhook Callback URL:</span>
                    <span className="text-[10px] text-muted-foreground/80">Otomatik Anında Bakiye Yükleme İçin</span>
                  </div>
                  <div className="flex items-center justify-between bg-muted p-2 rounded-xl border border-border font-mono text-[11px]">
                    <span className="truncate text-foreground/80 mr-2 select-all">
                      {typeof window !== "undefined"
                        ? `${window.location.origin}/api/user/deposit/crypto-webhook`
                        : "https://azfur-sms.vercel.app/api/user/deposit/crypto-webhook"}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyWebhookUrl}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-brand hover:text-brand shrink-0 text-[10px] font-sans font-semibold transition-all active:scale-95"
                    >
                      {copiedWebhook ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-brand" />
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
                  <p className="text-[10px] text-muted-foreground/80 pt-0.5">
                    💡 <b>Bilgi:</b> Sistem her ödeme faturası oluşturulduğunda bu webhook adresini Apirone&apos;a otomatik iletir. Blokzincirinde ödeme tespit edildiğinde bakiye 0 saniyede kullanıcının hesabına yüklenir.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveCryptoSettings}
              disabled={savingCrypto}
              className="w-full py-3 rounded-full bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-md active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
          <Card className="p-4 space-y-4 border-foreground/15">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-foreground/10 text-foreground/90">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>Telegram Bot Webhook Kurulumu</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-foreground/10 text-foreground font-mono">
                      0 Gecikme
                    </span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Botun /start ve butonlara anında tepki vermesi için webhook bağlantısını kurun.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Bot Webhook Endpoint URL:</span>
              </div>
              <div className="flex items-center justify-between bg-muted p-2 rounded-xl border border-border font-mono text-[11px]">
                <span className="truncate text-foreground/80 mr-2 select-all">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/api/bot/webhook`
                    : "https://azfur-sms.vercel.app/api/bot/webhook"}
                </span>
                <button
                  type="button"
                  onClick={handleCopyTgWebhookUrl}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-foreground/90 hover:text-foreground shrink-0 text-[10px] font-sans font-semibold transition-all active:scale-95"
                >
                  {copiedTgWebhook ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-brand" />
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
                <div className={`p-2.5 rounded-xl text-xs font-medium ${webhookStatus.startsWith("✅") ? "bg-brand/15 border border-brand/30 text-brand" : "bg-rose-500/15 border border-rose-500/30 text-rose-300"}`}>
                  {webhookStatus}
                </div>
              )}

              <button
                type="button"
                onClick={handleSetupTelegramWebhook}
                disabled={settingWebhook}
                className="w-full py-2.5 rounded-full bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-md active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
          <Card className="p-4 space-y-4 border-foreground/15">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-foreground/10 text-foreground/90">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>Canlı Destek & Yönetici Kullanıcı Adları</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-foreground/10 text-foreground font-mono">
                      {supportTelegramUsernames.length} Hesap
                    </span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Bot ve Mini App yardım menülerinde gösterilir. İstediğiniz kadar yönetici ekleyip silebilirsiniz.
                  </p>
                </div>
              </div>
            </div>

            {/* Mevcut Ekli Kullanıcı Adları Listesi */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80 block">
                Aktif Destek Hesapları ({supportTelegramUsernames.length})
              </label>

              {supportTelegramUsernames.length === 0 ? (
                <div className="p-3 rounded-xl bg-card border border-border text-center text-xs text-muted-foreground/80">
                  Henüz destek hesabı eklenmedi. Aşağıdan ekleyebilirsiniz.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {supportTelegramUsernames.map((user, idx) => (
                    <div
                      key={user}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-card/90 border border-border hover:border-foreground/15 transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-foreground/10 text-foreground/90 text-xs font-semibold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-mono text-xs font-semibold text-foreground">
                            @{user}
                          </span>
                          <span className="ml-2 text-[10px] text-muted-foreground/80">
                            (t.me/{user})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <a
                          href={`https://t.me/${user}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded-lg bg-muted hover:bg-input text-[11px] text-foreground/80 hover:text-foreground transition-colors"
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
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-xs font-medium text-foreground/80 block">
                Yeni Destek / Yönetici Hesabı Ekle
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/80 text-xs font-mono">@</span>
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
                    className="w-full bg-card border border-border rounded-xl pl-8 pr-3.5 py-2.5 text-xs font-mono text-foreground font-semibold focus:outline-none focus:border-foreground/40"
                  />
                </div>
                <button
                  onClick={handleAddSupportUser}
                  disabled={savingSupportUser || !newSupportUsername.trim()}
                  className="px-4 py-2.5 rounded-xl bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {savingSupportUser ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  )}
                  <span>Ekle</span>
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/80">
                Eklenen tüm hesaplar botun yardım mesajında ve Mini App destek penceresinde buton olarak yer alır.
              </p>
            </div>
          </Card>

          {/* BOT HAREKETLİ STİCKER / ANİMASYON YÖNETİMİ */}
          <Card className="p-4 bg-background/80 border-border space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>Telegram Bot Hareketli Sticker & Animasyon</span>
                    {customStickerFileId ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/20 text-brand font-mono">
                        Özel Sticker Aktif
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-foreground/10 text-foreground font-mono">
                        3D Animasyon (🎯 / 🎰)
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Botta /start, /bakiye, /yardim ve siparişlerde gösterilen animasyonlu görseli yönetin.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 space-y-2">
              <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <span>💡 En Pratik Tanımlama Yöntemi:</span>
              </div>
              <p className="text-[11px] text-foreground/80 leading-relaxed">
                Telegram&apos;da bota yönetici hesabınızdan <b>herhangi bir hareketli veya video sticker</b> göndermeniz yeterlidir! Bot gönderdiğiniz sticker&apos;ı otomatik olarak yakalar ve anında aktif eder.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80 block">
                Sticker File ID (Manuel Giriş veya Değiştirme)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customStickerFileId}
                  onChange={(e) => setCustomStickerFileId(e.target.value)}
                  placeholder="Örn: CAACAgIAAxkBAAE..."
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={() => handleSaveSticker()}
                  disabled={savingSticker}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {savingSticker ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Kaydet</span>
                </button>
              </div>
              {customStickerFileId && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-muted-foreground/80 font-mono truncate max-w-[220px]">
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
          <Card className="p-4 bg-background/80 border-border space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-foreground/5 border border-foreground/10 flex items-center justify-center text-foreground/90">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>Hero-SMS API Anahtarı</span>
                    {heroSmsApiKey.trim() ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/20 text-brand font-mono">
                        Aktif
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono">
                        Anahtar Yok
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Sanal numara sağlama, ülke/servis listesi ve SMS kod çekme işlemlerinde kullanılan sağlayıcı anahtarı.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80 block">
                API Key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={heroSmsApiKey}
                    onChange={(e) => setHeroSmsApiKey(e.target.value)}
                    placeholder="Örn: e1006858662edcAd8d348c9f07dfe8c5"
                    className="w-full bg-card border border-border rounded-xl px-3.5 pr-10 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-foreground/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/80 hover:text-foreground/80 transition-colors"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => handleSaveHeroApiKey()}
                  disabled={savingApiKey}
                  className="px-4 py-2.5 rounded-xl bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {savingApiKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Kaydet</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={handleTestHeroApiKey}
                  disabled={testingApiKey || !heroSmsApiKey.trim()}
                  className="px-3 py-1.5 rounded-xl bg-muted hover:bg-input text-foreground/80 hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {testingApiKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Bağlantıyı & Bakiyeyi Test Et</span>
                </button>

                {heroSmsApiKey.trim() && (
                  <button
                    onClick={async () => {
                      if (await appConfirm("Hero-SMS API anahtarını kaldırmak istediğinize emin misiniz?")) {
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
                      ? "bg-brand/10 border-brand/20 text-brand"
                      : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                  }`}
                >
                  {apiKeyTestResult.success ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 shrink-0 text-brand" />
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

          {/* VIP ÜYELİK VE İNDİRİM AYARLARI */}
          <Card className="p-4 space-y-4 border-amber-500/30 bg-gradient-to-br from-amber-950/10 via-card to-card">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>⭐ VIP Üyelik & Otomatik İndirim Sistemi</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Özel müşterilere indirim tanımlama ve yüksek bakiye yükleyenleri otomatik VIP yapma
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">VIP Sistemi:</span>
                <HaloSwitch
                  aria-label="VIP sistemi"
                  checked={vipSettingsEnabled}
                  onCheckedChange={(checked) => {
                    haptic.selection();
                    setVipSettingsEnabled(checked);
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground/80">
                  Varsayılan VIP İndirim Oranı (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={vipSettingsDefaultDiscount}
                    onChange={(e) => setVipSettingsDefaultDiscount(Number(e.target.value))}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold text-foreground focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-amber-400">%</span>
                </div>
                <p className="text-[10px] text-muted-foreground/80">
                  VIP üyeler hem Telegram botunda hem WebApp&apos;te tüm numaraları bu indirimle satın alır.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground/80">
                  Otomatik VIP Yükleme Eşiği (₺)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={vipSettingsAutoDeposit}
                    onChange={(e) => setVipSettingsAutoDeposit(Number(e.target.value))}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold text-foreground focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-brand">₺</span>
                </div>
                <p className="text-[10px] text-muted-foreground/80">
                  Kullanıcı tek seferde bu tutar ve üzerinde kripto veya banka bakiyesi yüklediğinde otomatik VIP yapılır. (0 = Devre Dışı)
                </p>
              </div>
            </div>

            <button
              onClick={handleSaveVipSettings}
              disabled={savingVipSettings}
              className="w-full py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs shadow-md active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingVipSettings ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>VIP Ayarlarını Kaydet</span>
                </>
              )}
            </button>
          </Card>

        </div>
      )}

      {/* TAB 3: USERS & FULL MANAGEMENT (BAN, ROLE, DELETE, BALANCE) */}
      {activeTab === "users" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-brand" />
              <span>Kayıtlı Telegram Kullanıcıları ({users.length})</span>
            </h3>
            <span className="text-[11px] text-muted-foreground">Kullanıcı & Yetki Yönetimi</span>
          </div>

          {/* Kullanıcı Filtre Sekmeleri (VIP / Standart) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => {
                haptic.selection();
                setUserVipFilter("all");
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                userVipFilter === "all"
                  ? "bg-muted-foreground text-black shadow-sm"
                  : "bg-muted/80 text-muted-foreground hover:text-foreground"
              }`}
            >
              Tümü ({users.length})
            </button>
            <button
              onClick={() => {
                haptic.selection();
                setUserVipFilter("vip");
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1 transition-all ${
                userVipFilter === "vip"
                  ? "bg-amber-400 text-black shadow-md "
                  : "bg-muted/80 text-amber-300/80 hover:text-amber-300 hover:bg-amber-500/10"
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>VIP Üyeler ({users.filter((u) => u.isVip).length})</span>
            </button>
            <button
              onClick={() => {
                haptic.selection();
                setUserVipFilter("standard");
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                userVipFilter === "standard"
                  ? "bg-muted-foreground text-black shadow-sm"
                  : "bg-muted/80 text-muted-foreground hover:text-foreground"
              }`}
            >
              Standart ({users.filter((u) => !u.isVip).length})
            </button>
          </div>

          {/* Arama Çubuğu */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground/80 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="İsim, @kullanıcı adı, Telegram ID, telefon numarası veya TXID"
              value={userSearchQuery}
              onChange={(e) => {
                setUserSearchQuery(e.target.value);
                setServerSearchIds(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") runServerUserSearch();
              }}
              className="w-full bg-card/90 border border-border rounded-full pl-9 pr-24 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-brand/50"
            />
            <button
              type="button"
              onClick={runServerUserSearch}
              disabled={serverSearching || !userSearchQuery.trim()}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 rounded-full bg-foreground px-3 text-[11px] font-medium text-background disabled:opacity-40"
            >
              {serverSearching ? "Aranıyor…" : "Derin ara"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "all", label: "Hepsi" },
              { id: "balance", label: "Bakiyesi olan" },
              { id: "banned", label: "Banlı" },
              { id: "staff", label: "Yönetici / destek" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setUserRoleFilter(f.id as any)}
                className={`h-7 rounded-full px-3 text-[11px] font-medium ${
                  userRoleFilter === f.id ? "bg-foreground text-background" : "border border-border text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
            {serverSearchIds && (
              <button
                type="button"
                onClick={() => setServerSearchIds(null)}
                className="h-7 rounded-full border border-brand/40 px-3 text-[11px] text-brand"
              >
                Derin arama: {serverSearchIds.size} sonuç ✕
              </button>
            )}
          </div>

          {filteredUsers.length === 0 ? (
            <Card className="p-6 text-center text-xs text-muted-foreground/80">
              Arama kriterinize uygun kullanıcı bulunamadı.
            </Card>
          ) : (
            <div className="space-y-2.5">
              {filteredUsers.map((u) => {
                const isActionLoading = userActionLoadingId === u.telegramId;
                return (
                  <Card key={u.telegramId} className="p-3.5 space-y-3 border-border hover:border-foreground/15 transition-all">
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

                          return (
                            <>
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {isOnline ? (
                                    <span className="relative flex h-2.5 w-2.5 shrink-0" title="Şu An Çevrimiçi">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand shadow-sm "></span>
                                    </span>
                                  ) : (
                                    <span className="h-2 w-2 rounded-full bg-input shrink-0" title="Çevrimdışı" />
                                  )}
                                  <span className="font-semibold text-xs text-foreground truncate">
                                    {displayTitle}
                                  </span>
                                </div>

                                {/* Rozetler */}
                                {u.isBanned ? (
                                  <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded font-semibold">
                                    ⛔ BANLI
                                  </span>
                                ) : u.role === "admin" ? (
                                  <span className="text-[10px] bg-foreground/10 text-foreground border border-foreground/20 px-1.5 py-0.5 rounded font-semibold">
                                    👑 ADMIN
                                  </span>
                                ) : null}

                                {u.isVip && (
                                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1 shadow-sm ">
                                    ⭐ VIP (%{u.vipDiscountPercent || 15})
                                  </span>
                                )}

                                {isOnline ? (
                                  <span className="text-[10px] bg-brand/20 text-brand border border-brand/40 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                                    ÇEVRİMİÇİ
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground bg-foreground/[0.04] border border-border px-1.5 py-0.5 rounded">
                                    {formatUserLastActive(u.lastActiveAt)}
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] font-mono text-muted-foreground mt-1 truncate flex items-center gap-1.5 flex-wrap">
                                <span>ID: <span className="text-foreground">{u.telegramId}</span></span>
                                {hasRealUsername ? (
                                  <>
                                    <span className="text-muted-foreground/60">•</span>
                                    <span className="text-brand font-medium">@{u.username}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-muted-foreground/60">•</span>
                                    <span className="text-muted-foreground/80 text-[10px] bg-foreground/[0.04] px-1.5 py-0.5 rounded">kullanıcı adı yok</span>
                                  </>
                                )}
                                <span className="text-muted-foreground/60">•</span>
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Clock className="w-3 h-3 text-muted-foreground/80" />
                                  Son aktif: <span className={isOnline ? "text-brand font-medium" : "text-foreground/80"}>{isOnline ? "Şu an aktif (Çevrimiçi)" : formatUserLastActive(u.lastActiveAt)}</span>
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Bakiye & Harcama */}
                      <div className="text-right shrink-0">
                        <div className="font-mono font-semibold text-sm text-brand">
                          ₺{u.balance.toFixed(2)}
                        </div>
                        <span className="text-[10px] text-muted-foreground/80 block">
                          Harcama: ₺{u.spent || 0}
                        </span>
                      </div>
                    </div>

                    {/* Alt Kısım: Hızlı Yönetici Aksiyonları & Detay Butonu */}
                    <div className="pt-2 border-t border-border flex items-center justify-between gap-1.5 flex-wrap">
                      {/* Detay & Numaraları İncele (Ana İstek) */}
                      <button
                        onClick={() => handleOpenUserDetail(u)}
                        className="px-2.5 py-1.5 rounded-lg bg-foreground/8 hover:bg-foreground/13 border border-foreground/15 text-foreground text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Detay & Numaralar ({u.totalOrdersCount || 0})</span>
                      </button>

                      {/* Bakiye Düzenle */}
                      <button
                        onClick={() => {
                          haptic.impact("light");
                          setExactBalanceInput(String(u.balance ?? 0));
                          setBalanceDelta("50");
                          setBalanceEditMode("exact");
                          setEditingUser(u);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-brand/15 hover:bg-brand/25 border border-brand/30 text-brand text-xs font-medium flex items-center gap-1 transition-all"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Bakiye</span>
                      </button>

                      {/* Admin Rolü Ver / Al */}
                      <button
                        onClick={() => handleToggleRole(u)}
                        disabled={isActionLoading}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-all ${
                          u.role === "admin"
                            ? "bg-foreground/10 hover:bg-foreground/15 border-foreground/20 text-foreground"
                            : "bg-muted hover:bg-input border-border text-foreground/80"
                        }`}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>{u.role === "admin" ? "Adminliği Al" : "Admin"}</span>
                      </button>

                      {/* Destek görevlisi (yalnızca destek talepleri) */}
                      {u.role !== "admin" && (
                        <button
                          onClick={() => handleToggleRole(u, u.role === "support" ? "user" : "support")}
                          disabled={isActionLoading}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-all ${
                            u.role === "support"
                              ? "bg-foreground/10 hover:bg-foreground/15 border-foreground/20 text-foreground"
                              : "bg-muted hover:bg-input border-border text-foreground/80"
                          }`}
                        >
                          <Headphones className="w-3.5 h-3.5" />
                          <span>{u.role === "support" ? "Desteği Al" : "Destek"}</span>
                        </button>
                      )}

                      {/* VIP Üyelik Durumu (Ver / Düzenle / Kaldır) */}
                      <button
                        onClick={() => {
                          setVipTargetUser(u);
                          setVipDiscountInput(u.vipDiscountPercent || vipSettingsDefaultDiscount || 15);
                          setVipModalOpen(true);
                          haptic.impact("light");
                        }}
                        disabled={isActionLoading}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-all ${
                          u.isVip
                            ? "bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-300 shadow-sm "
                            : "bg-muted hover:bg-input border-border text-foreground/80"
                        }`}
                        title={u.isVip ? "VIP Üyeliği Düzenle veya İptal Et" : "Kullanıcıyı VIP Yap"}
                      >
                        <Star className={`w-3.5 h-3.5 ${u.isVip ? "fill-amber-300 text-amber-300" : ""}`} />
                        <span>{u.isVip ? `VIP (%${u.vipDiscountPercent || 15})` : "VIP Yap"}</span>
                      </button>

                      {/* Banla / Engeli Kaldır */}
                      <button
                        onClick={() => handleToggleBan(u)}
                        disabled={isActionLoading}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-all ${
                          u.isBanned
                            ? "bg-brand/20 hover:bg-brand/30 border-brand/40 text-brand"
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
            <h3 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">
              Bakiye Yükleme Talepleri ({deposits.length})
            </h3>
            <span className="text-[11px] text-muted-foreground">Onay Bekleyenler</span>
          </div>

          {deposits.length === 0 ? (
            <Card className="p-6 text-center text-xs text-muted-foreground/80">
              Henüz bakiye yükleme talebi bulunmuyor.
            </Card>
          ) : (
            <div className="space-y-2">
              {deposits.map((dep) => (
                <Card key={dep.id} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-xs text-foreground">
                        {(dep as any).userFullName || (dep.username ? `@${dep.username}` : `Kullanıcı #${dep.telegramId}`)}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        {dep.username ? `@${dep.username} · ` : ""}ID <span className="font-mono">{dep.telegramId}</span>
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        {dep.method} • {dep.referenceCode}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-semibold text-sm text-brand">
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
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border">
                      {/^(APR|OXA)-/.test(dep.referenceCode || "") && (
                        <button
                          onClick={async () => {
                            haptic.impact("light");
                            try {
                              const res = await fetch("/api/admin/deposits", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "check_provider", depositId: dep.id }),
                              });
                              const data = await res.json();
                              setToastMsg(data.success ? data.message : data.error || "Kontrol edilemedi");
                              setTimeout(() => setToastMsg(null), 4500);
                              if (data.approved) fetchAllData();
                            } catch {
                              setToastMsg("Kontrol edilemedi");
                            }
                          }}
                          className="px-3 py-1 rounded-lg border border-border text-foreground text-xs font-medium hover:bg-muted"
                        >
                          Sağlayıcıdan kontrol et
                        </button>
                      )}
                      <button
                        onClick={() => handleDepositAction(dep.id, "REJECTED")}
                        className="px-3 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-xs font-medium hover:bg-rose-500/25"
                      >
                        Reddet
                      </button>
                      <button
                        onClick={() => handleDepositAction(dep.id, "APPROVED")}
                        className="px-3 py-1 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/85 shadow-md "
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
          <Card className="p-4 space-y-4 border-foreground/15">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-foreground/10 text-foreground/90">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Telegram Duyuru ve Mesaj Gönder</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Kullanıcılara bot üzerinden doğrudan mesaj veya genel duyuru iletin
                  </p>
                </div>
              </div>
            </div>

            {/* Hedef Seçimi */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80 block">Mesaj Hedefi</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setBroadcastTarget("all");
                  }}
                  className={`p-3 rounded-full border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                    broadcastTarget === "all"
                      ? "bg-foreground/10 border-foreground/40 text-foreground shadow-sm"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
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
                  className={`p-3 rounded-full border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                    broadcastTarget === "user"
                      ? "bg-foreground/10 border-foreground/40 text-foreground shadow-sm"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>Belirli Bir Kullanıcı</span>
                </button>
              </div>
            </div>

            {/* Belirli Kullanıcı Seçimi */}
            {broadcastTarget === "user" && (
              <div className="space-y-1.5 p-3 rounded-xl bg-card border border-border">
                <label className="text-xs font-medium text-foreground/80">Hedef Kullanıcı Seçin</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-foreground/40"
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
                  className="w-full mt-2 bg-card border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/40"
                />
              </div>
            )}

            {/* Hızlı Şablonlar */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground font-medium">Hızlı Şablonlar:</span>
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
                    className="px-2.5 py-1 rounded-lg bg-card border border-border hover:border-foreground/15 text-[11px] text-foreground/80 transition-colors"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mesaj Metni */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground/80">Mesaj Metni (HTML Destekli)</label>
              <textarea
                rows={5}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Göndermek istediğiniz mesajı buraya yazınız... (Örn: <b>Kalın</b>, <i>İtalik</i>, <code>Kod</code> vb.)"
                className="w-full bg-card border border-border rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/40 font-sans"
              />
              <p className="text-[10px] text-muted-foreground/80">
                Telegram HTML etiketleri kullanılabilir: &lt;b&gt;kalın&lt;/b&gt;, &lt;i&gt;italik&lt;/i&gt;, &lt;code&gt;kod&lt;/code&gt;
              </p>
            </div>

            {/* Gönder Butonu */}
            <button
              onClick={handleSendBroadcast}
              disabled={sendingBroadcast || !broadcastMessage.trim()}
              className="w-full py-3.5 rounded-full bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
            <h3 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider flex items-center gap-2">
              <Headphones className="w-4 h-4 text-brand" />
              <span>Kullanıcı Destek Talepleri ({tickets.length})</span>
            </h3>
            <button
              onClick={() => {
                haptic.impact("light");
                fetchAllData();
              }}
              className="text-[11px] text-brand hover:underline flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              <span>Yenile</span>
            </button>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-card/60 rounded-xl border border-border text-xs font-medium">
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
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
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
              <Card className="p-8 text-center text-muted-foreground/80 text-xs">
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
                          ? "border-amber-500/40 bg-gradient-to-r from-amber-950/15 to-card"
                          : "border-border bg-card/80 hover:border-foreground/15"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                            #{t.id}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-foreground/80 font-medium">
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                            <Clock className="w-3 h-3" />
                            <span>BEKLİYOR (AÇIK)</span>
                          </span>
                        ) : t.status === "ANSWERED" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand/20 text-brand border border-brand/40">
                            <CheckCircle className="w-3 h-3" />
                            <span>CEVAPLANDI</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
                            <span>KAPATILDI</span>
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-foreground">{t.subject}</h4>
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
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                              <span>👤 {tUserRealName}</span>
                              <span>•</span>
                              <span className="font-mono">{tUsername}</span>
                              <span>•</span>
                              <span className="font-mono text-muted-foreground/80">ID: {t.telegramId}</span>
                              {userObj && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-brand font-medium">
                                    ₺{userObj.balance.toFixed(2)}
                                  </span>
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="p-2.5 rounded-xl bg-foreground/5 border border-border text-xs text-foreground/80">
                        <span className="text-[10px] text-muted-foreground/80 block mb-0.5">Son Mesaj:</span>
                        <p className="line-clamp-2">
                          {t.messages[t.messages.length - 1]?.text || "Mesaj yok"}
                        </p>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-border text-xs">
                        <span className="flex flex-col text-[10px] text-muted-foreground/80">
                          {new Date(t.updatedAt).toLocaleString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {t.status === "OPEN" && t.messages[t.messages.length - 1]?.sender === "user" && (
                            <span className="font-medium text-amber-400">
                              Yanıt bekliyor: {fmtAgo(t.messages[t.messages.length - 1]?.createdAt || t.updatedAt)}
                            </span>
                          )}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              haptic.selection();
                              setSelectedTicket(t);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Görüşmeyi Aç & Yanıtla ({t.messages.length})</span>
                          </button>

                          <button
                            onClick={() => handleToggleTicketStatus(t.id, t.status)}
                            className="p-1.5 rounded-xl bg-muted hover:bg-input text-foreground/80 transition-colors"
                            title={t.status === "CLOSED" ? "Yeniden Aç" : "Talebi Kapat"}
                          >
                            {t.status === "CLOSED" ? (
                              <RotateCcw className="w-3.5 h-3.5 text-foreground/90" />
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
          <div className="w-full max-w-lg bg-background ring-1 ring-foreground/10 rounded-3xl max-h-[90vh] flex flex-col shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-card/60">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-foreground/90 font-semibold">
                    #{selectedTicket.id}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-foreground/80 font-medium">
                    {selectedTicket.category}
                  </span>
                  {selectedTicket.status === "OPEN" ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                      AÇIK
                    </span>
                  ) : selectedTicket.status === "ANSWERED" ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/20 text-brand font-semibold">
                      CEVAPLANDI
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                      KAPALI
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-foreground mt-1">{selectedTicket.subject}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {selectedTicket.userFirstName} (@{selectedTicket.username || "yok"}) • Telegram ID:{" "}
                  <code>{selectedTicket.telegramId}</code>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleTicketStatus(selectedTicket.id, selectedTicket.status)}
                  className="px-2.5 py-1.5 rounded-xl bg-muted hover:bg-input text-xs text-foreground transition-colors"
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
                  className="p-1.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
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
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1 px-1">
                      {isAdmin ? (
                        <>
                          <span className="font-medium text-foreground">AzFur Yönetici (Siz)</span>
                          <ShieldCheck className="w-3 h-3 text-foreground/90" />
                        </>
                      ) : (
                        <span className="font-medium text-foreground">
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
                          ? "bg-foreground text-background rounded-tr-sm shadow-md font-medium"
                          : "bg-muted/90 border border-border text-foreground rounded-tl-sm shadow-md"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Templates & Reply Box */}
            <div className="p-3.5 bg-card/90 border-t border-border space-y-2.5 shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {[
                  "✅ Bakiyeniz hesabınıza eklenmiştir. Kontrol edebilirsiniz.",
                  "⏳ İşleminiz inceleniyor, lütfen biraz bekleyiniz.",
                  "❌ Belirtilen ödeme kaydı bulunamadı. Lütfen dekont veya TxID iletiniz.",
                  "↩️ Siparişinizin ücreti bakiyenize iade edilmiştir. Farklı bir ülke/servis deneyebilirsiniz.",
                  "📱 Kod gelmediyse 'İptal Et & İade Al' butonuna basın; ücret anında iade edilir. (Numara alındıktan sonraki ilk 2 dakika iptal edilemez.)",
                  "💳 Kripto ödemeniz ağ onayı bekliyor; onaylandığında bakiyeniz otomatik yüklenir ve bildirim alırsınız.",
                  "🙏 Yaşadığınız sorun için özür dileriz, hesabınızı kontrol edip düzelttik.",
                ].map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => setTicketReplyText(tpl)}
                    className="px-2 py-0.5 rounded-lg bg-muted hover:bg-input text-[10px] text-foreground/80 transition-colors"
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
                  className="flex-1 bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-foreground/40 resize-none font-sans"
                />
                <button
                  onClick={handleReplyTicket}
                  disabled={sendingTicketReply || !ticketReplyText.trim()}
                  className="px-4 rounded-full bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-md active:scale-95 transition-all disabled:opacity-40 flex flex-col items-center justify-center gap-1"
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
              <p className="text-[10px] text-muted-foreground/80">
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
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Gift className="w-4 h-4 text-foreground/90" />
                <span>Kuponlar & İndirim Kampanyaları</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Kullanıcılar için hediye bakiye ve SMS onay indirim kodları tanımlayın
              </p>
            </div>
            <button
              onClick={() => {
                haptic.impact("medium");
                setCouponModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-md active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Kupon Oluştur</span>
            </button>
          </div>

          {/* İstatistikler */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-3 bg-background/80 border-border">
              <span className="text-[10px] text-muted-foreground block font-medium">Toplam Kupon</span>
              <span className="text-lg font-semibold text-foreground font-mono mt-0.5 block">{coupons.length}</span>
            </Card>
            <Card className="p-3 bg-background/80 border-border">
              <span className="text-[10px] text-muted-foreground block font-medium">Aktif Kuponlar</span>
              <span className="text-lg font-semibold text-brand font-mono mt-0.5 block">
                {coupons.filter((c) => c.isActive).length}
              </span>
            </Card>
            <Card className="p-3 bg-background/80 border-border">
              <span className="text-[10px] text-muted-foreground block font-medium">Toplam Kullanım</span>
              <span className="text-lg font-semibold text-foreground/90 font-mono mt-0.5 block">
                {coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0)} kez
              </span>
            </Card>
          </div>

          {/* Kupon Listesi */}
          {coupons.length === 0 ? (
            <Card className="p-8 text-center bg-background/60 border-border space-y-2">
              <Gift className="w-8 h-8 mx-auto text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">Henüz tanımlanmış bir kupon kodu bulunmuyor.</p>
              <button
                onClick={() => setCouponModalOpen(true)}
                className="text-xs text-foreground/90 hover:text-foreground font-medium"
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
                        ? "bg-background/40 border-border opacity-70"
                        : "bg-card/80 border-border hover:border-foreground/15"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-muted border border-border font-mono font-semibold text-sm text-foreground tracking-wider flex items-center gap-1.5 select-all">
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
                          className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                          title="Kodu Kopyala"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                            c.type === "BALANCE"
                              ? "bg-brand/20 text-brand border border-brand/30"
                              : c.type === "DISCOUNT_PERCENT"
                              ? "bg-foreground/10 text-foreground border border-foreground/15"
                              : "bg-foreground/10 text-foreground border border-foreground/15"
                          }`}
                        >
                          {c.type === "BALANCE"
                            ? `+₺${c.value} Hediye Bakiye`
                            : c.type === "DISCOUNT_PERCENT"
                            ? `-%${c.value} İndirim`
                            : `-₺${c.value} Sabit İndirim`}
                        </span>

                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            !c.isActive
                              ? "bg-muted text-muted-foreground"
                              : isExpired
                              ? "bg-rose-500/20 text-rose-300"
                              : isFull
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-brand/20 text-brand"
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
                      <p className="text-xs text-foreground/80 leading-relaxed font-sans">{c.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span>
                          Kullanım:{" "}
                          <b className="text-foreground font-mono">{c.usedCount || 0}</b> /{" "}
                          <span className="font-mono">{c.maxUses > 0 ? c.maxUses : "Sınırsız"}</span>
                        </span>
                        {c.expiresAt && (
                          <span>
                            Bitiş:{" "}
                            <b className="text-foreground/80">
                              {new Date(c.expiresAt).toLocaleDateString("tr-TR")}
                            </b>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleCouponActive(c)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                            c.isActive
                              ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
                              : "bg-brand/20 hover:bg-brand/30 text-brand border border-brand/30"
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

      {/* TAB 9: VERİTABANI YEDEKLEME & GERİ YÜKLEME */}
      {activeTab === "backups" && (
        <div className="space-y-4">
          {/* Üst Bilgi ve Durum Paneli */}
          <Card className="p-4 bg-gradient-to-br from-card via-card to-card border-brand/30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-brand/15 border border-brand/30 text-brand">
                  <Archive className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <span>Sistem Yedekleme & Geri Yükleme Motoru</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/20 text-brand border border-brand/30 font-mono">
                      {backups.length} Yedek
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Otomatik periyodik snapshotlar, tek tıkla canlı JSON indirme ve dosyadan tam geri yükleme
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    haptic.impact("light");
                    fetchAllData();
                  }}
                  disabled={refreshing}
                  className="px-3 py-1.5 rounded-xl bg-muted hover:bg-input text-xs text-foreground font-medium flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-brand" : ""}`} />
                  <span>Yenile</span>
                </button>
              </div>
            </div>

            {/* Durum Rozetleri */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-border">
              <div className="p-2 rounded-xl bg-card/60 border border-border">
                <span className="text-[10px] text-muted-foreground block">Otomatik Yedekleme</span>
                <span className={`text-xs font-semibold flex items-center gap-1 mt-0.5 ${backupSettings.autoBackupEnabled ? "text-brand" : "text-muted-foreground/80"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${backupSettings.autoBackupEnabled ? "bg-brand animate-pulse" : "bg-input"}`} />
                  {backupSettings.autoBackupEnabled ? "AKTİF" : "KAPALI"}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-card/60 border border-border">
                <span className="text-[10px] text-muted-foreground block">Yedekleme Sıklığı</span>
                <span className="text-xs font-semibold text-foreground/90 font-mono mt-0.5 block">
                  Her {backupSettings.autoBackupIntervalHours} Saatte Bir
                </span>
              </div>
              <div className="p-2 rounded-xl bg-card/60 border border-border">
                <span className="text-[10px] text-muted-foreground block">Maksimum Saklama</span>
                <span className="text-xs font-semibold text-foreground/90 font-mono mt-0.5 block">
                  {backupSettings.maxBackupsCount} Snapshot
                </span>
              </div>
              <div className="p-2 rounded-xl bg-card/60 border border-border">
                <span className="text-[10px] text-muted-foreground block">Son Yedek Zamanı</span>
                <span className="text-xs font-medium text-amber-300 mt-0.5 block truncate">
                  {(() => {
                    const latest =
                      backupSettings?.lastBackupAt ||
                      backupSettings?.lastBackupTime ||
                      backupSettings?.lastAutoBackupTime ||
                      backups[0]?.createdAt ||
                      backups[0]?.timestamp;
                    return latest ? formatUserLastActive(latest) : "Henüz alınmadı";
                  })()}
                </span>
              </div>
            </div>

            {/* Güvenlik & Rate Limit Bildirimi */}
            <div className="mt-3 p-2.5 rounded-xl bg-foreground/5 border border-foreground/10 flex items-center gap-2 text-[11px] text-foreground">
              <ShieldAlert className="w-4 h-4 text-foreground/90 shrink-0" />
              <span>
                <b>Brute-force ve Güvenlik Koruması Aktif:</b> Yedekleme ve geri yükleme uç noktaları rate limit ile korunur. 5 hatalı PIN denemesinde IP adresi 15 dakika boyunca kilitlenir.
              </span>
            </div>
          </Card>

          {/* 3 BÜYÜK HIZLI EYLEM KARTI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Kart 1: Şimdi Manuel Yedek Al */}
            <Card className="p-4 bg-card/80 border-border flex flex-col justify-between space-y-3 hover:border-brand/40 transition-all">
              <div className="space-y-1.5">
                <div className="w-10 h-10 rounded-xl bg-brand/20 border border-brand/30 flex items-center justify-center text-brand">
                  <HardDrive className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Şimdi Manuel Yedek Al</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Sistemin güncel veritabanını anında yeni bir snapshot olarak buluta kaydeder.
                </p>
              </div>

              <button
                onClick={() => handleCreateBackup()}
                disabled={creatingBackup}
                className="w-full py-2.5 rounded-full bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-md active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creatingBackup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Yedek Alınıyor...</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="w-4 h-4" />
                    <span>💾 Şimdi Yedek Al</span>
                  </>
                )}
              </button>
            </Card>

            {/* Kart 2: Canlı SQL Veritabanını İndir (.sql) */}
            <Card className="p-4 bg-card/80 border-border flex flex-col justify-between space-y-3 hover:border-foreground/20 transition-all">
              <div className="space-y-1.5">
                <div className="w-10 h-10 rounded-xl bg-foreground/10 border border-foreground/15 flex items-center justify-center text-foreground/90">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Canlı SQL Veritabanını İndir</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Şu anki canlı PostgreSQL veritabanını cihazınıza <code className="text-foreground font-mono">.sql</code> dosyası olarak indirir.
                </p>
              </div>

              <button
                onClick={handleDownloadCurrentDatabase}
                className="w-full py-2.5 rounded-full bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>📥 SQL Olarak İndir (.sql)</span>
              </button>
            </Card>

            {/* Kart 3: Dosyadan Geri Yükle (.sql / .json Yükle) */}
            <Card className="p-4 bg-card/80 border-border flex flex-col justify-between space-y-3 hover:border-foreground/20 transition-all">
              <div className="space-y-1.5">
                <div className="w-10 h-10 rounded-xl bg-foreground/10 border border-foreground/15 flex items-center justify-center text-foreground/90">
                  <ArrowUpFromLine className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Dosyadan Geri Yükle</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  İndirmiş olduğunuz bir <code className="text-foreground font-mono">.sql</code> veya <code className="text-foreground font-mono">.json</code> yedek dosyasını yükleyip sistemi geri yükleyin.
                </p>
              </div>

              <div>
                <input
                  type="file"
                  accept=".sql,.json"
                  id="backup-file-uploader"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="backup-file-uploader"
                  className="w-full py-2.5 rounded-xl bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
                >
                  <Upload className="w-4 h-4" />
                  <span>📤 Yedek Dosyası Seç (.sql / .json)</span>
                </label>
              </div>
            </Card>
          </div>

          {/* OTOMATİK YEDEKLEME AYARLARI */}
          <Card className="p-4 bg-card/80 border-border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-brand" />
                <h4 className="text-sm font-semibold text-foreground">Otomatik Periyodik Yedekleme Ayarları</h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Otomatik Çalışma:</span>
                <HaloSwitch
                  aria-label="Otomatik yedekleme"
                  checked={backupSettings.autoBackupEnabled}
                  disabled={savingBackupSettings}
                  onCheckedChange={(checked) => {
                    haptic.selection();
                    handleSaveBackupSettings({ autoBackupEnabled: checked });
                  }}
                />
              </div>
            </div>

            <div className="space-y-3">
              {/* Sıklık Seçimi */}
              <div>
                <label className="text-xs font-medium text-foreground/80 block mb-1.5">
                  ⏱️ Yedekleme Sıklığı (Aralık)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { hours: 1, label: "1 Saat", desc: "Çok Sık" },
                    { hours: 3, label: "3 Saat", desc: "Yoğun İşlem" },
                    { hours: 6, label: "6 Saat", desc: "Önerilen ⭐" },
                    { hours: 12, label: "12 Saat", desc: "Günde 2 Kez" },
                    { hours: 24, label: "24 Saat", desc: "Günlük" },
                  ].map((item) => (
                    <button
                      key={item.hours}
                      type="button"
                      onClick={() =>
                        handleSaveBackupSettings({ autoBackupIntervalHours: item.hours })
                      }
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        backupSettings.autoBackupIntervalHours === item.hours
                          ? "bg-brand/20 border-brand text-brand font-semibold shadow-sm"
                          : "bg-card border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-xs block">{item.label}</span>
                      <span className="text-[10px] text-muted-foreground/80 block">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Maksimum Saklanacak Yedek Sayısı */}
              <div>
                <label className="text-xs font-medium text-foreground/80 block mb-1.5">
                  🗄️ Bulutta Saklanacak Maksimum Snapshot Sayısı
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { count: 10, label: "10 Adet", desc: "Hafif" },
                    { count: 20, label: "20 Adet", desc: "Standart (Önerilen)" },
                    { count: 50, label: "50 Adet", desc: "Geniş Geçmiş" },
                  ].map((item) => (
                    <button
                      key={item.count}
                      type="button"
                      onClick={() =>
                        handleSaveBackupSettings({ maxBackupsCount: item.count })
                      }
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        backupSettings.maxBackupsCount === item.count
                          ? "bg-foreground/10 border-foreground/40 text-foreground font-semibold shadow-sm"
                          : "bg-card border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-xs block">{item.label}</span>
                      <span className="text-[10px] text-muted-foreground/80 block">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground/80">
              💡 Belirlenen sıklık süresi dolduğunda sistem otomatik olarak güvenli bir snapshot oluşturur. Maksimum saklama sayısına ulaşıldığında en eski otomatik snapshotlar otomatik olarak arşivlenir.
            </p>
          </Card>

          {/* KAYITLI SİSTEM YEDEKLERİ GEÇMİŞİ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-brand" />
                <span>Kayıtlı Sistem Snapshotları ({backups.length})</span>
              </h4>
              <span className="text-[11px] text-muted-foreground/80 font-mono">
                Son eklenenler en üstte listelenir
              </span>
            </div>

            {backups.length === 0 ? (
              <Card className="p-8 text-center space-y-2 text-muted-foreground/80 text-xs">
                <Archive className="w-8 h-8 text-muted-foreground/60 mx-auto" />
                <p>Henüz sistemde kayıtlı bir yedek bulunmuyor.</p>
                <p className="text-[11px] text-muted-foreground/60">
                  Yukarıdaki &quot;Şimdi Manuel Yedek Al&quot; butonuna basarak ilk yedeğinizi anında oluşturabilirsiniz.
                </p>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {backups.map((b) => {
                  const isAuto = b.type === "AUTO";
                  const isPreRestore = b.type === "PRE_RESTORE";
                  return (
                    <Card
                      key={b.id}
                      className={`p-3.5 space-y-3 transition-all border ${
                        isPreRestore
                          ? "border-foreground/15 bg-gradient-to-r from-foreground/5 to-card"
                          : isAuto
                          ? "border-foreground/10 bg-card/90 hover:border-foreground/20"
                          : "border-brand/20 bg-card/90 hover:border-brand/40"
                      }`}
                    >
                      {/* Üst Satır: Tür, Başlık ve Tarih */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
                                isPreRestore
                                  ? "bg-foreground/10 text-foreground border border-foreground/15"
                                  : isAuto
                                  ? "bg-foreground/10 text-foreground border border-foreground/15"
                                  : "bg-brand/20 text-brand border border-brand/30"
                              }`}
                            >
                              {isPreRestore
                                ? "🛡️ GÜVENLİK YEDEĞİ"
                                : isAuto
                                ? "🤖 OTOMATİK"
                                : "👤 MANUEL"}
                            </span>
                            <span className="font-semibold text-xs text-foreground">
                              {b.label || "Sistem Snapshotı"}
                            </span>
                          </div>

                          {(() => {
                            const bDate = b.createdAt || b.timestamp;
                            const isValidDate = bDate && !isNaN(new Date(bDate).getTime());
                            const displayDate = isValidDate ? new Date(bDate).toLocaleString("tr-TR") : new Date().toLocaleString("tr-TR");
                            const relativeTime = isValidDate ? formatUserLastActive(bDate) : "Yeni oluşturuldu";
                            return (
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <Clock className="w-3 h-3 text-muted-foreground/80" />
                                <span>{displayDate}</span>
                                <span className="text-muted-foreground/60">•</span>
                                <span className="text-brand font-medium">
                                  {relativeTime}
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Aksiyon Butonları */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* İndir */}
                          <button
                            onClick={() => handleDownloadSnapshot(b.id, b.createdAt || b.timestamp)}
                            className="p-2 rounded-xl bg-foreground/8 hover:bg-foreground/13 border border-foreground/15 text-foreground text-xs font-medium flex items-center gap-1 transition-all"
                            title="SQL Yedeğini İndir (.sql)"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">SQL İndir</span>
                          </button>

                          {/* Geri Yükle */}
                          <button
                            onClick={() => {
                              setSelectedBackupToRestore(b);
                              setRestoreTargetType("snapshot");
                              setRestoreConfirmModalOpen(true);
                              haptic.impact("medium");
                            }}
                            className="p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center gap-1 transition-all"
                            title="Bu Yedeğe Geri Dön"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Geri Yükle</span>
                          </button>

                          {/* Sil */}
                          <button
                            onClick={() => handleDeleteBackup(b.id)}
                            className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs transition-all"
                            title="Yedeği Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* İstatistikler */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-2 border-t border-border text-[11px] font-mono">
                        <div className="p-1.5 rounded-lg bg-background/60 border border-border flex items-center justify-between">
                          <span className="text-muted-foreground/80 text-[10px]">Kullanıcı:</span>
                          <span className="font-semibold text-foreground">{b.stats?.usersCount || 0}</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-background/60 border border-border flex items-center justify-between">
                          <span className="text-muted-foreground/80 text-[10px]">Bakiye:</span>
                          <span className="font-semibold text-brand">
                            ₺{Number(b.stats?.totalUserBalance ?? b.stats?.totalBalance ?? 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-background/60 border border-border flex items-center justify-between">
                          <span className="text-muted-foreground/80 text-[10px]">Sipariş:</span>
                          <span className="font-semibold text-foreground/90">
                            {b.stats?.activationsCount ?? b.stats?.ordersCount ?? 0}
                          </span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-background/60 border border-border flex items-center justify-between">
                          <span className="text-muted-foreground/80 text-[10px]">Yükleme:</span>
                          <span className="font-semibold text-amber-400">{b.stats?.depositsCount || 0}</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-background/60 border border-border flex items-center justify-between">
                          <span className="text-muted-foreground/80 text-[10px]">Boyut:</span>
                          <span className="font-semibold text-foreground/90">
                            {b.stats?.sizeKb ?? (b.sizeBytes ? Number((b.sizeBytes / 1024).toFixed(1)) : 0)} KB
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 10: AUDIT LOGS (DENETİM VE GÜVENLİK LOGLARI) */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          {/* Üst Bilgi ve Butonlar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-card via-card to-foreground/5 p-4 rounded-2xl border border-border">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-foreground/10 text-foreground/90">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>Sistem Denetim & Aktivite Logları</span>
                    <Badge color="purple">Canlı</Badge>
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Bakiye yüklemeleri, siparişler, VIP/yetki işlemleri ve güvenlik olayları
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchLogs}
                disabled={loadingLogs}
                className="px-3 py-2 rounded-xl bg-muted hover:bg-input text-foreground text-xs font-medium flex items-center gap-1.5 transition-all border border-border disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
                <span>Yenile</span>
              </button>

              <button
                type="button"
                onClick={handleClearLogs}
                disabled={clearingLogs || logs.length === 0}
                className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-all border border-rose-500/30 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{clearingLogs ? "Temizleniyor..." : "Logları Temizle"}</span>
              </button>
            </div>
          </div>

          {/* Filtre ve Arama Çubuğu */}
          <Card className="p-3.5 bg-card/90 border-border space-y-3">
            <div className="flex flex-col md:flex-row gap-2.5">
              {/* Arama */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted-foreground/80 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="İşlem adı, kullanıcı, ID veya açıklama ara..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/40"
                />
                {logSearchQuery && (
                  <button
                    onClick={() => setLogSearchQuery("")}
                    className="absolute right-2.5 top-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Temizle
                  </button>
                )}
              </div>

              {/* Kategori Filtresi */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 text-xs">
                {[
                  { id: "ALL", label: "Tümü" },
                  { id: "DEPOSIT", label: "💰 Bakiye" },
                  { id: "ORDER", label: "🛒 Sipariş" },
                  { id: "USER", label: "👤 Kullanıcı" },
                  { id: "SECURITY", label: "🛡️ Güvenlik" },
                  { id: "ADMIN", label: "👑 Admin" },
                  { id: "BACKUP", label: "💾 Yedek" },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setLogCategoryFilter(c.id)}
                    className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all text-[11px] ${
                      logCategoryFilter === c.id
                        ? "bg-foreground text-background shadow-sm"
                        : "bg-muted/80 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Seviye Filtresi */}
            <div className="flex items-center gap-1.5 pt-1 border-t border-border text-[11px]">
              <span className="text-muted-foreground/80 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Seviye:
              </span>
              {[
                { id: "ALL", label: "Tümü" },
                { id: "SUCCESS", label: "Başarılı", color: "text-brand" },
                { id: "INFO", label: "Bilgi", color: "text-foreground/90" },
                { id: "WARN", label: "Uyarı", color: "text-amber-400" },
                { id: "ERROR", label: "Hata", color: "text-rose-400" },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => setLogLevelFilter(lvl.id)}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    logLevelFilter === lvl.id
                      ? "bg-foreground/10 text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className={lvl.color}>{lvl.label}</span>
                </button>
              ))}

              <span className="ml-auto text-muted-foreground/80 font-mono text-[10px]">
                {filteredLogs.length} / {logs.length} kayıt
              </span>
            </div>
          </Card>

          {/* Log Listesi */}
          {loadingLogs ? (
            <div className="p-12 text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-foreground/90 mx-auto" />
              <p className="text-xs text-muted-foreground">Denetim kayıtları yükleniyor...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <Card className="p-8 text-center space-y-2 text-muted-foreground/80 text-xs">
              <FileText className="w-8 h-8 text-muted-foreground/60 mx-auto" />
              <p>Filtreye uygun log kaydı bulunamadı.</p>
              <p className="text-[11px] text-muted-foreground/60">
                Sistemde işlem gerçekleştikçe (bakiye yükleme, sipariş, ayar değişiklikleri) loglar burada listelenecektir.
              </p>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {filteredLogs.map((l: any) => {
                const isError = l.level === "ERROR";
                const isWarn = l.level === "WARN";
                const isSuccess = l.level === "SUCCESS";
                return (
                  <div
                    key={l.id}
                    className={`p-3 rounded-xl border text-xs transition-all ${
                      isError
                        ? "bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50"
                        : isWarn
                        ? "bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50"
                        : isSuccess
                        ? "bg-brand/10 border-brand/30 hover:border-brand/50"
                        : "bg-card/80 border-border hover:border-foreground/15"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                              isError
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : isWarn
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : isSuccess
                                ? "bg-brand/20 text-brand border border-brand/30"
                                : "bg-foreground/10 text-foreground border border-foreground/15"
                            }`}
                          >
                            {l.level}
                          </span>

                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-foreground/5 text-foreground/80 border border-border">
                            {l.category}
                          </span>

                          <span className="font-semibold font-mono text-xs text-foreground">
                            {l.action}
                          </span>
                        </div>

                        {l.details && (
                          <div className="text-[11px] text-foreground/80 font-mono bg-foreground/5 p-2 rounded-lg border border-border break-all whitespace-pre-wrap">
                            {typeof l.details === "object"
                              ? JSON.stringify(l.details, null, 2)
                              : String(l.details)}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                          {l.telegramId && (
                            <span>
                              Kullanıcı: <b className="text-foreground">#{l.telegramId}</b>
                              {l.username && <span className="text-brand"> (@{l.username})</span>}
                            </span>
                          )}
                          {l.ip && (
                            <span>
                              IP: <b className="text-foreground/80 font-mono">{l.ip}</b>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1 justify-end font-mono">
                          <Clock className="w-3 h-3 text-muted-foreground/80" />
                          <span>{new Date(l.timestamp).toLocaleTimeString("tr-TR")}</span>
                        </div>
                        <span className="text-muted-foreground/80 block">
                          {new Date(l.timestamp).toLocaleDateString("tr-TR")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Yeni Kupon Oluşturma Modalı */}
      {couponModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-background ring-1 ring-foreground/10 rounded-3xl p-5 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-foreground/10 text-foreground">
                  <Gift className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Yeni Kupon / Kampanya Tanımla</h3>
              </div>
              <button
                onClick={() => setCouponModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground/80 block mb-1">Kupon Kodu</label>
                <input
                  type="text"
                  placeholder="ÖRN: HOSGELDIN, YAZ2026, VIP50"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold tracking-wider text-foreground uppercase focus:outline-none focus:border-foreground/40"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground/80 block mb-1">Kupon Türü</label>
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
                          ? "bg-foreground/10 border-foreground/40 text-foreground"
                          : "bg-card border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-xs font-semibold block">{t.label}</span>
                      <span className="text-[9px] text-muted-foreground/80 block">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-foreground/80 block mb-1">
                    {couponType === "DISCOUNT_PERCENT" ? "İndirim Oranı (%)" : "Tutar (₺)"}
                  </label>
                  <input
                    type="number"
                    placeholder={couponType === "DISCOUNT_PERCENT" ? "Örn: 20" : "Örn: 25"}
                    value={couponValue}
                    onChange={(e) => setCouponValue(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono text-brand font-semibold focus:outline-none focus:border-foreground/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground/80 block mb-1">
                    Kullanım Limiti (0 = Sınırsız)
                  </label>
                  <input
                    type="number"
                    placeholder="Örn: 100"
                    value={couponMaxUses}
                    onChange={(e) => setCouponMaxUses(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-foreground/40"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground/80 block mb-1">
                  Son Geçerlilik Tarihi (Opsiyonel)
                </label>
                <input
                  type="date"
                  value={couponExpiresAt}
                  onChange={(e) => setCouponExpiresAt(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-foreground/40"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground/80 block mb-1">
                  Kampanya Açıklaması / Notu
                </label>
                <textarea
                  rows={2}
                  placeholder="Örn: İlk defa kayıt olan kullanıcılara hoş geldin hediyesi."
                  value={couponDesc}
                  onChange={(e) => setCouponDesc(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-foreground/40 resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCouponModalOpen(false)}
                className="py-2.5 rounded-xl bg-muted hover:bg-input text-foreground/80 font-semibold text-xs transition-all"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleCreateCoupon}
                disabled={savingCoupon || !couponCode.trim()}
                className="py-2.5 rounded-full bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-background ring-1 ring-foreground/10 rounded-3xl p-4 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)] space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <span>💳 Bakiye Düzenle</span>
                </h3>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {editingUser.firstName} (@{editingUser.username || editingUser.telegramId})
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground/80 block font-medium">Mevcut Bakiye</span>
                <span className="font-mono font-semibold text-brand text-sm">
                  ₺{editingUser.balance?.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>

            {/* Mod Seçimi: Net Bakiye Belirle vs Miktar Ekle/Düş */}
            <div className="grid grid-cols-2 p-0.5 rounded-xl bg-card border border-border">
              <button
                type="button"
                onClick={() => setBalanceEditMode("exact")}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  balanceEditMode === "exact"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Net Tutar Belirle (=)
              </button>
              <button
                type="button"
                onClick={() => setBalanceEditMode("delta")}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  balanceEditMode === "delta"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Miktar Ekle / Düş (±)
              </button>
            </div>

            {balanceEditMode === "exact" ? (
              /* MOD 1: Doğrudan Net Bakiye Belirleme */
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Yeni Net Bakiye Tutarı (₺):
                  </span>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground/80 font-mono text-sm">₺</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={exactBalanceInput}
                      onChange={(e) => setExactBalanceInput(e.target.value)}
                      placeholder="Örn: 100"
                      className="w-full bg-card border border-border rounded-xl pl-8 pr-3 py-2 text-base font-mono font-semibold text-foreground focus:outline-none focus:border-brand"
                      autoFocus
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground/80">
                    Kullanıcının bakiyesi doğrudan bu rakama eşitlenecektir.
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[0, 50, 100, 250].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setExactBalanceInput(String(val))}
                      className="py-1 px-1.5 rounded-lg bg-card border border-border hover:border-foreground/15 text-xs font-mono text-foreground/80"
                    >
                      {val}₺
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleSetExactBalance}
                  className="bg-foreground w-full py-2.5 rounded-full text-background font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <CheckCircle className="w-4 h-4 stroke-[2.5]" />
                  <span>Yeni Bakiyeyi Doğrudan Kaydet</span>
                </button>
              </div>
            ) : (
              /* MOD 2: Miktar Ekle / Düş (+ / -) */
              <div className="space-y-3">
                {/* Hızlı Miktar Butonları */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-muted-foreground font-medium">Hızlı Tutarlar:</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[20, 50, 100, 250].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setBalanceDelta(String(val))}
                        className="py-1 px-2 rounded-lg bg-card border border-border hover:border-foreground/15 text-xs font-mono text-foreground/80"
                      >
                        +{val}₺
                      </button>
                    ))}
                  </div>
                </div>

                {/* Özel Miktar Girişi */}
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Eklenecek / Düşülecek Tutar (₺):</span>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground/80 font-mono text-sm">₺</span>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={balanceDelta}
                      onChange={(e) => setBalanceDelta(e.target.value)}
                      placeholder="Örn: 50"
                      className="w-full bg-card border border-border rounded-xl pl-8 pr-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                {/* Ekle / Düş Butonları */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleAdjustBalance(false)}
                    className="py-2.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <Minus className="w-4 h-4 stroke-[3]" />
                    <span>- {balanceDelta || 0} ₺ Düş</span>
                  </button>
                  <button
                    onClick={() => handleAdjustBalance(true)}
                    className="py-2.5 rounded-full bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>+ {balanceDelta || 0} ₺ Ekle</span>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setEditingUser(null)}
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Kapat / Vazgeç
            </button>
          </div>
        </div>
      )}

      {/* 7. DETAYLI KULLANICI İNCELEME MODALI (TÜM NUMARALAR, SMS KODLARI, YÜKLEMELER) */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl bg-background ring-1 ring-foreground/10 rounded-3xl sm:rounded-3xl p-4 sm:p-6 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)] space-y-4 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-foreground/10 to-foreground/10 border border-foreground/15 flex items-center justify-center text-foreground/90 font-semibold text-base shadow-inner">
                  {selectedUserDetail.firstName ? selectedUserDetail.firstName[0].toUpperCase() : "U"}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-foreground">
                      {selectedUserDetail.firstName || "Kullanıcı"} {selectedUserDetail.lastName || ""}
                    </h3>
                    {selectedUserDetail.role === "admin" && (
                      <span className="text-[10px] bg-foreground/10 text-foreground border border-foreground/20 px-2 py-0.5 rounded-full font-semibold">
                        👑 ADMIN
                      </span>
                    )}
                    {selectedUserDetail.isBanned && (
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-semibold">
                        ⛔ BANLI
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mt-0.5">
                    {selectedUserDetail.username ? (
                      <span className="text-brand font-medium">@{selectedUserDetail.username}</span>
                    ) : (
                      <span className="text-muted-foreground/80">kullanıcı adı yok</span>
                    )}
                    <span className="text-muted-foreground/60">•</span>
                    <button
                      onClick={() => handleCopyDetail(String(selectedUserDetail.telegramId), "id")}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      title="ID Kopyala"
                    >
                      <span>ID: {selectedUserDetail.telegramId}</span>
                      {copiedDetailText === "id" ? (
                        <Check className="w-3 h-3 text-brand" />
                      ) : (
                        <Copy className="w-3 h-3 text-muted-foreground/80" />
                      )}
                    </button>
                    <span className="text-muted-foreground/60">•</span>
                    {(() => {
                      const latMs = selectedUserDetail.lastActiveAt ? new Date(selectedUserDetail.lastActiveAt).getTime() : 0;
                      const isDetailOnline = latMs > 0 && Date.now() - latMs < 5 * 60 * 1000;
                      return isDetailOnline ? (
                        <span className="text-brand font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                          Şu an aktif (Çevrimiçi)
                        </span>
                      ) : (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground/80" />
                          Son aktif: {formatUserLastActive(selectedUserDetail.lastActiveAt)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedUserDetail(null)}
                className="p-1.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* İstatistik Özet Kartları */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-card/80 border border-border">
                <span className="text-[10px] text-muted-foreground block">Mevcut Bakiye</span>
                <span className="text-sm font-semibold font-mono text-brand">
                  ₺{selectedUserDetail.balance?.toFixed(2) || "0.00"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-card/80 border border-border">
                <span className="text-[10px] text-muted-foreground block">Toplam Harcama</span>
                <span className="text-sm font-semibold font-mono text-foreground/90">
                  ₺{selectedUserDetail.spent || 0}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-card/80 border border-border">
                <span className="text-[10px] text-muted-foreground block">Alınan Numara</span>
                <span className="text-sm font-semibold font-mono text-foreground/90">
                  {userActivations.length} Adet
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-card/80 border border-border">
                <span className="text-[10px] text-muted-foreground block">Gelen SMS Kodu</span>
                <span className="text-sm font-semibold font-mono text-amber-400">
                  {userActivations.filter((a) => a.smsCode).length} Adet
                </span>
              </div>
            </div>

            {/* İç Sekmeler */}
            <div className="flex items-center gap-1.5 p-1 bg-card rounded-xl border border-border text-xs font-medium overflow-x-auto no-scrollbar">
              <button
                onClick={() => setUserDetailTab("numbers")}
                className={`py-1.5 px-3 rounded-lg shrink-0 transition-all ${
                  userDetailTab === "numbers"
                    ? "bg-foreground/10 text-foreground border border-foreground/15 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                📱 Aldığı Numaralar ({userActivations.length})
              </button>
              <button
                onClick={() => setUserDetailTab("deposits")}
                className={`py-1.5 px-3 rounded-lg shrink-0 transition-all ${
                  userDetailTab === "deposits"
                    ? "bg-brand/20 text-brand border border-brand/30 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                💳 Bakiye Yüklemeleri ({userDeposits.length})
              </button>
              <button
                onClick={() => setUserDetailTab("tickets")}
                className={`py-1.5 px-3 rounded-lg shrink-0 transition-all ${
                  userDetailTab === "tickets"
                    ? "bg-foreground/10 text-foreground border border-foreground/15 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🎫 Destek Talepleri ({userTickets.length})
              </button>
              <button
                onClick={() => setUserDetailTab("actions")}
                className={`py-1.5 px-3 rounded-lg shrink-0 transition-all ${
                  userDetailTab === "actions"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ⚡ Yönetici İşlemleri
              </button>
              <button
                onClick={() => setUserDetailTab("ledger")}
                className={`py-1.5 px-3 rounded-lg shrink-0 transition-all ${
                  userDetailTab === "ledger"
                    ? "bg-foreground/10 text-foreground border border-foreground/15 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🧾 Bakiye Hareketleri
              </button>
            </div>

            {/* Sekme İçerikleri */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-2 max-h-[50vh]">
              {userDetailLoading ? (
                <div className="p-8 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-foreground/90 mx-auto" />
                  <p className="text-xs text-muted-foreground">Kullanıcının sipariş ve numara geçmişi yükleniyor...</p>
                </div>
              ) : (
                <>
                  {userDetailTab === "ledger" && selectedUserDetail && (
                    <UserLedgerPanel telegramId={Number(selectedUserDetail.telegramId)} />
                  )}

                  {/* 1. NUMARALAR & KODLAR SEKMESİ */}
                  {userDetailTab === "numbers" && (
                    <div className="space-y-2">
                      {userActivations.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground/80 bg-card/40 rounded-2xl border border-border">
                          Bu kullanıcı henüz hiç numara satın almamış.
                        </div>
                      ) : (
                        userActivations.map((a) => (
                          <div
                            key={a.id}
                            className="p-3 rounded-2xl bg-card/90 border border-border space-y-2 hover:border-foreground/15 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{a.countryFlag || "🌐"}</span>
                                <ServiceIcon code={a.serviceCode} name={a.serviceName} size="sm" />
                                <span className="font-semibold text-xs text-foreground">
                                  {a.serviceName} ({a.countryName})
                                </span>
                              </div>

                              <div>
                                {a.smsCode ? (
                                  <span className="text-[10px] bg-brand/20 text-brand border border-brand/40 px-2 py-0.5 rounded font-semibold">
                                    ✅ KOD ALINDI
                                  </span>
                                ) : a.status === "WAIT_CODE" ? (
                                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-semibold animate-pulse">
                                    ⏳ KOD BEKLENİYOR
                                  </span>
                                ) : a.status === "CANCELLED" ? (
                                  <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded font-semibold">
                                    🚫 İPTAL EDİLDİ
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded font-semibold">
                                    {a.status}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Telefon Numarası & Kopyalama Kutusu */}
                            <div className="p-2.5 rounded-xl bg-muted border border-border flex items-center justify-between gap-2">
                              <div>
                                <span className="text-[10px] text-muted-foreground block font-sans">Tahsis Edilen Numara:</span>
                                <span className="font-mono font-semibold text-sm text-foreground select-all">
                                  {a.phoneNumber}
                                </span>
                              </div>

                              <button
                                onClick={() => handleCopyDetail(a.phoneNumber, `phone_${a.id}`)}
                                className="px-2 py-1 rounded-lg bg-muted text-foreground/80 hover:text-foreground text-xs flex items-center gap-1 font-mono transition-colors"
                              >
                                {copiedDetailText === `phone_${a.id}` ? (
                                  <>
                                    <Check className="w-3 h-3 text-brand" />
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
                              <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-between">
                                <div>
                                  <span className="text-[10px] font-semibold text-brand uppercase tracking-wider block">
                                    Gelen SMS Onay Kodu:
                                  </span>
                                  <span className="text-base font-semibold font-mono text-brand tracking-wider">
                                    {a.smsCode}
                                  </span>
                                  {a.smsText && (
                                    <p className="text-[11px] text-muted-foreground mt-1 italic select-all">
                                      &ldquo;{a.smsText}&rdquo;
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleCopyDetail(a.smsCode, `code_${a.id}`)}
                                  className="px-2.5 py-1.5 rounded-lg bg-brand/20 hover:bg-brand/30 text-brand font-semibold text-xs flex items-center gap-1 transition-all"
                                >
                                  {copiedDetailText === `code_${a.id}` ? "Kopyalandı" : "Kodu Kopyala"}
                                </button>
                              </div>
                            ) : null}

                            {/* Fiyat ve Tarih */}
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 pt-1 border-t border-border">
                              <span className="font-mono">Ücret: ₺{a.chargedPrice?.toFixed(2) || "0.00"}</span>
                              <span>
                                {a.createdAt ? new Date(a.createdAt).toLocaleString("tr-TR") : ""}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground/60">#{a.id}</span>
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
                        <div className="p-6 text-center text-xs text-muted-foreground/80 bg-card/40 rounded-2xl border border-border">
                          Bu kullanıcı henüz bakiye yükleme talebinde bulunmamış.
                        </div>
                      ) : (
                        userDeposits.map((dep) => (
                          <div
                            key={dep.id}
                            className="p-3 rounded-2xl bg-card/90 border border-border space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-brand font-mono">
                                +₺{dep.amount?.toFixed(2)}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                  dep.status === "APPROVED"
                                    ? "bg-brand/20 text-brand border border-brand/30"
                                    : dep.status === "REJECTED"
                                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                }`}
                              >
                                {dep.status === "APPROVED" ? "ONAYLANDI" : dep.status === "REJECTED" ? "REDDEDİLDİ" : "BEKLEMEDE"}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                              <span>Yöntem: {dep.method || "Kripto / Havale"}</span>
                              <span>{dep.createdAt ? new Date(dep.createdAt).toLocaleString("tr-TR") : ""}</span>
                            </div>
                            {dep.txid && (
                              <p className="text-[10px] font-mono text-muted-foreground/80 truncate">
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
                        <div className="p-6 text-center text-xs text-muted-foreground/80 bg-card/40 rounded-2xl border border-border">
                          Bu kullanıcının henüz destek talebi bulunmuyor.
                        </div>
                      ) : (
                        userTickets.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 rounded-2xl bg-card/90 border border-border space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-foreground">{t.subject}</span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                  t.status === "OPEN"
                                    ? "bg-amber-500/20 text-amber-300"
                                    : t.status === "ANSWERED"
                                    ? "bg-brand/20 text-brand"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {t.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              Son Güncelleme: {new Date(t.updatedAt).toLocaleString("tr-TR")}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* 4. YÖNETİCİ HIZLI AKSİYONLARI */}
                  {userDetailTab === "actions" && (
                    <div className="p-3.5 rounded-2xl bg-card/80 border border-border space-y-3">
                      <span className="text-xs font-semibold text-foreground block">
                        Kullanıcıya Özel Yönetici İşlemleri
                      </span>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Bakiye Düzenle */}
                        <button
                          onClick={() => {
                            haptic.impact("light");
                            setExactBalanceInput(String(selectedUserDetail.balance ?? 0));
                            setBalanceDelta("50");
                            setBalanceEditMode("exact");
                            setEditingUser(selectedUserDetail);
                          }}
                          className="p-3 rounded-full bg-brand/15 hover:bg-brand/25 border border-brand/30 text-brand text-xs font-medium flex items-center justify-center gap-2 transition-all"
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
                          className="p-3 rounded-full bg-foreground/8 hover:bg-foreground/13 border border-foreground/15 text-foreground text-xs font-medium flex items-center justify-center gap-2 transition-all"
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
                          className="p-3 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center justify-center gap-2 transition-all"
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
                          className="p-3 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center justify-center gap-2 transition-all"
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
            <div className="pt-2 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-input text-xs text-foreground/80 hover:text-foreground font-medium transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. GERİ YÜKLEME ONAY MODALI (PIN & BRUTEFORCE GÜVENLİK KORUMALI) */}
      {restoreConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-background border border-amber-500/40 rounded-3xl p-5 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)] space-y-4">
            {/* Modal Başlık */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Sistemi Yedeğe Geri Yükleme</h3>
                  <p className="text-[11px] text-muted-foreground">Veritabanı önceki durumuna geri yüklenecektir</p>
                </div>
              </div>
              <button
                onClick={() => setRestoreConfirmModalOpen(false)}
                className="p-1.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Güvenlik Uyarısı */}
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-1 text-xs text-amber-200">
              <span className="font-semibold block">⚠️ Dikkat: Mevcut veritabanı seçilen yedek ile değiştirilecektir!</span>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                İşlem öncesinde sistem otomatik olarak şu anki durumun <b>&quot;PRE_RESTORE&quot; (Güvenlik Yedeği)</b> kopyasını alacaktır. İstediğiniz an mevcut duruma da geri dönebilirsiniz.
              </p>
            </div>

            {/* Geri Yüklenecek Yedek Özeti */}
            <div className="p-3 rounded-xl bg-card border border-border space-y-2">
              <span className="text-xs font-semibold text-foreground/80 block">Hedef Yedek Özeti:</span>
              {restoreTargetType === "file" && uploadedFileBackup && (
                <div className="text-xs font-mono space-y-1">
                  <div className="text-brand">📁 Yüklenen Dosya: <b>{uploadedFileName}</b></div>
                  <div className="text-foreground/80">
                    👥 Kullanıcı: <b>{Object.keys(uploadedFileBackup.users || {}).length} Kişi</b>
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    📦 Sipariş Kayıtları: <b>{Object.keys(uploadedFileBackup.activations || {}).length} Adet</b>
                  </div>
                </div>
              )}

              {restoreTargetType === "snapshot" && selectedBackupToRestore && (
                <div className="text-xs font-mono space-y-1">
                  <div className="text-brand">🏷️ Yedek Etiketi: <b>{selectedBackupToRestore.label}</b></div>
                  <div className="text-foreground/80">
                    🕒 Tarih: <b>{new Date(selectedBackupToRestore.createdAt).toLocaleString("tr-TR")}</b>
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    👥 {selectedBackupToRestore.stats?.usersCount} Kullanıcı • 💰 ₺{selectedBackupToRestore.stats?.totalBalance?.toFixed(2)} Toplam Bakiye • 📦 {selectedBackupToRestore.stats?.ordersCount} Sipariş
                  </div>
                </div>
              )}
            </div>

            {/* PIN Kodu Güvenlik Girişi */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/80 flex items-center justify-between">
                <span>Yönetici PIN Kodu Doğrulaması</span>
                <span className="text-[10px] text-muted-foreground/80 font-mono">Brute-force Korumalı</span>
              </label>
              <input
                type="password"
                value={backupSecurityPin}
                onChange={(e) => setBackupSecurityPin(e.target.value)}
                placeholder="Yönetici PIN kodu (veritabanında tanımlıysa)"
                className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold text-foreground focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-muted-foreground/80">
                🔒 Güvenlik uyarısı: 5 defa hatalı PIN girilirse IP adresiniz sistem tarafından 15 dakika boyunca kilitlenir.
              </p>
            </div>

            {/* Eylem Butonları */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setRestoreConfirmModalOpen(false)}
                disabled={restoringBackup}
                className="py-2.5 rounded-xl bg-muted hover:bg-input text-foreground/80 font-semibold text-xs transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={restoringBackup || !backupSecurityPin.trim()}
                className="py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs shadow-md active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {restoringBackup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Geri Yükleniyor...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Onayla ve Geri Yükle</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIP Üyelik & Özel İndirim Modalı */}
      {vipModalOpen && vipTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-background border border-amber-500/30 rounded-3xl p-5 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {vipTargetUser.isVip ? "⭐ VIP Üyeliği Düzenle" : "⭐ VIP Üyelik Tanımla"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {vipTargetUser.firstName || vipTargetUser.username || vipTargetUser.telegramId} için özel indirim
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVipModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Kullanıcı Özeti */}
            <div className="bg-muted border border-border rounded-xl p-3 flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <span>{vipTargetUser.firstName || "Kullanıcı"}</span>
                  {vipTargetUser.username && (
                    <span className="text-brand font-mono text-[11px]">@{vipTargetUser.username}</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  ID: {vipTargetUser.telegramId}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground/80 block">Mevcut Bakiye</span>
                <span className="font-mono font-semibold text-brand text-xs">₺{vipTargetUser.balance.toFixed(2)}</span>
              </div>
            </div>

            {/* İndirim Oranı Belirleme */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80 block">
                Özel VIP İndirim Oranı (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={vipDiscountInput}
                  onChange={(e) => setVipDiscountInput(Math.max(1, Math.min(90, Number(e.target.value))))}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold text-foreground focus:outline-none focus:border-amber-500"
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-amber-400">%</span>
              </div>

              {/* Hızlı Seçim Butonları */}
              <div className="grid grid-cols-6 gap-1 pt-1">
                {[5, 10, 15, 20, 25, 50].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setVipDiscountInput(pct)}
                    className={`py-1 rounded-lg border text-xs font-mono font-semibold transition-all ${
                      vipDiscountInput === pct
                        ? "bg-amber-500/20 border-amber-500 text-amber-300"
                        : "bg-card border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    %{pct}
                  </button>
                ))}
              </div>

              <p className="text-[10px] text-muted-foreground/80 leading-relaxed pt-1">
                💡 Kullanıcı bu indirimi hem Telegram Botunda hem WebApp üzerinde SMS satın alırken otomatik olarak kullanır. İndirimli fiyatlar sipariş onay ekranında belirgin olarak gösterilir.
              </p>
            </div>

            {/* Eylemler */}
            <div className="space-y-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  handleToggleVip(vipTargetUser, vipDiscountInput, true);
                  setVipModalOpen(false);
                }}
                disabled={userActionLoadingId === vipTargetUser.telegramId}
                className="w-full py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs shadow-md active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Star className="w-4 h-4 fill-black text-black" />
                <span>
                  {vipTargetUser.isVip
                    ? `İndirimi %${vipDiscountInput} Olarak Güncelle`
                    : `⭐ VIP Üye Yap (%${vipDiscountInput} İndirim)`}
                </span>
              </button>

              {vipTargetUser.isVip && (
                <button
                  type="button"
                  onClick={() => {
                    handleToggleVip(vipTargetUser, undefined, false);
                    setVipModalOpen(false);
                  }}
                  disabled={userActionLoadingId === vipTargetUser.telegramId}
                  className="w-full py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 font-medium text-xs border border-rose-500/30 transition-all"
                >
                  VIP Üyeliği ve İndirimi Kaldır
                </button>
              )}

              <button
                type="button"
                onClick={() => setVipModalOpen(false)}
                className="w-full py-2 rounded-xl bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs transition-colors"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  LifeBuoy,
  MessageSquare,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  ExternalLink,
  ShieldCheck,
  Headphones,
  AlertCircle,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Ticket, TicketCategory } from "@/lib/types";
import { haptic } from "@/lib/haptic";

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramId: number;
  userFirstName?: string;
  username?: string;
}

export function SupportModal({
  isOpen,
  onClose,
  telegramId,
  userFirstName,
  username,
}: SupportModalProps) {
  const [activeTab, setActiveTab] = useState<"list" | "create" | "detail">("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [supportUsername, setSupportUsername] = useState<string>("azfursms_admin");
  const [supportUsernames, setSupportUsernames] = useState<string[]>(["azfursms_admin"]);

  // Create form state
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>("BALANCE");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  // Detail state
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replying, setReplying] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchTickets = async () => {
    if (!telegramId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tickets?telegramId=${telegramId}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setTickets(data.tickets || []);
        if (data.supportTelegramUsernames && Array.isArray(data.supportTelegramUsernames) && data.supportTelegramUsernames.length > 0) {
          setSupportUsernames(data.supportTelegramUsernames);
          setSupportUsername(data.supportTelegramUsernames[0]);
        } else if (data.supportTelegramUsername) {
          setSupportUsername(data.supportTelegramUsername);
          setSupportUsernames([data.supportTelegramUsername]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTickets();
      setActiveTab("list");
      setSelectedTicket(null);
    }
  }, [isOpen, telegramId]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      alert("Lütfen konu ve mesaj alanlarını doldurunuz.");
      return;
    }

    setCreating(true);
    haptic.impact("medium");

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          telegramId,
          userFirstName,
          username,
          subject: subject.trim(),
          category,
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        haptic.success();
        showToast("Destek talebiniz oluşturuldu!");
        setSubject("");
        setMessage("");
        setCategory("BALANCE");
        fetchTickets();
        if (data.ticket) {
          setSelectedTicket(data.ticket);
          setActiveTab("detail");
        } else {
          setActiveTab("list");
        }
      } else {
        haptic.error();
        alert(data.error || "Talep oluşturulamadı");
      }
    } catch {
      haptic.error();
      alert("Bağlantı hatası oluştu");
    } finally {
      setCreating(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    setReplying(true);
    haptic.impact("medium");

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          ticketId: selectedTicket.id,
          telegramId,
          userFirstName,
          message: replyMessage.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        haptic.success();
        setReplyMessage("");
        setSelectedTicket(data.ticket);
        setTickets((prev) => prev.map((t) => (t.id === data.ticket.id ? data.ticket : t)));
        showToast("Yanıtınız iletildi!");
      } else {
        haptic.error();
        alert(data.error || "Yanıt gönderilemedi");
      }
    } catch {
      haptic.error();
      alert("Bağlantı hatası");
    } finally {
      setReplying(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    if (!confirm("Bu destek talebini kapatmak istediğinize emin misiniz?")) return;

    haptic.impact("light");
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close",
          ticketId: selectedTicket.id,
          telegramId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        haptic.success();
        setSelectedTicket(data.ticket);
        setTickets((prev) => prev.map((t) => (t.id === data.ticket.id ? data.ticket : t)));
        showToast("Talep kapatıldı.");
      }
    } catch {
      haptic.error();
    }
  };

  const cleanAdminUser = supportUsername.replace(/^@/, "");

  const getStatusBadge = (status: string) => {
    if (status === "ANSWERED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
          <Sparkles className="w-3 h-3" />
          <span>CEVAPLANDI</span>
        </span>
      );
    }
    if (status === "OPEN") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
          <Clock className="w-3 h-3" />
          <span>BEKLİYOR</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-white/5">
        <CheckCircle className="w-3 h-3" />
        <span>KAPATILDI</span>
      </span>
    );
  };

  const getCategoryLabel = (cat: TicketCategory) => {
    switch (cat) {
      case "BALANCE":
        return "💳 Bakiye & Ödeme";
      case "SMS_NUMBER":
        return "📱 Numara & SMS Onayı";
      case "GENERAL":
        return "⚙️ Sistem & Hesap";
      default:
        return "📌 Diğer";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0d0f17] border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Glow ambient header light */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-16 bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-purple-500/20 blur-2xl pointer-events-none" />

        {/* Modal Top Bar */}
        <div className="relative flex items-center justify-between p-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 text-emerald-400 border border-emerald-500/30">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Destek & Yardım Merkezi</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  7/24
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">Canlı Telegram yöneticisi ve destek talepleri</p>
            </div>
          </div>

          <button
            onClick={() => {
              haptic.impact("light");
              onClose();
            }}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast */}
        {toastMsg && (
          <div className="px-4 py-2 bg-emerald-950/90 border-b border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Direct Telegram Admin Contact Box */}
        <div className="p-3.5 bg-gradient-to-r from-blue-950/40 via-zinc-900/60 to-purple-950/40 border-b border-white/[0.06] shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span>Birebir Hızlı İletişim ({supportUsernames.length} Yetkili)</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {supportUsernames.map((u) => {
              const clean = u.replace(/^@/, "").trim();
              if (!clean) return null;
              return (
                <a
                  key={clean}
                  href={`https://t.me/${clean}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => haptic.impact("medium")}
                  className="px-3 py-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/25 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>@{clean}</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
              );
            })}
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-1 p-2 bg-zinc-900/50 border-b border-white/[0.06] text-xs font-semibold shrink-0">
          <button
            onClick={() => {
              haptic.selection();
              setActiveTab("list");
              setSelectedTicket(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 ${
              activeTab === "list"
                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Taleplerim ({tickets.length})</span>
          </button>

          <button
            onClick={() => {
              haptic.selection();
              setActiveTab("create");
              setSelectedTicket(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 ${
              activeTab === "create"
                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yeni Talep Aç</span>
          </button>
        </div>

        {/* Modal Body / Dynamic View */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* VIEW 1: TICKETS LIST */}
          {activeTab === "list" && (
            <div className="space-y-2.5">
              {loading && tickets.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  <span className="text-xs">Talepler yükleniyor...</span>
                </div>
              ) : tickets.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-3xl bg-zinc-800/80 border border-white/5 flex items-center justify-center text-zinc-500">
                    <LifeBuoy className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Henüz Destek Talebiniz Yok</h4>
                    <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                      Bir sorunla mı karşılaştınız? Yukarıdaki butondan yeni bir talep oluşturabilirsiniz.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      haptic.selection();
                      setActiveTab("create");
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                  >
                    + İlk Destek Talebini Aç
                  </button>
                </div>
              ) : (
                tickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      haptic.selection();
                      setSelectedTicket(t);
                      setActiveTab("detail");
                    }}
                    className="p-3.5 rounded-2xl bg-zinc-900/80 border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer space-y-2 active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-zinc-400 font-bold">
                        #{t.id}
                      </span>
                      {getStatusBadge(t.status)}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{t.subject}</h4>
                      <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                        {t.messages[t.messages.length - 1]?.text || "Mesaj yok"}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] text-[10px] text-zinc-500">
                      <span>{getCategoryLabel(t.category)}</span>
                      <span>
                        {new Date(t.updatedAt).toLocaleDateString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* VIEW 2: CREATE TICKET */}
          {activeTab === "create" && (
            <form onSubmit={handleCreateTicket} className="space-y-3.5 animate-in fade-in">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Kategori</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: "BALANCE", label: "💳 Bakiye & Ödeme" },
                      { id: "SMS_NUMBER", label: "📱 Numara & SMS" },
                      { id: "GENERAL", label: "⚙️ Sistem & Hata" },
                      { id: "OTHER", label: "📌 Diğer" },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        haptic.selection();
                        setCategory(cat.id);
                      }}
                      className={`p-2 rounded-xl border text-xs font-semibold text-left transition-all ${
                        category === cat.id
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                          : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Konu Başlığı</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Örn: WhatsApp onay kodu ulaşmadı / Bakiye yükleme hk."
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Detaylı Açıklama</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Yaşadığınız sorunu, sipariş numaranızı veya talebinizi detaylıca açıklayınız..."
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-lg shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Talep Gönderiliyor...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Talebi Yöneticilere İlet</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* VIEW 3: TICKET DETAIL & CHAT */}
          {activeTab === "detail" && selectedTicket && (
            <div className="space-y-3 animate-in fade-in flex flex-col h-full">
              {/* Ticket Top Info */}
              <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5 space-y-1.5 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 font-bold">
                    <button
                      onClick={() => setActiveTab("list")}
                      className="text-emerald-400 hover:underline mr-1"
                    >
                      ← Geri
                    </button>
                    <span>#{selectedTicket.id}</span>
                  </div>
                  {getStatusBadge(selectedTicket.status)}
                </div>

                <h3 className="text-sm font-bold text-white">{selectedTicket.subject}</h3>
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>{getCategoryLabel(selectedTicket.category)}</span>
                  {selectedTicket.status !== "CLOSED" && (
                    <button
                      onClick={handleCloseTicket}
                      className="text-rose-400 hover:underline flex items-center gap-0.5"
                    >
                      <XCircle className="w-3 h-3" />
                      <span>Talebi Kapat</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Messages */}
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {selectedTicket.messages.map((m) => {
                  const isAdmin = m.sender === "admin";
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isAdmin ? "items-start" : "items-end"}`}
                    >
                      <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1 px-1">
                        {isAdmin && <ShieldCheck className="w-3 h-3 text-purple-400" />}
                        <span className="font-semibold text-zinc-300">
                          {isAdmin ? "AzFur Yönetici" : m.senderName || "Siz"}
                        </span>
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
                            ? "bg-purple-950/40 border border-purple-500/30 text-purple-100 rounded-tl-sm shadow-md"
                            : "bg-emerald-600 text-black font-medium rounded-tr-sm shadow-md"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              {selectedTicket.status !== "CLOSED" ? (
                <div className="pt-2 border-t border-white/[0.08] flex items-center gap-2 shrink-0">
                  <input
                    type="text"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    placeholder="Bir yanıt yazın..."
                    className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={replying || !replyMessage.trim()}
                    className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold active:scale-95 transition-all disabled:opacity-40"
                  >
                    {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-zinc-900 border border-white/5 text-center text-xs text-zinc-500">
                  Bu destek talebi kapatılmıştır. Yeni bir konu için lütfen yeni talep açınız.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

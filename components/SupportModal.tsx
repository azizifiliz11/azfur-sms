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
import { appAlert, appConfirm } from "@/lib/app-dialog";

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
  const [supportUsername, setSupportUsername] = useState<string>("");
  const [supportUsernames, setSupportUsernames] = useState<string[]>([]);

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
        if (data.supportTelegramUsernames && Array.isArray(data.supportTelegramUsernames)) {
          setSupportUsernames(data.supportTelegramUsernames);
          setSupportUsername(data.supportTelegramUsernames[0] || "");
        } else if (data.supportTelegramUsername) {
          setSupportUsername(data.supportTelegramUsername);
          setSupportUsernames([data.supportTelegramUsername]);
        } else {
          setSupportUsernames([]);
          setSupportUsername("");
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
      appAlert("Lütfen konu ve mesaj alanlarını doldurunuz.");
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
        appAlert(data.error || "Talep oluşturulamadı");
      }
    } catch {
      haptic.error();
      appAlert("Bağlantı hatası oluştu");
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
        appAlert(data.error || "Yanıt gönderilemedi");
      }
    } catch {
      haptic.error();
      appAlert("Bağlantı hatası");
    } finally {
      setReplying(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    if (!await appConfirm("Bu destek talebini kapatmak istediğinize emin misiniz?")) return;

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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand/20 text-brand border border-brand/40 animate-pulse">
          <Sparkles className="w-3 h-3" />
          <span>CEVAPLANDI</span>
        </span>
      );
    }
    if (status === "OPEN") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
          <Clock className="w-3 h-3" />
          <span>BEKLİYOR</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
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
      <div className="relative w-full max-w-lg bg-background ring-1 ring-foreground/10 rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)] overflow-hidden">
        {/* Glow ambient header light */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-16 bg-gradient-to-r from-brand/20 via-foreground/10 to-foreground/10 blur-2xl pointer-events-none" />

        {/* Modal Top Bar */}
        <div className="relative flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-gradient-to-br from-brand/20 to-foreground/10 text-brand border border-brand/30">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <span>Destek & Yardım Merkezi</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-foreground/10 text-foreground border border-foreground/15">
                  7/24
                </span>
              </h2>
              <p className="text-[11px] text-muted-foreground">Canlı Telegram yöneticisi ve destek talepleri</p>
            </div>
          </div>

          <button
            onClick={() => {
              haptic.impact("light");
              onClose();
            }}
            className="p-2 rounded-xl bg-muted/80 hover:bg-input text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast */}
        {toastMsg && (
          <div className="px-4 py-2 bg-brand/10 border-b border-brand/40 text-brand text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Direct Telegram Admin Contact Box */}
        <div className="p-3.5 bg-gradient-to-r from-foreground/5 via-card/60 to-foreground/5 border-b border-border shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-foreground/90 tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-foreground/90" />
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
                  className="px-3 py-1.5 rounded-xl bg-foreground/45 hover:bg-foreground/60 text-foreground font-semibold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5"
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
        <div className="flex items-center gap-1 p-2 bg-card/50 border-b border-border text-xs font-medium shrink-0">
          <button
            onClick={() => {
              haptic.selection();
              setActiveTab("list");
              setSelectedTicket(null);
            }}
            className={`flex-1 py-2 px-3 rounded-full transition-all text-center flex items-center justify-center gap-1.5 ${
              activeTab === "list"
                ? "bg-foreground text-background shadow-md "
                : "text-muted-foreground hover:text-foreground"
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
            className={`flex-1 py-2 px-3 rounded-full transition-all text-center flex items-center justify-center gap-1.5 ${
              activeTab === "create"
                ? "bg-foreground text-background shadow-md "
                : "text-muted-foreground hover:text-foreground"
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
                <div className="py-12 text-center text-muted-foreground/80 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-brand" />
                  <span className="text-xs">Talepler yükleniyor...</span>
                </div>
              ) : tickets.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-3xl bg-muted/80 border border-border flex items-center justify-center text-muted-foreground/80">
                    <LifeBuoy className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Henüz Destek Talebiniz Yok</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                      Bir sorunla mı karşılaştınız? Yukarıdaki butondan yeni bir talep oluşturabilirsiniz.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      haptic.selection();
                      setActiveTab("create");
                    }}
                    className="px-4 py-2 rounded-xl bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-md active:scale-95 transition-all"
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
                    className="p-3.5 rounded-2xl bg-card/80 border border-border hover:border-brand/30 transition-all cursor-pointer space-y-2 active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                        #{t.id}
                      </span>
                      {getStatusBadge(t.status)}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-foreground truncate">{t.subject}</h4>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {t.messages[t.messages.length - 1]?.text || "Mesaj yok"}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border text-[10px] text-muted-foreground/80">
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
                <label className="text-xs font-medium text-foreground/80">Kategori</label>
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
                      className={`p-2 rounded-xl border text-xs font-medium text-left transition-all ${
                        category === cat.id
                          ? "bg-brand/20 border-brand/50 text-brand"
                          : "bg-card border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground/80">Konu Başlığı</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Örn: WhatsApp onay kodu ulaşmadı / Bakiye yükleme hk."
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-brand"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground/80">Detaylı Açıklama</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Yaşadığınız sorunu, sipariş numaranızı veya talebinizi detaylıca açıklayınız..."
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-brand resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-3 rounded-full bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
              <div className="p-3 rounded-2xl bg-card border border-border space-y-1.5 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground font-semibold">
                    <button
                      onClick={() => setActiveTab("list")}
                      className="text-brand hover:underline mr-1"
                    >
                      ← Geri
                    </button>
                    <span>#{selectedTicket.id}</span>
                  </div>
                  {getStatusBadge(selectedTicket.status)}
                </div>

                <h3 className="text-sm font-semibold text-foreground">{selectedTicket.subject}</h3>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground/80">
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
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1 px-1">
                        {isAdmin && <ShieldCheck className="w-3 h-3 text-foreground/90" />}
                        <span className="font-medium text-foreground/80">
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
                            ? "bg-foreground/5 border border-foreground/15 text-foreground rounded-tl-sm shadow-md"
                            : "bg-foreground text-background font-medium rounded-tr-sm shadow-md"
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
                <div className="pt-2 border-t border-border flex items-center gap-2 shrink-0">
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
                    className="flex-1 bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-brand"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={replying || !replyMessage.trim()}
                    className="p-2.5 rounded-xl bg-foreground hover:bg-foreground/85 text-background font-semibold active:scale-95 transition-all disabled:opacity-40"
                  >
                    {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-card border border-border text-center text-xs text-muted-foreground/80">
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

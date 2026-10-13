import { NextRequest } from "next/server";
import { db, getSqlClient } from "./db";
import { getVerifiedTelegramUser } from "./request-auth";

/**
 * Yönetici işlem kaydı (admin_audit). Sistem loglarından AYRIDIR: silme API'si yoktur, yalnızca eklenir.
 * Kim (imzalı Telegram kimliği veya PIN), ne zaman, hangi alanda, ne yaptı ve hangi kullanıcıyı etkiledi.
 */
export interface AdminAuditEntry {
  id: string;
  at: string;
  actorId: number | null;
  actorLabel: string;
  area: string;
  action: string;
  targetId: number | null;
  details: string;
}

const memoryAudit: AdminAuditEntry[] = [];
let tableReady: Promise<void> | null = null;

function ensureTable(sql: NonNullable<ReturnType<typeof getSqlClient>>): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS admin_audit (
          id BIGSERIAL PRIMARY KEY,
          at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          actor_id BIGINT,
          actor_label TEXT,
          area TEXT NOT NULL,
          action TEXT NOT NULL,
          target_id BIGINT,
          details TEXT
        )
      `;
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

/** Kayda asla girmemesi gereken alanlar */
const SECRET_KEYS = new Set([
  "initData", "pin", "adminSecurityPin", "heroSmsApiKey", "transferKey", "key",
  "apironeTransferKey", "oxapayApiKey", "cryptoBotToken", "password", "token",
]);

function sanitize(value: any, depth = 0): any {
  if (depth > 4 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEYS.has(k) ? (v ? "[gizli]" : v) : sanitize(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 300) return value.slice(0, 300) + "…";
  return value;
}

export function getAdminActor(req: Request): { id: number | null; label: string } {
  const verified = getVerifiedTelegramUser(req);
  if (verified) {
    const u = db.getUser(verified.id);
    const name = verified.username ? `@${verified.username}` : u?.username ? `@${u.username}` : verified.first_name || "Yönetici";
    return { id: verified.id, label: `${name} (${verified.id})` };
  }
  return { id: null, label: "PIN ile giriş" };
}

export async function logAdminAction(
  req: Request,
  entry: { area: string; action: string; targetId?: number | null; details: string }
): Promise<void> {
  const actor = getAdminActor(req);
  const targetId = entry.targetId && Number.isFinite(Number(entry.targetId)) ? Number(entry.targetId) : null;
  const details = entry.details.slice(0, 2000);
  const sql = getSqlClient();
  if (!sql) {
    memoryAudit.unshift({
      id: String(Date.now()), at: new Date().toISOString(), actorId: actor.id, actorLabel: actor.label,
      area: entry.area, action: entry.action, targetId, details,
    });
    memoryAudit.length = Math.min(memoryAudit.length, 500);
    return;
  }
  try {
    await ensureTable(sql);
    await sql`
      INSERT INTO admin_audit (actor_id, actor_label, area, action, target_id, details)
      VALUES (${actor.id}, ${actor.label}, ${entry.area}, ${entry.action}, ${targetId}, ${details})
    `;
  } catch (err) {
    console.error("[AdminAudit] Kayıt yazılamadı:", err);
  }
}

export async function listAdminAudit(opts: { limit?: number; targetId?: number; area?: string } = {}): Promise<AdminAuditEntry[]> {
  const limit = Math.min(Math.max(opts.limit || 100, 1), 500);
  const sql = getSqlClient();
  if (!sql) {
    return memoryAudit
      .filter((e) => (!opts.targetId || e.targetId === opts.targetId) && (!opts.area || e.area === opts.area))
      .slice(0, limit);
  }
  try {
    await ensureTable(sql);
    const rows = (opts.targetId
      ? await sql`SELECT * FROM admin_audit WHERE target_id = ${opts.targetId} ORDER BY at DESC LIMIT ${limit}`
      : opts.area
      ? await sql`SELECT * FROM admin_audit WHERE area = ${opts.area} ORDER BY at DESC LIMIT ${limit}`
      : await sql`SELECT * FROM admin_audit ORDER BY at DESC LIMIT ${limit}`) as any[];
    return rows.map((r) => ({
      id: String(r.id),
      at: new Date(r.at).toISOString(),
      actorId: r.actor_id !== null ? Number(r.actor_id) : null,
      actorLabel: r.actor_label || "",
      area: r.area,
      action: r.action,
      targetId: r.target_id !== null ? Number(r.target_id) : null,
      details: r.details || "",
    }));
  } catch (err) {
    console.error("[AdminAudit] Okunamadı:", err);
    return [];
  }
}

const AREA_LABELS: Record<string, string> = {
  users: "Kullanıcı", deposits: "Ödeme talebi", settings: "Ayarlar", coupons: "Kupon", broadcast: "Duyuru",
  backups: "Yedekleme", tickets: "Destek", orders: "Sipariş", logs: "Loglar", overview: "Genel",
};

/**
 * Admin rota işleyicisini sarar: başarılı (2xx ve success !== false) her işlem admin_audit'e yazılır.
 * Gövdedeki gizli alanlar kayda girmez. `onlyActions` verilirse yalnızca bu action'lar kaydedilir.
 */
export function withAdminAudit(
  area: string,
  handler: (req: NextRequest) => Promise<Response>,
  opts: { onlyActions?: string[] } = {}
) {
  return async (req: NextRequest): Promise<Response> => {
    let body: any = null;
    try {
      if (req.method !== "GET") body = await req.clone().json();
    } catch {}
    const res = await handler(req);
    try {
      if (!res.ok) return res;
      const data = await res.clone().json().catch(() => null);
      if (data && data.success === false) return res;
      const url = new URL(req.url);
      const action = String(body?.action || url.searchParams.get("action") || req.method);
      if (opts.onlyActions && !opts.onlyActions.includes(action)) return res;
      const targetId = body?.telegramId ?? body?.targetTelegramId ?? body?.userId ?? null;
      const summary = sanitize({ ...(body || {}), ...(req.method === "GET" ? Object.fromEntries(url.searchParams) : {}) });
      delete (summary as any).action;
      const message = data?.message ? ` — ${String(data.message).slice(0, 200)}` : "";
      await logAdminAction(req, {
        area,
        action,
        targetId,
        details: `${AREA_LABELS[area] || area}: ${action}${message} ${JSON.stringify(summary)}`.trim(),
      });
    } catch (err) {
      console.error("[AdminAudit] Sarmalayıcı hatası:", err);
    }
    return res;
  };
}

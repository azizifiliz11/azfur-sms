import { NextResponse } from "next/server";
import { CONFIG } from "./config";
import { verifyTelegramInitData, VerifiedTelegramUser } from "./telegram-auth";

export const INIT_DATA_HEADER = "x-telegram-init-data";

/** İstekten Telegram initData'sını alır: başlık, gövde veya (indirme bağlantıları için) sorgu parametresi. */
export function getRequestInitData(req: Request, body?: any): string {
  const header = req.headers.get(INIT_DATA_HEADER);
  if (header) return header;
  if (body && typeof body.initData === "string" && body.initData) return body.initData;
  try {
    return new URL(req.url).searchParams.get("initData") || "";
  } catch {
    return "";
  }
}

/** İmzası geçerli Telegram kullanıcısını döndürür; yoksa null. */
export function getVerifiedTelegramUser(req: Request, body?: any): VerifiedTelegramUser | null {
  return verifyTelegramInitData(getRequestInitData(req, body), CONFIG.TELEGRAM_BOT_TOKEN);
}

type AuthResult = { ok: true; user: VerifiedTelegramUser; id: number } | { ok: false; response: NextResponse };

/**
 * Kullanıcı uç noktaları için kimlik doğrulama. Kullanıcı istemcinin gönderdiği telegramId ile değil,
 * Telegram'ın imzaladığı initData ile belirlenir. İstek ayrıca bir telegramId taşıyorsa imzalı kimlikle
 * eşleşmek zorundadır (başkası adına işlem yapılamaz).
 */
export function requireTelegramUser(req: Request, body?: any, claimedId?: unknown): AuthResult {
  const user = getVerifiedTelegramUser(req, body);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Oturum doğrulanamadı. Lütfen Mini App'i Telegram üzerinden yeniden açın." },
        { status: 401 }
      ),
    };
  }
  if (claimedId !== undefined && claimedId !== null && claimedId !== "" && Number(claimedId) !== user.id) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Bu işlem için yetkiniz yok." }, { status: 403 }),
    };
  }
  return { ok: true, user, id: user.id };
}

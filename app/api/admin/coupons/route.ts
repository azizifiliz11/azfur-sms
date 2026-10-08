import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthorizedAdmin } from "@/lib/auth-check";
import { Coupon, CouponType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorizedAdmin(req)) {
      return NextResponse.json(
        { success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu veya yetkisi gereklidir." },
        { status: 403 }
      );
    }

    await db.syncFromCloud();
    const coupons = db.getCoupons();

    return NextResponse.json({
      success: true,
      coupons,
    });
  } catch (err: any) {
    console.error("Admin get coupons error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorizedAdmin(req)) {
      return NextResponse.json(
        { success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu veya yetkisi gereklidir." },
        { status: 403 }
      );
    }

    await db.syncFromCloud();
    const body = await req.json();
    const { action } = body;

    // 1. Yeni Kupon Oluştur
    if (action === "create") {
      const code = (body.code || "").trim().toUpperCase();
      const type = (body.type || "BALANCE") as CouponType;
      const value = parseFloat(body.value);
      const description = (body.description || "").trim();
      const maxUses = parseInt(body.maxUses) || 0;
      const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : undefined;
      const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

      if (!code || code.length < 3) {
        return NextResponse.json(
          { success: false, error: "Kupon kodu en az 3 karakter olmalıdır." },
          { status: 400 }
        );
      }

      if (isNaN(value) || value <= 0) {
        return NextResponse.json(
          { success: false, error: "Lütfen geçerli bir indirim / bakiye değeri giriniz." },
          { status: 400 }
        );
      }

      if (type === "DISCOUNT_PERCENT" && (value <= 0 || value > 100)) {
        return NextResponse.json(
          { success: false, error: "Yüzde indirim 1 ile 100 arasında olmalıdır." },
          { status: 400 }
        );
      }

      const existing = db.getCoupon(code);
      if (existing) {
        return NextResponse.json(
          { success: false, error: `'${code}' kodlu bir kupon zaten mevcut.` },
          { status: 400 }
        );
      }

      const newCoupon: Coupon = {
        id: `cpn_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        code,
        type,
        value,
        description,
        maxUses,
        usedCount: 0,
        usedByUserIds: [],
        isActive,
        expiresAt,
        createdAt: new Date().toISOString(),
      };

      await db.saveCoupon(newCoupon);

      return NextResponse.json({
        success: true,
        message: `'${code}' kuponu başarıyla oluşturuldu.`,
        coupon: newCoupon,
      });
    }

    // 2. Kupon Durumunu Değiştir (Aktif / Pasif)
    if (action === "toggle_active") {
      const { id } = body;
      const coupons = db.getCoupons();
      const coupon = coupons.find((c) => c.id === id);
      if (!coupon) {
        return NextResponse.json({ success: false, error: "Kupon bulunamadı." }, { status: 404 });
      }

      coupon.isActive = !coupon.isActive;
      await db.saveCoupon(coupon);

      return NextResponse.json({
        success: true,
        message: `'${coupon.code}' kuponu ${coupon.isActive ? "aktif" : "pasif"} duruma getirildi.`,
        coupon,
      });
    }

    // 3. Kuponu Sil
    if (action === "delete") {
      const { id } = body;
      const ok = await db.deleteCoupon(id);
      if (!ok) {
        return NextResponse.json({ success: false, error: "Kupon bulunamadı veya silinemedi." }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: "Kupon başarıyla silindi.",
      });
    }

    return NextResponse.json({ success: false, error: "Geçersiz işlem" }, { status: 400 });
  } catch (err: any) {
    console.error("Admin coupon POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

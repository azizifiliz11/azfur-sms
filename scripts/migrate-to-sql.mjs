import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

const dbUrl =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_F3ZvuyiU5abt@ep-dry-feather-bacqjppv-pooler.c-8.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

console.log("Connecting to Neon PostgreSQL:", dbUrl.split("@")[1]);
const sql = neon(dbUrl);

async function initSchema() {
  console.log("Creating PostgreSQL tables if not exist...");

  await sql`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INT PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id BIGINT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      balance NUMERIC(14, 4) DEFAULT 0,
      spent NUMERIC(14, 4) DEFAULT 0,
      role TEXT DEFAULT 'user',
      is_banned BOOLEAN DEFAULT false,
      is_vip BOOLEAN DEFAULT false,
      vip_since TIMESTAMPTZ,
      vip_expires_at TIMESTAMPTZ,
      vip_discount_percent INT,
      vip_note TEXT,
      active_discount JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_active_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS activations (
      id TEXT PRIMARY KEY,
      telegram_id BIGINT NOT NULL,
      service_code TEXT NOT NULL,
      service_name TEXT,
      country_id INT NOT NULL,
      country_name TEXT,
      country_flag TEXT,
      phone_number TEXT,
      original_cost NUMERIC(12, 4) DEFAULT 0,
      charged_price NUMERIC(12, 4) DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'WAIT_CODE',
      sms_code TEXT,
      sms_text TEXT,
      created_at BIGINT,
      expires_at BIGINT,
      notified_bot BOOLEAN DEFAULT false
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS deposits (
      id TEXT PRIMARY KEY,
      telegram_id BIGINT NOT NULL,
      amount NUMERIC(14, 4) NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      receipt_url TEXT,
      tx_id TEXT,
      invoice_id TEXT,
      currency TEXT,
      crypto_amount NUMERIC(18, 8),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      approved_at TIMESTAMPTZ
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      telegram_id BIGINT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      messages JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      value NUMERIC(12, 4) NOT NULL,
      usage_limit INT DEFAULT 1,
      used_count INT DEFAULT 0,
      used_by JSONB DEFAULT '[]'::jsonb,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      category TEXT NOT NULL,
      level TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      metadata JSONB
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      note TEXT,
      data JSONB NOT NULL
    );
  `;

  console.log("All PostgreSQL tables verified successfully!");
}

async function migrateDataFromJson() {
  const jsonPath = path.resolve(process.cwd(), "data/db.json");
  if (!fs.existsSync(jsonPath)) {
    console.log("data/db.json not found, skipping initial import.");
    return;
  }

  const raw = fs.readFileSync(jsonPath, "utf8");
  const data = JSON.parse(raw);

  // 1. Settings
  if (data.settings) {
    const existing = await sql`SELECT id FROM system_settings WHERE id = 1`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO system_settings (id, data, updated_at)
        VALUES (1, ${JSON.stringify(data.settings)}, NOW())
      `;
      console.log("Migrated system_settings.");
    } else {
      await sql`
        UPDATE system_settings
        SET data = ${JSON.stringify(data.settings)}, updated_at = NOW()
        WHERE id = 1
      `;
      console.log("Updated system_settings in PostgreSQL.");
    }
  }

  // 2. Users
  if (data.users && typeof data.users === "object") {
    let uCount = 0;
    for (const [tgIdStr, u] of Object.entries(data.users)) {
      const tgId = BigInt(tgIdStr);
      await sql`
        INSERT INTO users (
          telegram_id, username, first_name, last_name, balance, spent,
          role, is_banned, is_vip, vip_since, vip_expires_at, vip_discount_percent,
          vip_note, active_discount, created_at, last_active_at
        )
        VALUES (
          ${tgId},
          ${u.username || ""},
          ${u.firstName || ""},
          ${u.lastName || ""},
          ${Number(u.balance) || 0},
          ${Number(u.spent) || 0},
          ${u.role || "user"},
          ${Boolean(u.isBanned)},
          ${Boolean(u.isVip)},
          ${u.vipSince ? new Date(u.vipSince) : null},
          ${u.vipExpiresAt ? new Date(u.vipExpiresAt) : null},
          ${u.vipDiscountPercent || null},
          ${u.vipNote || null},
          ${u.activeDiscount ? JSON.stringify(u.activeDiscount) : null},
          ${u.createdAt ? new Date(u.createdAt) : new Date()},
          ${u.lastActiveAt ? new Date(u.lastActiveAt) : new Date()}
        )
        ON CONFLICT (telegram_id) DO UPDATE SET
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          balance = EXCLUDED.balance,
          spent = EXCLUDED.spent,
          role = EXCLUDED.role,
          is_banned = EXCLUDED.is_banned,
          is_vip = EXCLUDED.is_vip,
          last_active_at = EXCLUDED.last_active_at;
      `;
      uCount++;
    }
    console.log(`Migrated ${uCount} users to PostgreSQL.`);
  }

  // 3. Activations
  if (data.activations && typeof data.activations === "object") {
    let aCount = 0;
    for (const [id, a] of Object.entries(data.activations)) {
      await sql`
        INSERT INTO activations (
          id, telegram_id, service_code, service_name, country_id,
          country_name, country_flag, phone_number, original_cost, charged_price,
          status, sms_code, sms_text, created_at, expires_at, notified_bot
        )
        VALUES (
          ${id},
          ${BigInt(a.telegramId)},
          ${a.serviceCode || ""},
          ${a.serviceName || ""},
          ${Number(a.countryId) || 0},
          ${a.countryName || ""},
          ${a.countryFlag || ""},
          ${a.phoneNumber || ""},
          ${Number(a.originalCost) || 0},
          ${Number(a.chargedPrice) || 0},
          ${a.status || "WAIT_CODE"},
          ${a.smsCode || null},
          ${a.smsText || null},
          ${a.createdAt || Date.now()},
          ${a.expiresAt || Date.now() + 15 * 60 * 1000},
          ${Boolean(a.notifiedBot)}
        )
        ON CONFLICT (id) DO NOTHING;
      `;
      aCount++;
    }
    if (aCount > 0) console.log(`Migrated ${aCount} activations to PostgreSQL.`);
  }

  // 4. Deposits
  if (Array.isArray(data.deposits)) {
    let dCount = 0;
    for (const d of data.deposits) {
      await sql`
        INSERT INTO deposits (
          id, telegram_id, amount, method, status, receipt_url,
          tx_id, invoice_id, currency, crypto_amount, created_at, approved_at
        )
        VALUES (
          ${d.id},
          ${BigInt(d.telegramId)},
          ${Number(d.amount) || 0},
          ${d.method || "BANK"},
          ${d.status || "PENDING"},
          ${d.receiptUrl || null},
          ${d.txId || null},
          ${d.invoiceId || null},
          ${d.currency || "TRY"},
          ${d.cryptoAmount ? Number(d.cryptoAmount) : null},
          ${d.createdAt ? new Date(d.createdAt) : new Date()},
          ${d.approvedAt ? new Date(d.approvedAt) : null}
        )
        ON CONFLICT (id) DO NOTHING;
      `;
      dCount++;
    }
    if (dCount > 0) console.log(`Migrated ${dCount} deposits to PostgreSQL.`);
  }

  // 5. Coupons
  if (data.coupons && typeof data.coupons === "object") {
    let cCount = 0;
    for (const [code, c] of Object.entries(data.coupons)) {
      await sql`
        INSERT INTO coupons (
          code, type, value, usage_limit, used_count, used_by, expires_at, created_at
        )
        VALUES (
          ${code},
          ${c.type || "BALANCE"},
          ${Number(c.value) || 0},
          ${Number(c.usageLimit) || 1},
          ${Number(c.usedCount) || 0},
          ${JSON.stringify(c.usedBy || [])},
          ${c.expiresAt ? new Date(c.expiresAt) : null},
          ${c.createdAt ? new Date(c.createdAt) : new Date()}
        )
        ON CONFLICT (code) DO NOTHING;
      `;
      cCount++;
    }
    if (cCount > 0) console.log(`Migrated ${cCount} coupons to PostgreSQL.`);
  }
}

async function verify() {
  const usersCount = await sql`SELECT count(*) FROM users`;
  const settingsRes = await sql`SELECT data FROM system_settings WHERE id = 1`;
  console.log("Verification:");
  console.log("Total users in PostgreSQL:", usersCount[0].count);
  console.log("Settings present in PostgreSQL:", Boolean(settingsRes[0]?.data));
}

async function run() {
  try {
    await initSchema();
    await migrateDataFromJson();
    await verify();
    console.log("Migration to Neon PostgreSQL completed successfully!");
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

run();

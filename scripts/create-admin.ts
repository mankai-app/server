import db from "#/lib/db.server";
import { user } from "#/db/schema";

const email = process.env.ADMIN_EMAIL?.trim();
const password = process.env.ADMIN_PASSWORD;
const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim();

if (!email || !email.includes("@")) {
  console.error(
    "[ERROR] ADMIN_EMAIL is missing or invalid. Set it to a valid email address.",
  );
  process.exit(1);
}

let hashed: string;

if (passwordHash) {
  try {
    await Bun.password.verify(crypto.randomUUID(), passwordHash);
  } catch {
    console.error(
      "[ERROR] ADMIN_PASSWORD_HASH is invalid. Provide a hash supported by Bun.password.verify.",
    );
    process.exit(1);
  }

  console.log(`[INFO] Using provided password hash for ${email}…`);
  hashed = passwordHash;
} else {
  if (!password || password.length < 8) {
    console.error(
      "[ERROR] Set ADMIN_PASSWORD_HASH or ADMIN_PASSWORD (min 8 characters).",
    );
    process.exit(1);
  }

  console.log(`[INFO] Hashing password for ${email}…`);
  hashed = await Bun.password.hash(password);
}

try {
  const [result] = await db
    .insert(user)
    .values({
      email,
      password: hashed,
      role: "admin",
      isActive: true,
    })
    .onConflictDoUpdate({
      target: user.email,
      set: {
        password: hashed,
        role: "admin",
        isActive: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  console.log("[SUCCESS] Admin user ready:");
  console.log(`  id:         ${result.id}`);
  console.log(`  email:      ${result.email}`);
  console.log(`  role:       ${result.role}`);
  console.log(`  is_active:  ${result.isActive}`);
  console.log(`  updated_at: ${result.updatedAt.toISOString()}`);
} catch (err) {
  console.error(`[ERROR] Failed to create admin user: ${err}`);
  process.exit(1);
}

process.exit(0);

import bcrypt from "bcryptjs";

const DEFAULT_SALT_ROUNDS = 12;

function getSaltRounds(): number {
  const raw = process.env.BCRYPT_SALT_ROUNDS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_SALT_ROUNDS;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, getSaltRounds());
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

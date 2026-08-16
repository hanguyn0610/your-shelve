import jwt, { type JwtPayload } from "jsonwebtoken";
import type { StringValue } from "ms";

export interface AccessTokenPayload {
  userId: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getExpiresIn(envVar: string, fallback: StringValue): StringValue | number {
  const raw = process.env[envVar];
  if (!raw) return fallback;
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) ? asNumber : (raw as StringValue);
}

function isAccessTokenPayload(payload: string | JwtPayload): payload is JwtPayload & AccessTokenPayload {
  return typeof payload === "object" && payload !== null && typeof payload.userId === "string";
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, requireEnv("JWT_ACCESS_SECRET"), {
    algorithm: "HS256",
    expiresIn: getExpiresIn("JWT_ACCESS_EXPIRES_IN", "15m"),
  });
}

export function signRefreshToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, requireEnv("JWT_REFRESH_SECRET"), {
    algorithm: "HS256",
    expiresIn: getExpiresIn("JWT_REFRESH_EXPIRES_IN", "7d"),
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    // algorithms is pinned explicitly so a forged token can't switch to "none" or another alg.
    const decoded = jwt.verify(token, requireEnv("JWT_ACCESS_SECRET"), { algorithms: ["HS256"] });
    return isAccessTokenPayload(decoded) ? { userId: decoded.userId } : null;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, requireEnv("JWT_REFRESH_SECRET"), { algorithms: ["HS256"] });
    return isAccessTokenPayload(decoded) ? { userId: decoded.userId } : null;
  } catch {
    return null;
  }
}

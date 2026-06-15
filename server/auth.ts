import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "fintrack-dev-secret";

export interface AuthPayload {
  sub: string;
  email: string;
  role: "admin" | "owner" | "member";
}

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function extractToken(authorization?: string): string | null {
  if (!authorization) return null;
  return authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : authorization;
}

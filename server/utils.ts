import type { ApiResponse, PublicUser, User } from "./types";

export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function fail(error: string): ApiResponse<never> {
  return { success: false, error };
}

export function publicUser(user: User): PublicUser {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

export function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type Role = "admin" | "owner" | "member";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  status: "active" | "inactive";
  createdAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "inactive";
  createdAt: string;
}

export interface AppConfig {
  appName: string;
  tagline: string;
  logoType: "icon" | "text" | "image";
  logoIcon: string;
  logoImageUrl: string;
  primaryColor: string;
  accentColor: string;
  currency: string;
  dateFormat: string;
  faviconUrl: string;
  footerText: string;
  qrisStatic?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

"use client";

import { useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  TrendingUp,
  Wallet,
  PieChart,
  BarChart3,
  DollarSign,
  Coins,
  Landmark,
  CreditCard,
  PiggyBank,
  Shield,
  Zap,
  Sparkles,
  RotateCcw,
  Save,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardBody } from "~/components/ui/card";
import { useAppConfigStore, type AppConfig } from "~/store/useAppConfigStore";
import { useAuthStore } from "~/store/useAuthStore";
import { api } from "~/lib/api";

const iconOptions = [
  TrendingUp,
  Wallet,
  PieChart,
  BarChart3,
  DollarSign,
  Coins,
  Landmark,
  CreditCard,
  PiggyBank,
  Shield,
  Zap,
  Sparkles,
];
const presets = [
  ["Indigo & Violet", "#6366f1", "#8b5cf6"],
  ["Emerald & Teal", "#10b981", "#14b8a6"],
  ["Sky & Blue", "#0ea5e9", "#3b82f6"],
  ["Rose & Pink", "#f43f5e", "#ec4899"],
  ["Amber & Orange", "#f59e0b", "#f97316"],
  ["Slate & Gray", "#64748b", "#94a3b8"],
];

export default function AppSettingsPage() {
  const { config, updateConfig, resetConfig } = useAppConfigStore();
  const token = useAuthStore((state) => state.token);
  const [draft, setDraft] = useState<AppConfig>(config);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(config), [config]);
  function update<K extends keyof AppConfig>(key: K, value: AppConfig[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  async function save() {
    let nextConfig = draft;
    if (token && token !== "dev-fallback-token") {
      try {
        nextConfig = await api.put<AppConfig>(
          "/admin/app-settings",
          token,
          draft,
        );
      } catch (error) {
        console.warn("Failed to save app settings to backend", error);
      }
    }
    updateConfig(nextConfig);
    document.documentElement.style.setProperty(
      "--primary",
      nextConfig.primaryColor,
    );
    document.documentElement.style.setProperty(
      "--color-primary",
      nextConfig.primaryColor,
    );
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }
  const SelectedIcon =
    iconOptions.find((Icon) => Icon.name === draft.logoIcon) ?? TrendingUp;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Pengaturan Aplikasi</h2>
          <p className="text-sm text-text-muted">
            Ubah nama aplikasi, logo, identitas, dan warna brand.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              resetConfig();
              setDraft(useAppConfigStore.getState().config);
            }}
            leftIcon={<RotateCcw className="h-4 w-4" />}
          >
            Reset
          </Button>
          <Button onClick={save} leftIcon={<Save className="h-4 w-4" />}>
            {saved ? "Tersimpan ✓" : "Simpan Perubahan"}
          </Button>
        </div>
      </div>
      <Tabs.Root defaultValue="identity">
        <Tabs.List className="flex overflow-x-auto border-b border-border gap-1 mb-6">
          <Tabs.Trigger
            value="identity"
            className="px-4 py-3 text-sm text-text-muted data-[state=active]:text-warning data-[state=active]:border-b-2 data-[state=active]:border-warning whitespace-nowrap"
          >
            Identitas Aplikasi
          </Tabs.Trigger>
          <Tabs.Trigger
            value="logo"
            className="px-4 py-3 text-sm text-text-muted data-[state=active]:text-warning data-[state=active]:border-b-2 data-[state=active]:border-warning whitespace-nowrap"
          >
            Logo & Icon
          </Tabs.Trigger>
          <Tabs.Trigger
            value="colors"
            className="px-4 py-3 text-sm text-text-muted data-[state=active]:text-warning data-[state=active]:border-b-2 data-[state=active]:border-warning whitespace-nowrap"
          >
            Warna
          </Tabs.Trigger>
          <Tabs.Trigger
            value="preview"
            className="px-4 py-3 text-sm text-text-muted data-[state=active]:text-warning data-[state=active]:border-b-2 data-[state=active]:border-warning whitespace-nowrap"
          >
            Preview
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="identity">
          <Card>
            <CardBody className="space-y-4 max-w-2xl">
              <Input
                label="Nama Aplikasi"
                value={draft.appName}
                onChange={(event) => update("appName", event.target.value)}
                hint="Nama ini langsung tampil di sidebar setelah disimpan."
              />
              <Input
                label="Tagline"
                value={draft.tagline}
                onChange={(event) => update("tagline", event.target.value)}
              />
              <Input
                label="Footer Text"
                value={draft.footerText}
                onChange={(event) => update("footerText", event.target.value)}
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-sm text-text-secondary">
                  Mata Uang
                  <select
                    value={draft.currency}
                    onChange={(event) => update("currency", event.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-lg bg-bg-elevated border border-border"
                  >
                    <option>IDR</option>
                    <option>USD</option>
                    <option>SGD</option>
                    <option>MYR</option>
                  </select>
                </label>
                <label className="text-sm text-text-secondary">
                  Format Tanggal
                  <select
                    value={draft.dateFormat}
                    onChange={(event) =>
                      update("dateFormat", event.target.value)
                    }
                    className="mt-1 w-full h-10 px-3 rounded-lg bg-bg-elevated border border-border"
                  >
                    <option>dd/MM/yyyy</option>
                    <option>MM/dd/yyyy</option>
                    <option>yyyy-MM-dd</option>
                  </select>
                </label>
              </div>
            </CardBody>
          </Card>
        </Tabs.Content>
        <Tabs.Content value="logo">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardBody className="space-y-5">
                <div>
                  <p className="text-sm font-semibold mb-2">Tipe Logo</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["icon", "text", "image"] as AppConfig["logoType"][]).map(
                      (type) => (
                        <button
                          key={type}
                          onClick={() => update("logoType", type)}
                          className={`p-3 rounded-lg border text-sm capitalize ${draft.logoType === type ? "border-warning bg-warning/10 text-warning" : "border-border bg-bg-elevated text-text-muted"}`}
                        >
                          {type}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                {draft.logoType === "icon" && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Pilih Icon</p>
                    <div className="grid grid-cols-6 gap-2">
                      {iconOptions.map((Icon) => (
                        <button
                          key={Icon.name}
                          onClick={() => update("logoIcon", Icon.name)}
                          className={`aspect-square rounded-lg flex items-center justify-center border ${draft.logoIcon === Icon.name ? "border-warning bg-warning/10 text-warning" : "border-border bg-bg-elevated text-text-muted"}`}
                        >
                          <Icon className="h-5 w-5" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {draft.logoType === "image" && (
                  <Input
                    label="URL Gambar Logo"
                    value={draft.logoImageUrl}
                    onChange={(event) =>
                      update("logoImageUrl", event.target.value)
                    }
                    placeholder="https://.../logo.png"
                  />
                )}
                <Input
                  label="Favicon URL"
                  value={draft.faviconUrl}
                  onChange={(event) => update("faviconUrl", event.target.value)}
                  placeholder="https://.../favicon.ico"
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm font-semibold mb-4">Live Preview</p>
                <div className="rounded-xl border border-border bg-bg-base p-5 flex items-center gap-3">
                  {draft.logoType !== "text" && (
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center overflow-hidden"
                      style={{
                        backgroundColor: `${draft.primaryColor}22`,
                        color: draft.primaryColor,
                      }}
                    >
                      {draft.logoType === "image" && draft.logoImageUrl ? (
                        <img
                          src={draft.logoImageUrl}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <SelectedIcon className="h-5 w-5" />
                      )}
                    </div>
                  )}
                  <div>
                    <p className="font-bold">
                      {draft.appName || "Nama Aplikasi"}
                    </p>
                    <p className="text-xs text-text-muted">{draft.tagline}</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </Tabs.Content>
        <Tabs.Content value="colors">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardBody className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm text-text-secondary">
                    Primary Color
                    <div className="mt-1 flex gap-2">
                      <input
                        type="color"
                        value={draft.primaryColor}
                        onChange={(event) =>
                          update("primaryColor", event.target.value)
                        }
                        className="h-10 w-12 rounded bg-transparent"
                      />
                      <input
                        value={draft.primaryColor}
                        onChange={(event) =>
                          update("primaryColor", event.target.value)
                        }
                        className="flex-1 h-10 px-3 rounded-lg bg-bg-elevated border border-border"
                      />
                    </div>
                  </label>
                  <label className="text-sm text-text-secondary">
                    Accent Color
                    <div className="mt-1 flex gap-2">
                      <input
                        type="color"
                        value={draft.accentColor}
                        onChange={(event) =>
                          update("accentColor", event.target.value)
                        }
                        className="h-10 w-12 rounded bg-transparent"
                      />
                      <input
                        value={draft.accentColor}
                        onChange={(event) =>
                          update("accentColor", event.target.value)
                        }
                        className="flex-1 h-10 px-3 rounded-lg bg-bg-elevated border border-border"
                      />
                    </div>
                  </label>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-3">Preset Warna</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {presets.map(([name, primary, accent]) => (
                      <button
                        key={name}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            primaryColor: primary,
                            accentColor: accent,
                          }))
                        }
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-bg-elevated hover:border-warning/50 text-left"
                      >
                        <span className="flex">
                          <span
                            className="h-6 w-6 rounded-full"
                            style={{ background: primary }}
                          />
                          <span
                            className="h-6 w-6 rounded-full -ml-2"
                            style={{ background: accent }}
                          />
                        </span>
                        <span className="text-sm">{name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-text-muted">
                  Warna utama diterapkan ke komponen global setelah disimpan.
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm font-semibold mb-4">Component Preview</p>
                <div className="p-5 rounded-xl bg-bg-elevated space-y-4">
                  <button
                    className="px-4 py-2 rounded-lg text-white"
                    style={{ background: draft.primaryColor }}
                  >
                    Primary Button
                  </button>
                  <span
                    className="ml-3 px-2.5 py-1 rounded-full text-xs"
                    style={{
                      color: draft.accentColor,
                      background: `${draft.accentColor}22`,
                    }}
                  >
                    Accent Badge
                  </span>
                  <div className="h-2 rounded-full bg-bg-base">
                    <div
                      className="h-full w-2/3 rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${draft.primaryColor}, ${draft.accentColor})`,
                      }}
                    />
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </Tabs.Content>
        <Tabs.Content value="preview">
          <div className="grid lg:grid-cols-[280px_1fr] gap-6">
            <div className="rounded-xl border border-border bg-bg-base p-4 min-h-[420px]">
              <div className="flex items-center gap-3 border-b border-border pb-4 mb-4">
                {draft.logoType !== "text" && (
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center"
                    style={{
                      background: `${draft.primaryColor}22`,
                      color: draft.primaryColor,
                    }}
                  >
                    <SelectedIcon className="h-5 w-5" />
                  </div>
                )}
                <span className="font-bold">{draft.appName}</span>
              </div>
              {["Dashboard", "Dompet", "Transaksi", "Anggaran"].map(
                (item, index) => (
                  <div
                    key={item}
                    className="px-3 py-2.5 rounded-lg mb-1 text-sm"
                    style={
                      index === 0
                        ? {
                            background: `${draft.primaryColor}22`,
                            color: draft.primaryColor,
                          }
                        : { color: "#94a3b8" }
                    }
                  >
                    {item}
                  </div>
                ),
              )}
            </div>
            <div className="rounded-xl border border-border bg-bg-surface p-6">
              <p className="text-sm text-text-muted">{draft.tagline}</p>
              <h3 className="text-2xl font-bold mt-2">
                Selamat datang di {draft.appName}
              </h3>
              <div className="grid sm:grid-cols-3 gap-3 mt-6">
                {["Net Worth", "Pemasukan", "Pengeluaran"].map(
                  (item, index) => (
                    <div key={item} className="rounded-xl bg-bg-elevated p-4">
                      <p className="text-xs text-text-muted">{item}</p>
                      <p
                        className="font-bold text-lg mt-2"
                        style={{
                          color: index === 0 ? draft.primaryColor : undefined,
                        }}
                      >
                        Rp25,5jt
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

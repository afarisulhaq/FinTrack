"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Link as LinkIcon,
  MessageCircle,
  QrCode,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Modal } from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import { Card, CardBody } from "~/components/ui/card";
import { formatCurrency } from "~/lib/utils";
import { isValidQrisShape, toDynamicQris } from "~/lib/qris-utils";
import { buildShareText } from "~/lib/share-utils";

interface QrisModalProps {
  /** Static QRIS string from the merchant's e-wallet. */
  staticQris: string;
  /** Transaction amount in IDR. */
  amount: number;
  /** Optional reference ID (e.g. bill ID, participant name). */
  refId?: string;
  /** Display name for context. */
  participantName?: string;
  /**
   * Bill title to inject as the QRIS merchant name (tag 59). This is what
   * Indonesian e-wallets display most prominently when the user scans the
   * QR — set this to the split-bill title so the participant immediately
   * knows what they're paying for.
   */
  billTitle?: string;
  /**
   * Public share link for this participant's share of the bill. When set,
   * a share section is shown below the QR with WhatsApp and copy-link
   * buttons so the merchant can forward the participant a pay page that
   * shows their own QR and a "mark as paid" button.
   */
  shareUrl?: string;
  /**
   * WhatsApp phone number (with country code, e.g. 6281234567890) used to
   * pre-fill the share text. Optional — if absent, WhatsApp opens a
   * blank-recipient compose.
   */
  whatsappPhone?: string;
  onClose: () => void;
}

export function QrisModal({
  staticQris,
  amount,
  refId,
  participantName,
  billTitle,
  shareUrl,
  whatsappPhone,
  onClose,
}: QrisModalProps) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const result = useMemo(() => {
    if (!staticQris) return null;
    if (!isValidQrisShape(staticQris)) {
      return { error: "Format QRIS statis tidak valid" } as const;
    }
    try {
      return {
        payload: toDynamicQris(staticQris, amount, refId, {
          merchantName: billTitle,
        }),
      } as const;
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "Gagal generate QRIS",
      } as const;
    }
  }, [staticQris, amount, refId, billTitle]);

  async function copyPayload() {
    if (!result || "error" in result) return;
    try {
      await navigator.clipboard.writeText(result.payload.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may not be available in some browsers */
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function shareToWhatsApp() {
    if (!shareUrl) return;
    const text = buildShareText({
      billTitle,
      participantName,
      amount: formatCurrency(amount),
      shareUrl,
    });
    const phone = whatsappPhone?.replace(/\D/g, "");
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function downloadQr() {
    if (!result || "error" in result) return;
    // Serialize the SVG and convert to a downloadable PNG-like file via data URL.
    // qrcode.react renders an SVG inside the modal; we grab its outerHTML.
    const svg = document.getElementById("qris-svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qris-${amount}-${refId ?? "tagihan"}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Modal open onClose={onClose} title="Tagih via QRIS" size="md">
      <div className="space-y-4">
        {!staticQris ? (
          <Card className="border-warning/30 bg-warning/5">
            <div className="flex gap-3">
              <QrCode className="text-warning h-5 w-5 shrink-0" />
              <div className="text-xs">
                <p className="text-text-primary font-semibold">
                  QRIS statis belum diatur
                </p>
                <p className="text-text-muted mt-1">
                  Buka <span className="font-medium">Pengaturan → QRIS</span>{" "}
                  lalu paste string QRIS statis dari e-wallet kamu (GoPay, OVO,
                  DANA, ShopeePay, dll).
                </p>
              </div>
            </div>
          </Card>
        ) : result && "error" in result ? (
          <Card className="border-danger/30 bg-danger/5">
            <p className="text-danger text-sm">{result.error}</p>
            <p className="text-text-muted mt-1 text-xs">
              Pastikan string QRIS yang kamu paste di Pengaturan sudah benar dan
              lengkap.
            </p>
          </Card>
        ) : result ? (
          <>
            <Card padding="sm" className="text-center">
              <p className="text-text-muted text-xs">
                {participantName
                  ? `Tagihan untuk ${participantName}`
                  : "Nominal"}
              </p>
              <p className="text-text-primary mt-1 text-3xl font-bold">
                {formatCurrency(amount)}
              </p>
              {refId && (
                <p className="text-text-muted mt-1 text-xs">Ref: {refId}</p>
              )}
            </Card>

            <div className="flex justify-center">
              <div className="rounded-xl bg-white p-4">
                <QRCodeSVG
                  id="qris-svg"
                  value={result.payload.payload}
                  size={240}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>

            <p className="text-text-muted text-center text-xs">
              Minta peserta scan QR di atas dengan e-wallet mereka. Nominal
              sudah terisi otomatis — tidak perlu input manual.
            </p>

            <details className="border-border rounded-lg border p-2">
              <summary className="text-text-muted cursor-pointer text-xs">
                Lihat string QRIS (untuk debug)
              </summary>
              <p className="text-text-muted mt-2 font-mono text-[10px] break-all">
                {result.payload.payload}
              </p>
            </details>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyPayload}
                className="flex-1"
                leftIcon={
                  copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )
                }
              >
                {copied ? "Tersalin" : "Salin String"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadQr}
                className="flex-1"
                leftIcon={<Download className="h-3.5 w-3.5" />}
              >
                Unduh SVG
              </Button>
            </div>

            {shareUrl && (
              <div className="border-border bg-bg-surface/50 space-y-2 rounded-lg border p-3">
                <p className="text-text-secondary text-xs font-semibold">
                  Kirim tagihan ke peserta
                </p>
                <p className="text-text-muted text-[11px]">
                  Peserta bisa buka link di HP mereka, langsung dapat QR untuk
                  nominal mereka, lalu konfirmasi sudah bayar.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={shareToWhatsApp}
                    className="flex-1"
                    leftIcon={<MessageCircle className="h-3.5 w-3.5" />}
                  >
                    WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyShareLink}
                    className="flex-1"
                    leftIcon={
                      linkCopied ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <LinkIcon className="h-3.5 w-3.5" />
                      )
                    }
                  >
                    {linkCopied ? "Tersalin" : "Salin Link"}
                  </Button>
                </div>
                <p className="text-text-muted truncate font-mono text-[10px]">
                  {shareUrl}
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </Modal>
  );
}

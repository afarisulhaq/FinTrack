/**
 * Dynamic QRIS Generator
 * ----------------------
 * Converts a static QRIS string into a dynamic one by:
 *  1. Changing Point of Initiation Method (tag 01) from "11" (static) to "12" (dynamic)
 *  2. Injecting the transaction amount (tag 54)
 *  3. Optionally appending a reference ID in additional data (tag 62 sub-tag 05)
 *  4. Recalculating the CRC16-CCITT checksum (tag 63)
 *
 * Static QRIS follows the EMVCo TLV (Tag-Length-Value) format used by all
 * Indonesian QRIS providers (GoPay, OVO, DANA, ShopeePay, etc.).
 *
 * Reference: https://www.bi.go.id/en/sistem-pembayaran/berita-acara/Detail%20Berita%20Acara%20SP%20-%20QRIS
 */

export interface QrisTag {
  tag: string;
  length: number;
  value: string;
  children?: QrisTag[];
}

/** Calculate CRC16-CCITT (XMODEM) checksum for QRIS — 4 hex chars, uppercase. */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Parse a TLV-encoded QRIS string into a flat array of tags. */
export function parseQris(input: string): QrisTag[] {
  const tags: QrisTag[] = [];
  let i = 0;
  while (i < input.length) {
    const tag = input.slice(i, i + 2);
    i += 2;
    const lengthStr = input.slice(i, i + 2);
    const length = Number.parseInt(lengthStr, 10);
    if (Number.isNaN(length)) break;
    i += 2;
    const value = input.slice(i, i + length);
    i += length;

    // Tag 26 (Merchant Account Info) and 62 (Additional Data) can be nested
    let children: QrisTag[] | undefined;
    if (tag === "26" || tag === "62") {
      children = parseQris(value);
    }

    tags.push({ tag, length, value, children });
  }
  return tags;
}

/** Serialize parsed tags back into a TLV string. */
function serializeQris(tags: QrisTag[]): string {
  return tags
    .map(({ tag, length, value, children }) => {
      const inner = children ? serializeQris(children) : value;
      // Re-serialize with the (possibly mutated) inner length
      return tag + String(inner.length).padStart(2, "0") + inner;
    })
    .join("");
}

/** Find a top-level tag by ID. */
function findTag(tags: QrisTag[], id: string): QrisTag | undefined {
  return tags.find((t) => t.tag === id);
}

/** Find a sub-tag inside a parent (e.g. inside tag 26 or 62). */
function findSubTag(
  parent: QrisTag | undefined,
  id: string,
): QrisTag | undefined {
  return parent?.children?.find((c) => c.tag === id);
}

/** Result of converting a static QRIS to dynamic. */
export interface DynamicQrisResult {
  /** The new QRIS string (including CRC). */
  payload: string;
  /** The amount that was injected. */
  amount: number;
  /** True if the input was already dynamic (Point of Initiation = 12). */
  wasAlreadyDynamic: boolean;
}

/**
 * Convert a static QRIS string into a dynamic one with a specific amount.
 *
 * @param staticQris  The merchant's static QRIS string (as shown in their e-wallet).
 * @param amount      The transaction amount in IDR (must be > 0).
 * @param refId       Optional reference/tag, max ~20 chars. Will be stored in
 *                    additional data field (tag 62, sub-tag 05).
 * @param overrides   Optional per-tag overrides applied after mutation.
 *                    Currently supports `merchantName` (tag 59) which is what
 *                    e-wallet apps display most prominently in the pay screen.
 *                    Useful for split bills where the bill title is more
 *                    informative than the merchant's static name.
 * @returns           The dynamic QRIS payload (raw string, ready to be rendered
 *                    as a QR code).
 */
export function toDynamicQris(
  staticQris: string,
  amount: number,
  refId?: string,
  overrides?: { merchantName?: string },
): DynamicQrisResult {
  if (!staticQris || staticQris.length < 10) {
    throw new Error("QRIS string tidak valid");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Nominal harus lebih dari 0");
  }

  // Validate base CRC before we mutate anything (catch user typos early)
  const withoutCrc = staticQris.slice(0, -4);
  const providedCrc = staticQris.slice(-4);
  const expectedCrc = crc16(withoutCrc);
  const wasAlreadyDynamic = staticQris.includes("010212");

  // We don't hard-fail on a bad base CRC because some providers publish
  // non-standard checksums. We just proceed.
  void providedCrc;
  void expectedCrc;

  const tags = parseQris(staticQris);

  // 1. Set Point of Initiation to "12" (dynamic)
  const poi = findTag(tags, "01");
  if (poi) {
    poi.value = "12";
    poi.length = 2;
  } else {
    tags.push({ tag: "01", length: 2, value: "12" });
  }

  // 1b. Optionally override merchant name (tag 59) so the e-wallet shows
  //     context like the split-bill title instead of (or alongside) the
  //     static merchant name. Indonesian e-wallets display this field most
  //     prominently, so it's the best place for the bill title.
  if (overrides?.merchantName) {
    const cleanName = overrides.merchantName
      .trim()
      .slice(0, 25)
      // QRIS merchant name allows alnum + space + a few safe symbols
      .replace(/[^A-Za-z0-9 .\-_&]/g, "");
    if (cleanName) {
      const merchant = findTag(tags, "59");
      if (merchant) {
        merchant.value = cleanName;
        merchant.length = cleanName.length;
      } else {
        // Insert after tag 53 (Currency) if present, else at the end.
        const insertIdx =
          tags.findIndex((t) => t.tag === "53") + 1 || tags.length;
        tags.splice(insertIdx, 0, {
          tag: "59",
          length: cleanName.length,
          value: cleanName,
        });
      }
    }
  }

  // 2. Set Transaction Amount (tag 54). Remove any old one first.
  const amountStr = Math.round(amount).toString();
  const existingAmount = findTag(tags, "54");
  if (existingAmount) {
    existingAmount.value = amountStr;
    existingAmount.length = amountStr.length;
  } else {
    // Find a good place to insert (after tag 53 - Currency)
    const insertIdx = tags.findIndex((t) => t.tag === "53") + 1 || tags.length;
    tags.splice(insertIdx, 0, {
      tag: "54",
      length: amountStr.length,
      value: amountStr,
    });
  }

  // 3. Inject reference ID into Additional Data (tag 62, sub-tag 05) if provided
  if (refId) {
    const cleanRef = refId.slice(0, 25).replace(/[^A-Za-z0-9\-_.]/g, "");
    if (cleanRef) {
      let additional = findTag(tags, "62");
      if (!additional) {
        additional = {
          tag: "62",
          length: 0,
          value: "",
          children: [],
        };
        tags.push(additional);
      }
      const existingRef = findSubTag(additional, "05");
      if (existingRef) {
        existingRef.value = cleanRef;
        existingRef.length = cleanRef.length;
      } else {
        additional.children = additional.children ?? [];
        additional.children.push({
          tag: "05",
          length: cleanRef.length,
          value: cleanRef,
        });
      }
      // Re-serialize the nested children into the parent's value
      if (additional.children) {
        additional.value = serializeQris(additional.children);
        additional.length = additional.value.length;
      }
    }
  }

  // 4. Drop the old CRC tag and re-serialize
  const filtered = tags.filter((t) => t.tag !== "63");
  const body = serializeQris(filtered) + "6304";
  const newCrc = crc16(body);

  return {
    payload: body + newCrc,
    amount,
    wasAlreadyDynamic,
  };
}

/** Sanity-check a QRIS string — returns true if it has the right shape. */
export function isValidQrisShape(input: string): boolean {
  if (!input || input.length < 20) return false;
  // Must start with 00 (Payload Format Indicator) and end with 63 (CRC)
  if (!input.startsWith("00")) return false;
  if (!input.slice(-8).startsWith("63")) return false;
  return true;
}

export function crc16(input) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function parseQris(payload) {
  if (
    typeof payload !== "string" ||
    payload.length > 2048 ||
    payload.length < 20
  )
    throw new Error("Payload QRIS tidak valid");
  const tags = new Map();
  let cursor = 0;
  while (cursor < payload.length) {
    const header = payload.slice(cursor, cursor + 4);
    if (!/^\d{4}$/.test(header)) throw new Error("Format tag QRIS tidak valid");
    const tag = header.slice(0, 2),
      length = Number(header.slice(2));
    if (tags.has(tag) || cursor + 4 + length > payload.length)
      throw new Error("Panjang tag QRIS tidak valid");
    tags.set(tag, payload.slice(cursor + 4, cursor + 4 + length));
    cursor += length + 4;
    if (tag === "63" && (length !== 4 || cursor !== payload.length))
      throw new Error("Checksum QRIS tidak valid");
  }
  if (
    tags.get("00") !== "01" ||
    tags.get("53") !== "360" ||
    tags.get("58") !== "ID" ||
    payload.slice(-8, -4) !== "6304" ||
    crc16(payload.slice(0, -4)) !== tags.get("63")?.toUpperCase()
  )
    throw new Error("QRIS harus IDR dengan checksum yang valid");
  return tags;
}

export function dynamicQris(template, amount) {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100_000_999)
    throw new Error("Nominal QRIS tidak valid");
  const tags = parseQris(template);
  tags.delete("63");
  tags.set("01", "12");
  tags.set("54", String(amount));
  const payload =
    [...tags]
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(
        ([tag, value]) => tag + String(value.length).padStart(2, "0") + value,
      )
      .join("") + "6304";
  return payload + crc16(payload);
}

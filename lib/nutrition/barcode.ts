export function normalizeBarcode(value: string | null | undefined) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

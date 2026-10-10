/** Firestore document ids cannot contain a slash, and "." / ".." are reserved. */
const MAX_BARCODE_LENGTH = 200;

export function normalizeBarcode(raw: string): string | null {
  const value = raw.trim();
  if (!value || value === '.' || value === '..' || value.includes('/')) return null;
  if (value.length > MAX_BARCODE_LENGTH) return null;
  return value;
}

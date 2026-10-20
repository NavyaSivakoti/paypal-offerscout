/** UUID v4 using cryptographic bytes, including previews without crypto.randomUUID. */
export function createRequestId(fill: (bytes: Uint8Array) => Uint8Array = bytes => crypto.getRandomValues(bytes)): string {
  const bytes = fill(new Uint8Array(16));
  if (bytes.length !== 16) throw new Error('Invalid random byte count.');
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

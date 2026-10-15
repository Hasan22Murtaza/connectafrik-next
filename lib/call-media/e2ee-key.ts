export function generateCallE2eeKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function readCallE2eeKey(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const value = (metadata as Record<string, unknown>).e2eeKey;
  if (typeof value !== 'string') return undefined;
  const key = value.trim();
  if (key.length < 16 || key.length > 128) return undefined;
  return key;
}

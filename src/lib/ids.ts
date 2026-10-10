let counter = 0;

/**
 * Identifiers only need to be unique on this one device, so a timestamp plus a
 * counter and some randomness is enough and avoids an extra dependency.
 */
export function createId(prefix: string): string {
  counter += 1;
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}_${counter.toString(36)}_${random}`;
}

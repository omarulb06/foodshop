import type { Product } from '@/types';

type IntakeScanHandler = (product: Product, quantity: number) => void;

let handler: IntakeScanHandler | null = null;

/** The open intake form listens, so a scan can add a line without losing what was typed. */
export function listenForIntakeScan(next: IntakeScanHandler): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

export function completeIntakeScan(product: Product, quantity: number): boolean {
  if (!handler) return false;
  handler(product, quantity);
  return true;
}

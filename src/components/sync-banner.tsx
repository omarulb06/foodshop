import { AppButton } from '@/components/app-button';
import { Notice } from '@/components/notice';
import { copy } from '@/lib/copy';
import { useInventory } from '@/state/inventory-context';

/** Shown while the device is local-only, offline, syncing, or hit a Firestore error. */
export function SyncBanner() {
  const { sync, retrySync } = useInventory();
  if (sync.mode === 'synced' || !sync.message) return null;

  const tone = sync.mode === 'error' ? 'danger' : sync.mode === 'offline' ? 'warning' : 'info';
  const showRetry = sync.mode === 'error' || sync.mode === 'offline';

  return (
    <Notice tone={tone} message={sync.message}>
      {showRetry ? <AppButton label={copy.syncRetry} onPress={retrySync} size="medium" /> : null}
    </Notice>
  );
}

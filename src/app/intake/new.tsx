import { useRouter } from 'expo-router';
import { useState } from 'react';

import { IntakeForm } from '@/components/intake-form';
import { Screen } from '@/components/screen';
import { copy } from '@/lib/copy';
import { useInventory } from '@/state/inventory-context';

export default function NewIntakeScreen() {
  const router = useRouter();
  const { products, saveDraftIntake } = useInventory();
  const [saving, setSaving] = useState(false);

  return (
    <Screen width="form">
      <IntakeForm
        products={products}
        saving={saving}
        submitLabel={copy.saveIntake}
        onSubmit={async (input) => {
          setSaving(true);
          try {
            await saveDraftIntake(input);
            if (router.canGoBack()) router.back();
            else router.replace('/intakes');
          } finally {
            setSaving(false);
          }
        }}
      />
    </Screen>
  );
}

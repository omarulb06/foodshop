import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { OrderForm } from '@/components/order-form';
import { Screen } from '@/components/screen';
import { copy } from '@/lib/copy';
import { useInventory } from '@/state/inventory-context';
import type { OrderItem } from '@/types';

export default function NewOrderScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { products, getProduct, saveDraftOrder } = useInventory();
  const [saving, setSaving] = useState(false);

  const seeded = productId ? getProduct(productId) : undefined;
  const initialItems: OrderItem[] = seeded
    ? [{ productId: seeded.id, productName: seeded.name, quantity: 1, price: 0 }]
    : [];

  return (
    <Screen width="form">
      <OrderForm
        products={products}
        initialItems={initialItems}
        saving={saving}
        submitLabel={copy.saveDraft}
        onSubmit={async (input) => {
          setSaving(true);
          try {
            await saveDraftOrder(input);
            if (router.canGoBack()) router.back();
            else router.replace('/orders');
          } finally {
            setSaving(false);
          }
        }}
      />
    </Screen>
  );
}

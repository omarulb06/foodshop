import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { Notice } from '@/components/notice';
import { OptionGroup } from '@/components/option-group';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { useResponsive } from '@/hooks/use-responsive';
import { copy } from '@/lib/copy';
import { availableQuantity } from '@/lib/stock';
import { applyChange, formatDelta, formatQuantity, parseQuantity } from '@/lib/quantity';
import { unitAllowsDecimals } from '@/lib/units';
import { useInventory } from '@/state/inventory-context';
import { colors, fontSize, radius, spacing } from '@/theme';
import type { Product, StockChangeInput, StockChangeMode } from '@/types';

interface Draft {
  mode: StockChangeMode;
  amount: string;
  note: string;
}

type Evaluation =
  | { state: 'empty' }
  | { state: 'invalid'; error: string }
  | { state: 'unchanged' }
  | { state: 'pending'; amount: number; next: number; clamped: boolean };

const MODE_OPTIONS: { value: StockChangeMode; label: string }[] = [
  { value: 'add', label: copy.modeAdd },
  { value: 'remove', label: copy.modeRemove },
  { value: 'set', label: copy.modeSet },
];

const AMOUNT_LABEL: Record<StockChangeMode, string> = {
  add: copy.amountAdd,
  remove: copy.amountRemove,
  set: copy.amountSet,
};

function emptyDraft(): Draft {
  return { mode: 'add', amount: '', note: '' };
}

export default function UpdateStockScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { products, lastActor, saveStockChanges, getProduct } = useInventory();
  const { gutter, isTablet } = useResponsive();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState(
    () => (productId ? getProduct(productId)?.name : undefined) ?? ''
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [actor, setActor] = useState(lastActor);
  const [actorError, setActorError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const listRef = useRef<FlatList<Product>>(null);

  const evaluations = useMemo(() => {
    const result = new Map<string, Evaluation>();

    for (const product of products) {
      const draft = drafts[product.id];
      if (!draft || draft.amount.trim().length === 0) {
        result.set(product.id, { state: 'empty' });
        continue;
      }

      const parsed = parseQuantity(draft.amount, {
        allowDecimals: unitAllowsDecimals(product.unitId),
      });
      if (!parsed.ok) {
        result.set(product.id, { state: 'invalid', error: parsed.error });
        continue;
      }

      const next = applyChange(product.quantity, draft.mode, parsed.value);
      if (next === product.quantity) {
        result.set(product.id, { state: 'unchanged' });
        continue;
      }
      if (next < product.reservedQuantity) {
        result.set(product.id, {
          state: 'invalid',
          error: copy.stockReserved(product.name, formatQuantity(product.reservedQuantity)),
        });
        continue;
      }

      result.set(product.id, {
        state: 'pending',
        amount: parsed.value,
        next,
        clamped: draft.mode === 'remove' && parsed.value > product.quantity,
      });
    }

    return result;
  }, [products, drafts]);

  const pending = useMemo(
    () =>
      products
        .map((product) => ({ product, evaluation: evaluations.get(product.id) }))
        .filter(
          (item): item is { product: Product; evaluation: Extract<Evaluation, { state: 'pending' }> } =>
            item.evaluation?.state === 'pending'
        ),
    [products, evaluations]
  );

  const invalidCount = useMemo(
    () => [...evaluations.values()].filter((item) => item.state === 'invalid').length,
    [evaluations]
  );

  // Anything typed counts as unsaved work, including a value that is still
  // invalid, so the warning cannot be dodged by leaving a typo behind.
  const hasEdits = useMemo(
    () =>
      Object.values(drafts).some(
        (draft) => draft.amount.trim().length > 0 || draft.note.trim().length > 0
      ),
    [drafts]
  );

  usePreventRemove(hasEdits && !leaving, ({ data }) => {
    Alert.alert(copy.leaveTitle, copy.leaveUpdate(pending.length), [
      { text: copy.keepEditing, style: 'cancel' },
      {
        text: copy.discardChanges,
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return products;
    return products.filter((product) => product.name.toLowerCase().includes(search));
  }, [products, query]);

  const updateDraft = useCallback((id: string, patch: Partial<Draft>) => {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? emptyDraft()), ...patch } }));
  }, []);

  const clearDraft = useCallback((id: string) => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const leaveScreen = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  const onSave = async () => {
    if (invalidCount > 0) {
      Alert.alert(copy.checkHighlighted, copy.checkHighlightedBody);
      return;
    }

    const trimmedActor = actor.trim();
    if (!trimmedActor) {
      setActorError(copy.actorBeforeSave);
      listRef.current?.scrollToEnd({ animated: true });
      return;
    }
    if (pending.length === 0) return;

    const changes: StockChangeInput[] = pending.map(({ product, evaluation }) => ({
      productId: product.id,
      mode: drafts[product.id].mode,
      amount: evaluation.amount,
      note: drafts[product.id].note,
    }));

    setSaving(true);
    setActorError(null);
    try {
      const saved = await saveStockChanges({ actor: trimmedActor, changes });
      setDrafts({});
      setLeaving(true);
      Alert.alert(copy.changesSaved, copy.changesSavedBody(saved, trimmedActor), [
        { text: copy.done, onPress: leaveScreen },
      ]);
    } catch (error) {
      Alert.alert(
        copy.nothingSaved,
        copy.nothingSavedBody(error instanceof Error ? error.message : copy.couldNotStore)
      );
    } finally {
      setSaving(false);
    }
  };

  if (products.length === 0) {
    return (
      <Screen
        width="form"
        style={{ padding: gutter, paddingBottom: gutter + insets.bottom, gap: spacing.lg }}>
        <Notice title={copy.nothingToCountTitle} message={copy.nothingToCountBody} />
        <AppButton label={copy.addProduct} onPress={() => router.replace('/add-product')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        ref={listRef}
        style={styles.list}
        data={visible}
        keyExtractor={(product) => product.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          padding: gutter,
          paddingBottom: gutter + (hasEdits ? 0 : insets.bottom),
          gap: isTablet ? spacing.lg : spacing.md,
        }}
        ListHeaderComponent={
          <View style={[styles.header, { marginBottom: isTablet ? spacing.lg : spacing.md }]}>
            <Text style={styles.intro}>{copy.updateIntro}</Text>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={copy.searchProducts}
              accessibilityLabel={copy.searchProductsToUpdate}
            />
          </View>
        }
        ListEmptyComponent={
          <Notice
            title={copy.noSearchTitle}
            message={copy.noSearchBody(query.trim())}
          />
        }
        renderItem={({ item }) => (
          <UpdateRow
            product={item}
            draft={drafts[item.id]}
            evaluation={evaluations.get(item.id) ?? { state: 'empty' }}
            onChange={updateDraft}
            onClear={clearDraft}
          />
        )}
        ListFooterComponent={
          <SaveSection
            pending={pending}
            invalidCount={invalidCount}
            actor={actor}
            actorError={actorError}
            saving={saving}
            onActorChange={(value) => {
              setActor(value);
              if (actorError) setActorError(null);
            }}
            onSave={onSave}
          />
        }
      />

      {hasEdits ? (
        <View
          style={[
            styles.stickyBar,
            { paddingHorizontal: gutter, paddingBottom: spacing.md + insets.bottom },
          ]}>
          <View style={styles.stickyText}>
            <Text style={styles.stickyCount}>
              {pending.length === 0 ? copy.noValidChanges : copy.unsavedCount(pending.length)}
            </Text>
            {invalidCount > 0 ? (
              <Text style={styles.stickyWarning}>{copy.needsFix(invalidCount)}</Text>
            ) : null}
          </View>
          <AppButton
            label={copy.reviewAndSave}
            size="medium"
            onPress={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        </View>
      ) : null}
    </Screen>
  );
}

interface UpdateRowProps {
  product: Product;
  draft: Draft | undefined;
  evaluation: Evaluation;
  onChange: (id: string, patch: Partial<Draft>) => void;
  onClear: (id: string) => void;
}

function UpdateRow({ product, draft, evaluation, onChange, onClear }: UpdateRowProps) {
  const mode = draft?.mode ?? 'add';
  const allowsDecimals = unitAllowsDecimals(product.unitId);
  const isPending = evaluation.state === 'pending';
  const isInvalid = evaluation.state === 'invalid';

  return (
    <View
      style={[
        styles.card,
        isPending ? styles.cardPending : null,
        isInvalid ? styles.cardInvalid : null,
      ]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleGroup}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {product.name}
          </Text>
          <Text style={styles.cardSubtitle}>
            {copy.stockLine(
              formatQuantity(product.quantity),
              formatQuantity(product.reservedQuantity),
              formatQuantity(Math.max(0, availableQuantity(product)))
            )}{' '}
            {product.unit}
          </Text>
        </View>
        {isPending ? (
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>{copy.unsaved}</Text>
          </View>
        ) : null}
      </View>

      <OptionGroup
        options={MODE_OPTIONS}
        value={mode}
        onChange={(value) => onChange(product.id, { mode: value })}
      />

      <FormField
        label={AMOUNT_LABEL[mode]}
        value={draft?.amount ?? ''}
        onChangeText={(value) => onChange(product.id, { amount: value })}
        keyboardType={allowsDecimals ? 'decimal-pad' : 'number-pad'}
        placeholder={allowsDecimals ? copy.exampleDecimal : copy.exampleWhole}
        maxLength={10}
        error={isInvalid ? evaluation.error : null}
        hint={copy.countedIn(product.unit, allowsDecimals)}
      />

      {draft && draft.amount.trim().length > 0 ? (
        <FormField
          label={copy.noteOptional}
          value={draft.note}
          onChangeText={(value) => onChange(product.id, { note: value })}
          placeholder={copy.notePlaceholder}
          maxLength={120}
        />
      ) : null}

      {isPending ? (
        <View style={styles.result}>
          <Text style={styles.resultText}>
            {copy.newQuantity(formatQuantity(evaluation.next), product.unit)}
          </Text>
          <Text style={styles.resultDelta}>
            {formatDelta(evaluation.next - product.quantity)} {product.unit}
          </Text>
        </View>
      ) : null}

      {isPending && evaluation.clamped ? (
        <Text style={styles.clampWarning}>
          {copy.clampWarning(formatQuantity(product.quantity), product.unit)}
        </Text>
      ) : null}

      {evaluation.state === 'unchanged' ? (
        <Text style={styles.cardSubtitle}>{copy.unchanged}</Text>
      ) : null}

      {draft ? (
        <AppButton
          label={copy.clearProduct}
          variant="quiet"
          size="medium"
          onPress={() => onClear(product.id)}
        />
      ) : null}
    </View>
  );
}

interface SaveSectionProps {
  pending: { product: Product; evaluation: Extract<Evaluation, { state: 'pending' }> }[];
  invalidCount: number;
  actor: string;
  actorError: string | null;
  saving: boolean;
  onActorChange: (value: string) => void;
  onSave: () => void;
}

function SaveSection({
  pending,
  invalidCount,
  actor,
  actorError,
  saving,
  onActorChange,
  onSave,
}: SaveSectionProps) {
  return (
    <View style={styles.saveSection}>
      <Text style={styles.saveHeading}>{copy.pendingHeading}</Text>

      {pending.length === 0 ? (
        <Text style={styles.cardSubtitle}>{copy.nothingToSave}</Text>
      ) : (
        <View style={styles.summary}>
          {pending.map(({ product, evaluation }) => (
            <View key={product.id} style={styles.summaryRow}>
              <Text style={styles.summaryName} numberOfLines={1}>
                {product.name}
              </Text>
              <Text style={styles.summaryValue}>
                {formatQuantity(product.quantity)} → {formatQuantity(evaluation.next)}{' '}
                {product.unit} ({formatDelta(evaluation.next - product.quantity)})
              </Text>
            </View>
          ))}
        </View>
      )}

      {invalidCount > 0 ? (
        <Notice
          tone="warning"
          title={copy.invalidTitle}
          message={copy.invalidBody(invalidCount)}
        />
      ) : null}

      <FormField
        label={copy.savedBy}
        value={actor}
        onChangeText={onActorChange}
        placeholder={copy.yourName}
        autoCapitalize="words"
        maxLength={60}
        error={actorError}
        hint={copy.savedByHint}
      />

      <AppButton
        label={saving ? copy.saving : copy.saveAll}
        hint={pending.length > 0 && !saving ? copy.pendingProducts(pending.length) : undefined}
        onPress={onSave}
        disabled={saving || pending.length === 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  header: {
    gap: spacing.md,
  },
  intro: {
    fontSize: fontSize.body,
    lineHeight: 22,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardPending: {
    borderColor: colors.pending,
    borderStartWidth: 6,
    backgroundColor: colors.pendingSurface,
  },
  cardInvalid: {
    borderColor: colors.danger,
    borderStartWidth: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cardTitleGroup: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: fontSize.bodyLarge,
    fontWeight: '700',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.pending,
  },
  chipLabel: {
    fontSize: fontSize.caption,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  result: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.pending,
    padding: spacing.md,
  },
  resultText: {
    fontSize: fontSize.bodyLarge,
    fontWeight: '700',
    color: colors.text,
  },
  resultDelta: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.pending,
  },
  clampWarning: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    color: colors.pending,
  },
  saveSection: {
    marginTop: spacing.lg,
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  saveHeading: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.text,
  },
  summary: {
    gap: spacing.md,
  },
  summaryRow: {
    gap: 2,
  },
  summaryName: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  summaryValue: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.pending,
  },
  stickyText: {
    flex: 1,
  },
  stickyCount: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  stickyWarning: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    color: colors.danger,
  },
});

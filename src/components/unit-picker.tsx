import { View } from 'react-native';

import { FormField } from '@/components/form-field';
import { OptionGroup } from '@/components/option-group';
import { copy } from '@/lib/copy';
import { MAX_UNIT_LENGTH, UNIT_OPTIONS } from '@/lib/units';
import { spacing } from '@/theme';
import type { UnitId } from '@/types';

interface UnitPickerProps {
  unitId: UnitId;
  customUnit: string;
  onChangeUnitId: (unitId: UnitId) => void;
  onChangeCustomUnit: (value: string) => void;
  error?: string | null;
}

export function UnitPicker({
  unitId,
  customUnit,
  onChangeUnitId,
  onChangeCustomUnit,
  error,
}: UnitPickerProps) {
  return (
    <View style={{ gap: spacing.md }}>
      <OptionGroup
        label={copy.unit}
        options={UNIT_OPTIONS.map((option) => ({ value: option.id, label: option.label }))}
        value={unitId}
        onChange={onChangeUnitId}
      />
      {unitId === 'custom' ? (
        <FormField
          label={copy.yourUnit}
          value={customUnit}
          onChangeText={onChangeCustomUnit}
          placeholder={copy.unitPlaceholder}
          autoCapitalize="none"
          maxLength={MAX_UNIT_LENGTH}
          error={error}
          hint={copy.customUnitHint}
        />
      ) : null}
    </View>
  );
}

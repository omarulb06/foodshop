import { applyChange, formatDelta, formatQuantity, parseQuantity } from '@/lib/quantity';

describe('parseQuantity', () => {
  it('accepts whole numbers', () => {
    expect(parseQuantity('12', { allowDecimals: false })).toEqual({ ok: true, value: 12 });
  });

  it('accepts a decimal comma for units that allow decimals', () => {
    expect(parseQuantity('2,5', { allowDecimals: true })).toEqual({ ok: true, value: 2.5 });
  });

  it('rejects decimals for units counted in whole numbers', () => {
    const result = parseQuantity('2.5', { allowDecimals: false });
    expect(result.ok).toBe(false);
  });

  it('rejects negative values', () => {
    expect(parseQuantity('-1', { allowDecimals: true }).ok).toBe(false);
  });

  it('rejects empty input and letters', () => {
    expect(parseQuantity('', { allowDecimals: true }).ok).toBe(false);
    expect(parseQuantity('   ', { allowDecimals: true }).ok).toBe(false);
    expect(parseQuantity('5 kg', { allowDecimals: true }).ok).toBe(false);
  });

  it('accepts zero', () => {
    expect(parseQuantity('0', { allowDecimals: false })).toEqual({ ok: true, value: 0 });
  });

  it('rejects quantities above the allowed maximum', () => {
    expect(parseQuantity('1000001', { allowDecimals: false }).ok).toBe(false);
  });
});

describe('applyChange', () => {
  it('adds and removes stock', () => {
    expect(applyChange(10, 'add', 5)).toBe(15);
    expect(applyChange(10, 'remove', 4)).toBe(6);
  });

  it('never drops below zero when removing too much', () => {
    expect(applyChange(3, 'remove', 10)).toBe(0);
  });

  it('replaces the quantity when setting an exact count', () => {
    expect(applyChange(10, 'set', 0)).toBe(0);
    expect(applyChange(10, 'set', 7.25)).toBe(7.25);
  });

  it('keeps decimal arithmetic exact', () => {
    expect(applyChange(0.1, 'add', 0.2)).toBe(0.3);
  });
});

describe('formatting', () => {
  it('hides trailing zeros', () => {
    expect(formatQuantity(12)).toBe('12');
    expect(formatQuantity(12.5)).toBe('12.5');
    expect(formatQuantity(12.5000001)).toBe('12.5');
  });

  it('signs deltas', () => {
    expect(formatDelta(3)).toBe('+3');
    expect(formatDelta(-2.5)).toBe('-2.5');
    expect(formatDelta(0)).toBe('0');
  });
});

import { describe, it, expect } from 'vitest';
import { formatAddress, formatAmount } from '../src/lib/stellar.js';

describe('RELIEFRAIL Client Utility & Formatting Suite', () => {
  it('formatAddress correctly truncates ed25519 public keys', () => {
    const address = 'GAORGANIZATION11111111111111111111111111111111111111111111111';
    const formatted = formatAddress(address);
    expect(formatted).toBe('GAOR...1111');
  });

  it('formatAddress handles null or short strings safely', () => {
    expect(formatAddress(null)).toBe('');
    expect(formatAddress(undefined)).toBe('');
    expect(formatAddress('GABCD')).toBe('GABCD');
  });

  it('formatAmount formats currency numbers with 2 decimals by default', () => {
    expect(formatAmount(100)).toBe('100.00');
    expect(formatAmount(2500.5)).toBe('2,500.50');
    expect(formatAmount('50000')).toBe('50,000.00');
  });

  it('formatAmount handles null, undefined, or invalid inputs safely', () => {
    expect(formatAmount(null)).toBe('0.00');
    expect(formatAmount(undefined)).toBe('0.00');
    expect(formatAmount('not_a_number')).toBe('0.00');
  });
});


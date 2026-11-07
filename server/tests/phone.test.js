import { describe, expect, it } from 'vitest';
import { normalizePhone } from '../src/utils/phone.js';

describe('normalizePhone', () => {
  it.each([
    ['0712345678', '254712345678'],
    ['0112345678', '254112345678'],
    ['712345678', '254712345678'],
    ['254712345678', '254712345678'],
    ['+254712345678', '254712345678'],
    ['+254 712 345 678', '254712345678'],
    ['0712-345-678', '254712345678'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', '0812345678', '07123456', '07123456789', '255712345678', 'abc', null, undefined])(
    'rejects %s',
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

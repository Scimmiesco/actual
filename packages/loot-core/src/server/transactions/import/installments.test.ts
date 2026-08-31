import { describe, expect, it } from 'vitest';

import { formatInstallmentNote, parseInstallmentInfo } from './installments';

describe('installment parser', () => {
  it('parses PARC xx/yy formats', () => {
    const res = parseInstallmentInfo('SHEIN  *SHEIN PARC 02/03 Vila OlimpiaBR');
    expect(res).toEqual({
      current: 2,
      total: 3,
      cleanedText: 'SHEIN *SHEIN Vila OlimpiaBR',
      noteTag: '[2/3]',
      isAntecipacao: false,
    });
  });

  it('parses ANTEC xx/yy formats', () => {
    const res = parseInstallmentInfo('ANTEC  02/02-AMAZONMKTPLC*LB     BELOBR');
    expect(res).toEqual({
      current: 2,
      total: 2,
      cleanedText: 'AMAZONMKTPLC*LB BELOBR',
      noteTag: '[2/2]',
      isAntecipacao: true,
    });
  });

  it('parses bracketed [xx/yy] and (xx/yy) formats', () => {
    const res = parseInstallmentInfo('UBER [01/10] TRIP');
    expect(res).toEqual({
      current: 1,
      total: 10,
      cleanedText: 'UBER TRIP',
      noteTag: '[1/10]',
      isAntecipacao: false,
    });
  });

  it('parses DE / de formats', () => {
    const res = parseInstallmentInfo('KAZA MIX 01 de 03 CAMPO GRANDE');
    expect(res).toEqual({
      current: 1,
      total: 3,
      cleanedText: 'KAZA MIX CAMPO GRANDE',
      noteTag: '[1/3]',
      isAntecipacao: false,
    });
  });

  it('formats installment notes nicely without duplicating tags', () => {
    const parsed = parseInstallmentInfo('PARC 02/03')!;
    expect(formatInstallmentNote('', parsed, 'Original Description')).toBe(
      '[2/3] Original Description',
    );
    expect(formatInstallmentNote('[2/3] Existing note', parsed)).toBe(
      '[2/3] Existing note',
    );
    expect(formatInstallmentNote('My custom note', parsed)).toBe(
      '[2/3] My custom note',
    );
  });
});

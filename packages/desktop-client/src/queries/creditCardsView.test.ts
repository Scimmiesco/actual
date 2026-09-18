import { describe, expect, it } from 'vitest';

import { accountFilter, transactions } from './index';

describe('accountFilter for credit cards and checking accounts', () => {
  it('filters for credit card accounts correctly', () => {
    const filter = accountFilter('creditcards');
    expect(filter).toEqual({
      $and: [
        { 'account.offbudget': false },
        { 'account.closed': false },
        { 'account.type': 'credit' },
      ],
    });

    const filterCredit = accountFilter('credit');
    expect(filterCredit).toEqual({
      $and: [
        { 'account.offbudget': false },
        { 'account.closed': false },
        { 'account.type': 'credit' },
      ],
    });
  });

  it('filters for checking accounts correctly', () => {
    const filter = accountFilter('checking');
    expect(filter).toEqual({
      $and: [
        { 'account.offbudget': false },
        { 'account.closed': false },
        { 'account.type': { $ne: 'credit' } },
      ],
    });
  });

  it('builds transactions query for creditcards and checking', () => {
    const ccQuery = transactions('creditcards');
    expect(ccQuery.state.filterExpressions).toEqual([
      {
        $and: [
          { 'account.offbudget': false },
          { 'account.closed': false },
          { 'account.type': 'credit' },
        ],
      },
    ]);

    const chkQuery = transactions('checking');
    expect(chkQuery.state.filterExpressions).toEqual([
      {
        $and: [
          { 'account.offbudget': false },
          { 'account.closed': false },
          { 'account.type': { $ne: 'credit' } },
        ],
      },
    ]);
  });
});

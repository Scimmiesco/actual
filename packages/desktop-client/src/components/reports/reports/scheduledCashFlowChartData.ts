import * as monthUtils from '@actual-app/core/shared/months';
import type {
  AccountEntity,
  CategoryEntity,
  CategoryGroupEntity,
  ForecastResult,
} from '@actual-app/core/types/models';

export type ScheduledCashFlowOccurrence = {
  date: string;
  accountId: string;
  accountName: string;
  payee: string;
  scheduleName: string;
  categoryId: string | null;
  categoryName: string;
  amount: number;
};

export type ScheduledCashFlowChartPoint = {
  date: string;
  total: number;
  [categoryId: string]: string | number;
};

export type ScheduledCashFlowChartData = {
  points: ScheduledCashFlowChartPoint[];
  categories: Array<{
    id: string;
    name: string;
    groupId: string | null;
    groupName: string | null;
  }>;
  occurrences: ScheduledCashFlowOccurrence[];
  accountBreakdown: ScheduledCashFlowAccountSummary[];
  totalIncome: number;
  totalExpenses: number;
};

export type ScheduledCashFlowAccountSummary = {
  accountId: string;
  accountName: string;
  income: number;
  expenses: number;
};

type BuildScheduledCashFlowChartDataParams = {
  forecastData: ForecastResult | null;
  start: string;
  end: string;
  granularity: 'Daily' | 'Monthly';
  accounts: AccountEntity[];
  categories: CategoryEntity[];
  categoryGroups?: CategoryGroupEntity[];
  uncategorizedLabel: string;
};

export function buildScheduledCashFlowChartData({
  forecastData,
  start,
  end,
  granularity,
  accounts,
  categories,
  categoryGroups = [],
  uncategorizedLabel,
}: BuildScheduledCashFlowChartDataParams): ScheduledCashFlowChartData {
  const accountNames = new Map(
    accounts.map(account => [account.id, account.name]),
  );
  const categoryNames = new Map(
    categories.map(category => [category.id, category.name]),
  );
  const categoryGroupNames = new Map(
    categoryGroups.map(group => [group.id, group.name]),
  );
  const occurrences: ScheduledCashFlowOccurrence[] = [];

  for (const dataPoint of forecastData?.dataPoints ?? []) {
    for (const transaction of dataPoint.transactions) {
      const categoryId = transaction.category ?? null;
      occurrences.push({
        date: dataPoint.date,
        accountId: dataPoint.accountId,
        accountName:
          accountNames.get(dataPoint.accountId) ?? dataPoint.accountName,
        payee:
          transaction.payee ?? transaction.scheduleName ?? uncategorizedLabel,
        scheduleName: transaction.scheduleName ?? transaction.payee ?? '',
        categoryId,
        categoryName: categoryId
          ? (categoryNames.get(categoryId) ?? uncategorizedLabel)
          : uncategorizedLabel,
        amount: transaction.amount,
      });
    }
  }

  occurrences.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.accountName.localeCompare(b.accountName) ||
      a.payee.localeCompare(b.payee),
  );

  const categoryById = new Map<
    string,
    { name: string; groupId: string | null; groupName: string | null }
  >();
  const totalsByBucket = new Map<
    string,
    { values: Map<string, number>; total: number }
  >();
  let totalIncome = 0;
  let totalExpenses = 0;
  const accountsById = new Map<string, ScheduledCashFlowAccountSummary>();

  for (const occurrence of occurrences) {
    const categoryId = occurrence.categoryId ?? 'uncategorized';
    const category = categories.find(item => item.id === occurrence.categoryId);
    categoryById.set(categoryId, {
      name: occurrence.categoryName,
      groupId: category?.group ?? null,
      groupName: category?.group
        ? (categoryGroupNames.get(category.group) ?? null)
        : null,
    });
    const bucket =
      granularity === 'Monthly'
        ? monthUtils.getMonth(occurrence.date)
        : occurrence.date;
    const bucketData = totalsByBucket.get(bucket) ?? {
      values: new Map<string, number>(),
      total: 0,
    };
    bucketData.values.set(
      categoryId,
      (bucketData.values.get(categoryId) ?? 0) + occurrence.amount,
    );
    bucketData.total += occurrence.amount;
    totalsByBucket.set(bucket, bucketData);

    if (occurrence.amount > 0) {
      totalIncome += occurrence.amount;
    } else {
      totalExpenses += occurrence.amount;
    }

    const account = accountsById.get(occurrence.accountId) ?? {
      accountId: occurrence.accountId,
      accountName: occurrence.accountName,
      income: 0,
      expenses: 0,
    };
    if (occurrence.amount > 0) {
      account.income += occurrence.amount;
    } else {
      account.expenses += occurrence.amount;
    }
    accountsById.set(occurrence.accountId, account);
  }

  const bucketKeys =
    granularity === 'Monthly'
      ? monthUtils.rangeInclusive(
          monthUtils.getMonth(start),
          monthUtils.getMonth(end),
        )
      : monthUtils.dayRangeInclusive(start, end);
  const points = bucketKeys.map(date => {
    const bucketData = totalsByBucket.get(date);
    const point: ScheduledCashFlowChartPoint = {
      date,
      total: bucketData?.total ?? 0,
    };

    for (const categoryId of categoryById.keys()) {
      point[categoryId] = bucketData?.values.get(categoryId) ?? 0;
    }

    return point;
  });

  return {
    points,
    categories: [...categoryById.entries()].map(([id, category]) => ({
      id,
      name: category.name,
      groupId: category.groupId,
      groupName: category.groupName,
    })),
    occurrences,
    accountBreakdown: [...accountsById.values()].sort((a, b) =>
      a.accountName.localeCompare(b.accountName),
    ),
    totalIncome,
    totalExpenses,
  };
}

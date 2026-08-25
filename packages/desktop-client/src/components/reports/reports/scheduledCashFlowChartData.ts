import * as monthUtils from '@actual-app/core/shared/months';
import type {
  AccountEntity,
  CategoryEntity,
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
  categories: Array<{ id: string; name: string }>;
  occurrences: ScheduledCashFlowOccurrence[];
  totalIncome: number;
  totalExpenses: number;
};

type BuildScheduledCashFlowChartDataParams = {
  forecastData: ForecastResult | null;
  start: string;
  end: string;
  granularity: 'Daily' | 'Monthly';
  accounts: AccountEntity[];
  categories: CategoryEntity[];
  uncategorizedLabel: string;
};

export function buildScheduledCashFlowChartData({
  forecastData,
  start,
  end,
  granularity,
  accounts,
  categories,
  uncategorizedLabel,
}: BuildScheduledCashFlowChartDataParams): ScheduledCashFlowChartData {
  const accountNames = new Map(
    accounts.map(account => [account.id, account.name]),
  );
  const categoryNames = new Map(
    categories.map(category => [category.id, category.name]),
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
        payee: transaction.payee ?? transaction.scheduleName,
        scheduleName: transaction.scheduleName,
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

  const categoryById = new Map<string, string>();
  const totalsByBucket = new Map<
    string,
    { values: Map<string, number>; total: number }
  >();
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const occurrence of occurrences) {
    const categoryId = occurrence.categoryId ?? 'uncategorized';
    categoryById.set(categoryId, occurrence.categoryName);
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
    categories: [...categoryById.entries()].map(([id, name]) => ({ id, name })),
    occurrences,
    totalIncome,
    totalExpenses,
  };
}

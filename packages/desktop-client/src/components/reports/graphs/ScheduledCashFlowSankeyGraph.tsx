import { useTranslation } from 'react-i18next';

import type { SankeyData } from 'recharts/types/chart/Sankey';

import { SankeyGraph } from '#components/reports/graphs/SankeyGraph';
import type { ScheduledCashFlowChartData } from '#components/reports/reports/scheduledCashFlowChartData';

type ScheduledCashFlowSankeyGraphProps = {
  data: ScheduledCashFlowChartData;
  topNcategories: number;
  categorySort: 'amount' | 'name';
  showPercentages: boolean;
  groupAccounts: boolean;
  showCategoryGroups: boolean;
};

export function ScheduledCashFlowSankeyGraph({
  data,
  topNcategories,
  categorySort,
  showPercentages,
  groupAccounts,
  showCategoryGroups,
}: ScheduledCashFlowSankeyGraphProps) {
  const { t } = useTranslation();
  const sankeyData = buildScheduledCashFlowSankeyData(
    data,
    {
      income: t('Scheduled income'),
      expenses: t('Scheduled expenses'),
      accounts: t('Accounts'),
      uncategorized: t('Uncategorized'),
    },
    { topNcategories, categorySort, groupAccounts, showCategoryGroups },
  );

  return (
    <SankeyGraph
      data={sankeyData}
      showPercentages={showPercentages}
      style={{ height: 240 }}
    />
  );
}

function buildScheduledCashFlowSankeyData(
  data: ScheduledCashFlowChartData,
  labels: {
    income: string;
    expenses: string;
    accounts: string;
    uncategorized: string;
  },
  options: {
    topNcategories: number;
    categorySort: 'amount' | 'name';
    groupAccounts: boolean;
    showCategoryGroups: boolean;
  },
): SankeyData {
  const categoryTotals = new Map<string, number>();
  for (const occurrence of data.occurrences) {
    if (occurrence.amount < 0) {
      const key = occurrence.categoryId ?? 'uncategorized';
      categoryTotals.set(
        key,
        (categoryTotals.get(key) ?? 0) + Math.abs(occurrence.amount),
      );
    }
  }
  const categoryIds = [...categoryTotals.keys()]
    .sort((a, b) => {
      if (options.categorySort === 'name') {
        const aName = data.categories.find(category => category.id === a)?.name;
        const bName = data.categories.find(category => category.id === b)?.name;
        return (aName ?? a).localeCompare(bName ?? b);
      }
      return (categoryTotals.get(b) ?? 0) - (categoryTotals.get(a) ?? 0);
    })
    .slice(0, options.topNcategories);
  const visibleCategories = new Set(categoryIds);

  const nodes = [
    { key: 'income', name: labels.income },
    ...(options.groupAccounts
      ? [{ key: 'account:all', name: labels.accounts }]
      : data.accountBreakdown
          .filter(account => account.income > 0 || account.expenses < 0)
          .map(account => ({
            key: `account:${account.accountId}`,
            name: account.accountName,
          }))),
    ...data.categories
      .filter(category =>
        options.showCategoryGroups ? visibleCategories.has(category.id) : false,
      )
      .reduce<Array<{ key: string; name: string }>>((groups, category) => {
        if (
          category.groupId &&
          category.groupName &&
          !groups.some(group => group.key === `group:${category.groupId}`)
        ) {
          groups.push({
            key: `group:${category.groupId}`,
            name: category.groupName,
          });
        }
        return groups;
      }, []),
    ...(!options.showCategoryGroups
      ? data.categories
          .filter(category => visibleCategories.has(category.id))
          .map(category => ({
            key: `category:${category.id}`,
            name: category.name,
          }))
      : []),
    ...(visibleCategories.has('uncategorized') &&
    !data.categories.some(category => category.id === 'uncategorized')
      ? [{ key: 'category:uncategorized', name: labels.uncategorized }]
      : []),
    { key: 'expenses', name: labels.expenses },
  ];
  const nodeIndex = new Map(nodes.map((node, index) => [node.key, index]));
  const links = new Map<string, number>();

  function addLink(source: string, target: string, value: number) {
    if (value <= 0 || !nodeIndex.has(source) || !nodeIndex.has(target)) {
      return;
    }
    const key = `${source}->${target}`;
    links.set(key, (links.get(key) ?? 0) + value);
  }

  for (const occurrence of data.occurrences) {
    const accountKey = options.groupAccounts
      ? 'account:all'
      : `account:${occurrence.accountId}`;
    if (occurrence.amount > 0) {
      addLink('income', accountKey, occurrence.amount);
    } else if (occurrence.amount < 0) {
      const categoryKey = `category:${occurrence.categoryId ?? 'uncategorized'}`;
      if (visibleCategories.has(occurrence.categoryId ?? 'uncategorized')) {
        const category = data.categories.find(
          item => item.id === (occurrence.categoryId ?? 'uncategorized'),
        );
        if (
          options.showCategoryGroups &&
          category?.groupId &&
          category.groupName
        ) {
          const groupKey = `group:${category.groupId}`;
          addLink(accountKey, groupKey, Math.abs(occurrence.amount));
          addLink(groupKey, 'expenses', Math.abs(occurrence.amount));
        } else {
          addLink(accountKey, categoryKey, Math.abs(occurrence.amount));
          addLink(categoryKey, 'expenses', Math.abs(occurrence.amount));
        }
      }
    }
  }

  const totalFlow = Math.max(
    data.occurrences
      .filter(occurrence => occurrence.amount > 0)
      .reduce((sum, occurrence) => sum + occurrence.amount, 0),
    data.occurrences
      .filter(occurrence => occurrence.amount < 0)
      .reduce((sum, occurrence) => sum + Math.abs(occurrence.amount), 0),
  );
  const incomingValues = new Map<number, number>();
  const outgoingValues = new Map<number, number>();
  for (const [key, value] of links) {
    const [source, target] = key.split('->');
    const sourceIndex = nodeIndex.get(source);
    const targetIndex = nodeIndex.get(target);
    if (sourceIndex != null) {
      outgoingValues.set(
        sourceIndex,
        (outgoingValues.get(sourceIndex) ?? 0) + value,
      );
    }
    if (targetIndex != null) {
      incomingValues.set(
        targetIndex,
        (incomingValues.get(targetIndex) ?? 0) + value,
      );
    }
  }
  const sankeyLinks = [...links.entries()].map(([key, value]) => {
    const [source, target] = key.split('->');
    return {
      source: nodeIndex.get(source) ?? -1,
      target: nodeIndex.get(target) ?? -1,
      value,
    };
  });

  return {
    nodes: nodes.map((node, index) => ({
      ...node,
      percentageLabel:
        totalFlow > 0
          ? `${Math.round(
              (Math.max(
                incomingValues.get(index) ?? 0,
                outgoingValues.get(index) ?? 0,
              ) /
                totalFlow) *
                100,
            )}%`
          : undefined,
    })),
    links: sankeyLinks,
  };
}

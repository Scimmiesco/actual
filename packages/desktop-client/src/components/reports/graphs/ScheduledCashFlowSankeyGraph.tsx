import { useTranslation } from 'react-i18next';

import type { SankeyData } from 'recharts/types/chart/Sankey';

import { SankeyGraph } from '#components/reports/graphs/SankeyGraph';
import type { ScheduledCashFlowChartData } from '#components/reports/reports/scheduledCashFlowChartData';

type ScheduledCashFlowSankeyGraphProps = {
  data: ScheduledCashFlowChartData;
};

export function ScheduledCashFlowSankeyGraph({
  data,
}: ScheduledCashFlowSankeyGraphProps) {
  const { t } = useTranslation();
  const sankeyData = buildScheduledCashFlowSankeyData(data, {
    income: t('Scheduled income'),
    expenses: t('Scheduled expenses'),
  });

  return <SankeyGraph data={sankeyData} style={{ height: 240 }} />;
}

function buildScheduledCashFlowSankeyData(
  data: ScheduledCashFlowChartData,
  labels: { income: string; expenses: string },
): SankeyData {
  const nodes = [
    { key: 'income', name: labels.income },
    ...data.accountBreakdown
      .filter(account => account.income > 0 || account.expenses < 0)
      .map(account => ({
        key: `account:${account.accountId}`,
        name: account.accountName,
      })),
    ...data.categories.map(category => ({
      key: `category:${category.id}`,
      name: category.name,
    })),
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
    const accountKey = `account:${occurrence.accountId}`;
    if (occurrence.amount > 0) {
      addLink('income', accountKey, occurrence.amount);
    } else if (occurrence.amount < 0) {
      const categoryKey = `category:${occurrence.categoryId ?? 'uncategorized'}`;
      addLink(accountKey, categoryKey, Math.abs(occurrence.amount));
      addLink(categoryKey, 'expenses', Math.abs(occurrence.amount));
    }
  }

  return {
    nodes,
    links: [...links.entries()].map(([key, value]) => {
      const [source, target] = key.split('->');
      return {
        source: nodeIndex.get(source) ?? -1,
        target: nodeIndex.get(target) ?? -1,
        value,
      };
    }),
  };
}

import type { CSSProperties } from 'react';

import { theme } from '@actual-app/components/theme';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  getColorScale,
  useRechartsAnimation,
} from '#components/reports/chart-theme';
import { Container } from '#components/reports/Container';
import { getCustomTick } from '#components/reports/getCustomTick';
import type { ScheduledCashFlowChartData } from '#components/reports/reports/scheduledCashFlowChartData';
import { useFormat } from '#hooks/useFormat';
import { usePrivacyMode } from '#hooks/usePrivacyMode';

type ScheduledCashFlowGraphProps = {
  data: ScheduledCashFlowChartData;
  compact?: boolean;
  style?: CSSProperties;
};

export function ScheduledCashFlowGraph({
  data,
  compact = false,
  style,
}: ScheduledCashFlowGraphProps) {
  const format = useFormat();
  const privacyMode = usePrivacyMode();
  const animationProps = useRechartsAnimation();
  const colors = getColorScale('qualitative');

  return (
    <Container
      style={{
        ...style,
        ...(compact && { height: 'auto' }),
      }}
    >
      {(width, height) => (
        <BarChart
          responsive
          width={width}
          height={height}
          data={data.points}
          stackOffset="sign"
          margin={{ top: 5, right: 10, left: 5, bottom: compact ? 0 : 10 }}
        >
          {!compact && <CartesianGrid strokeDasharray="3 3" vertical={false} />}
          <XAxis
            dataKey="date"
            tick={{ fill: theme.pageText }}
            tickLine={{ stroke: theme.pageText }}
          />
          {!compact && (
            <YAxis
              tick={{ fill: theme.pageText }}
              tickLine={{ stroke: theme.pageText }}
              tickSize={0}
              tickFormatter={value =>
                getCustomTick(
                  format(value, 'financial-no-decimals'),
                  privacyMode,
                )
              }
            />
          )}
          {!compact && (
            <Legend
              formatter={value =>
                data.categories.find(category => category.id === value)?.name ??
                value
              }
            />
          )}
          {!compact && (
            <Tooltip
              formatter={(value, name) => [
                format(value, 'financial'),
                String(name),
              ]}
              labelFormatter={label => String(label)}
              isAnimationActive={false}
            />
          )}
          <ReferenceLine y={0} stroke={theme.pageTextLight} />
          {data.categories.map((category, index) => (
            <Bar
              key={category.id}
              dataKey={category.id}
              name={category.id}
              stackId="scheduled-cash-flow"
              fill={colors[index % colors.length]}
              maxBarSize={50}
              {...animationProps}
            />
          ))}
        </BarChart>
      )}
    </Container>
  );
}

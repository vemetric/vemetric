import { Box, Flex, Icon, Text } from '@chakra-ui/react';
import type { ChartMotionDefinition, ChartTooltipAnchor } from '@tanstack/charts';
import { areaY, barY, crosshair, defineChart, dot, lineY, whenFocused } from '@tanstack/charts';
import { motion } from '@tanstack/charts/motion';
import { RendererChart } from '@tanstack/charts/react/tooltip';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { tooltip } from '@tanstack/charts/tooltip';
import { formatNumber } from '@vemetric/common/math';
import { useMemo } from 'react';
import type { ChartCategory } from '@/components/pages/dashboard/chart-category-card';
import { CHART_CATEGORY_MAP } from '@/components/pages/dashboard/chart-category-card';
import type { ChartCategoryKey } from '@/hooks/use-chart-toggles';
import { getNiceTicks, getVisibleTicks, measureTickLabel } from '@/utils/chart-ticks';
import { ChartTooltip } from './chart-tooltip';
import type { transformChartSeries } from './dashboard-chart';

type ChartRow = ReturnType<typeof transformChartSeries>[number];
type MetricKey = Exclude<ChartCategoryKey, 'events'>;

// Motion is disabled for the chart as a whole and only enabled for specific marks below.
// Resize updates are animated as well: otherwise a resize during the bars' entrance (which already happens on mount,
// when the measured height changes by a fraction of a pixel) makes the next data update grow the bars from zero again.
const renderer = motion({ resize: true });

const TOOLTIP_OFFSET = 20;
// Follows the hovered x value while staying at the top of the chart (the offset only applies horizontally)
const tooltipAnchor: ChartTooltipAnchor = (_points, { focus, scales }) => ({
  x: scales.x.map(focus.primary.xValue) ?? 0,
  y: -TOOLTIP_OFFSET,
});

const tween = (duration: number) => ({ type: 'tween' as const, duration, easing: 'ease' as const });

const getTicks = (values: number[], min: number | 'auto', max: number | 'auto', allowDecimals: boolean) => {
  const finiteValues = values.filter(Number.isFinite);
  const dataMin = finiteValues.length > 0 ? Math.min(...finiteValues) : 0;
  const dataMax = finiteValues.length > 0 ? Math.max(...finiteValues) : 0;
  return getNiceTicks(min === 'auto' ? dataMin : min, max === 'auto' ? dataMax : max, 5, allowDecimals);
};

interface Props {
  data: ChartRow[];
  categories: Array<[MetricKey, ChartCategory]>;
  showEvents: boolean;
  showEndDate: boolean;
  /** Reveals the series from left to right when they appear */
  reveal?: { duration: number; delay?: number; easing?: string };
  /** Morphs the series when the data changes (used for the live view) */
  animateUpdates?: boolean;
  hideYAxis: boolean;
  autoMinValue?: boolean;
  minValue?: number;
  maxValue?: number;
  allowDecimals?: boolean;
}

export const TimeSeriesChart = (props: Props) => {
  const {
    data,
    categories,
    showEvents,
    showEndDate,
    reveal,
    animateUpdates = false,
    hideYAxis,
    autoMinValue = false,
    minValue,
    maxValue,
    allowDecimals = true,
  } = props;

  const definition = useMemo(() => {
    const x = (_row: ChartRow, { index }: { index: number }) => index;
    // Data updates morph the series, the reveal is done via CSS (see below)
    const seriesMotion: ChartMotionDefinition<ChartRow> = animateUpdates
      ? ({ phase }) => (phase === 'update' ? { transition: tween(1500) } : false)
      : false;

    // Metrics without a dedicated y-axis share the visible one, the others get their own hidden scale
    const sharedAxisValues = categories
      .filter(([, { yAxisId }]) => !yAxisId)
      .flatMap(([key]) => data.map((row) => row[`${key}Full`]));
    const yTicks = getTicks(
      sharedAxisValues,
      autoMinValue ? 'auto' : (minValue ?? 0),
      maxValue ?? 'auto',
      allowDecimals,
    );
    const hiddenScales = Object.fromEntries(
      [
        ...categories.filter(([, { yAxisId }]) => yAxisId).map(([key, { yAxisId }]) => [yAxisId!, `${key}Full`]),
        ...(showEvents ? [['events', 'events']] : []),
      ].map(([scaleId, valueKey]) => {
        const ticks = getTicks(
          data.map((row) => row[valueKey as keyof ChartRow] as number),
          0,
          'auto',
          true,
        );
        return [
          scaleId,
          {
            channel: 'y' as const,
            scale: scaleLinear().domain([ticks[0], ticks[ticks.length - 1]]),
            axis: false as const,
          },
        ];
      }),
    );
    const getBaseline = (yAxisId?: string) => (yAxisId ? hiddenScales[yAxisId].scale.domain()[0] : yTicks[0]);

    const eventsColor = CHART_CATEGORY_MAP.events.color;

    const margin = { top: showEvents ? 40 : 15, right: 0, bottom: 30, left: hideYAxis ? 0 : 40 };
    const formatYTick = (value: number) => formatNumber(value, true);

    return defineChart({
      chart: ({ width, height }) => {
        // Only show the tick labels that fit, the same way recharts did (point scale without padding)
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;
        const xStep = data.length > 1 ? plotWidth / (data.length - 1) : 0;
        const xCandidates = data.map((row, index) => ({
          coordinate: data.length > 1 ? margin.left + index * xStep : margin.left + plotWidth / 2,
          size: measureTickLabel(row.startDate).width,
        }));
        const xTicks = getVisibleTicks(xCandidates, { start: 0, end: width, minTickGap: 15, mode: 'preserveStartEnd' });
        // Moves the first and last label inwards when they'd overflow the chart
        const xLabelShifts = new Map(
          xTicks.map(({ index, labelCoordinate }) => [index, labelCoordinate - xCandidates[index].coordinate]),
        );

        const [yMin, yMax] = [yTicks[0], yTicks[yTicks.length - 1]];
        const yCandidates = yTicks.map((value) => ({
          coordinate: margin.top + (1 - (value - yMin) / (yMax - yMin || 1)) * plotHeight,
          size: measureTickLabel(formatYTick(value)).height,
        }));
        // The grid lines also only use the visible ticks
        const visibleYTicks = getVisibleTicks(yCandidates, {
          start: 0,
          end: height,
          minTickGap: 5,
          mode: 'preserveEnd',
        }).map(({ index }) => yTicks[index]);

        return {
          marks: [
            // Vertical line at the hovered x value, below the series
            crosshair({ x: { stroke: '#d1d5db', strokeOpacity: 1, strokeWidth: 1 }, y: false }),
            ...categories.flatMap(([key, { color, yAxisId }]) => {
              const stroke = `var(--chakra-colors-${color}-500)`;
              const options = { x, yScale: yAxisId, motion: seriesMotion };
              return [
                // Background area with gradient - uses full data for consistent scaling
                areaY(data, {
                  ...options,
                  id: `${key}-area`,
                  y1: getBaseline(yAxisId),
                  y2: `${key}Full`,
                  fill: `url(#${key}-fill)`,
                  // Default fill opacity of recharts' Area
                  fillOpacity: 0.6,
                }),
                // Solid line for complete data
                lineY(data, { ...options, id: `${key}-line`, y: key, stroke, strokeWidth: 2 }),
                // Dashed line for incomplete/current period data
                lineY(data, {
                  ...options,
                  id: `${key}-dashed`,
                  y: `${key}Dashed`,
                  stroke,
                  strokeWidth: 2,
                  strokeDasharray: '5 5',
                }),
              ];
            }),
            ...(showEvents
              ? [
                  barY(data, {
                    id: 'events',
                    x,
                    y1: 0,
                    y2: 'events',
                    yScale: 'events',
                    fill: 'url(#events-fill)',
                    stroke: `var(--chakra-colors-${eventsColor}-500)`,
                    strokeOpacity: 0.6,
                    strokeWidth: 1,
                    radius: [3, 3, 0, 0],
                    maxThickness: 15,
                    motion: { delay: 0, transition: tween(400) },
                  }),
                ]
              : []),
            // Highlights the hovered data point of each series, on top of all other marks
            ...categories.map(([key, { color, yAxisId }]) =>
              whenFocused(
                dot(data, {
                  x,
                  y: `${key}Full`,
                  yScale: yAxisId,
                  r: 5,
                  fill: `var(--chakra-colors-${color}-500)`,
                  stroke: '#fff',
                  strokeWidth: 2,
                  motion: false,
                }),
                { match: 'x' },
              ),
            ),
          ],
          scales: {
            x: {
              scale: scalePoint<number>,
              axis: {
                line: false,
                ticks: {
                  values: xTicks.map(({ index }) => index),
                  format: (index) => data[index]?.startDate ?? '',
                  size: 0,
                  padding: 14,
                },
                tickLabels: { fontSize: 12, opacity: 1, thin: false, dx: ({ value }) => xLabelShifts.get(value) ?? 0 },
              },
            },
            y: {
              scale: scaleLinear().domain([yMin, yMax]),
              axis: hideYAxis
                ? { line: false, ticks: { values: visibleYTicks, size: 0 }, tickLabels: false }
                : {
                    line: false,
                    ticks: { values: visibleYTicks, size: 0, padding: 8, format: formatYTick },
                    tickLabels: { fontSize: 12, opacity: 1, thin: false },
                  },
              grid: {
                stroke: 'var(--chakra-colors-gray-emphasized)',
                strokeOpacity: 1,
                strokeWidth: 0.6,
                strokeDasharray: '12 6',
              },
            },
            ...hiddenScales,
          },
          gradients: [
            ...categories.map(([key, { color }]) => ({
              id: `${key}-fill`,
              x1: 0,
              y1: 0,
              x2: 0,
              y2: 1,
              stops: [
                { offset: 0.05, color: `var(--chakra-colors-${color}-500)`, opacity: 0.7 },
                { offset: 0.95, color: `var(--chakra-colors-${color}-500)`, opacity: 0 },
              ],
            })),
            {
              id: 'events-fill',
              x1: 0,
              y1: 0,
              x2: 0,
              y2: 1,
              stops: [
                { offset: 0.05, color: `var(--chakra-colors-${eventsColor}-400)`, opacity: 1 },
                { offset: 0.95, color: `var(--chakra-colors-${eventsColor}-400)`, opacity: 0.4 },
              ],
            },
          ],
          margin,
          theme: { muted: 'var(--chakra-colors-gray-500)', foreground: 'var(--chakra-colors-gray-500)' },
        };
      },
      motion: false,
      focus: 'group-x',
      maxFocusDistance: Number.POSITIVE_INFINITY,
      focusRing: false,
      tooltip: {
        use: tooltip,
        sticky: false,
        anchor: tooltipAnchor,
        placement: ['bottom-right', 'bottom-left'],
        offset: TOOLTIP_OFFSET,
        motion: tween(100),
      },
    });
  }, [data, categories, showEvents, animateUpdates, hideYAxis, autoMinValue, minValue, maxValue, allowDecimals]);

  return (
    <Box
      w="100%"
      h="100%"
      css={{
        // Chakra's CSS reset makes text inherit the font, which would override the font size TanStack Charts sets
        '& .ts-chart text': { fontSize: 'xs' },
        // Our own tooltip body replaces the chrome of the built-in tooltip
        '--ts-chart-tooltip-background': 'transparent',
        '--ts-chart-tooltip-border': 'none',
        '--ts-chart-tooltip-border-radius': '0',
        '--ts-chart-tooltip-shadow': 'none',
        '--ts-chart-tooltip-padding': '0',
        '--ts-chart-tooltip-max-width': 'none',
        '--ts-chart-tooltip-font': '400 1rem/1.5 var(--chakra-fonts-body)',
        // TanStack Charts only grows lines and areas from the baseline, so we reveal them from left to right ourselves.
        // These class names aren't documented by TanStack Charts, so check they still exist when upgrading.
        '& .ts-chart__area, & .ts-chart__line': reveal
          ? {
              animation: `chart-reveal ${reveal.duration}ms ${reveal.easing ?? 'ease'} ${reveal.delay ?? 0}ms both`,
              _motionReduce: { animation: 'none' },
            }
          : undefined,
      }}
    >
      <RendererChart
        definition={definition}
        renderer={renderer}
        ariaLabel="Analytics over time"
        style={{ height: '100%' }}
        renderTooltipBody={({ points }) => {
          const row = points[0]?.datum as ChartRow | undefined;
          if (!row) {
            return null;
          }
          const rows: Array<[ChartCategoryKey, number]> = categories.map(([key]) => [key, row[`${key}Full`]]);
          if (showEvents) {
            rows.push(['events', row.events]);
          }

          return (
            <ChartTooltip label={`${row.startDate}${showEndDate ? ` - ${row.endDate}` : ''}`}>
              {rows.map(([categoryKey, value]) => {
                const category = CHART_CATEGORY_MAP[categoryKey];
                return (
                  <Flex key={categoryKey} align="center" px={3} py={2} gap={5} justify="space-between">
                    <Flex align="center" gap={2}>
                      <Icon as={category.icon} color={category.color + '.500'} />
                      <Text textTransform="capitalize" fontWeight="semibold">
                        {category.label}
                      </Text>
                    </Flex>
                    {category.valueFormatter ? category.valueFormatter(value) : formatNumber(value)}
                  </Flex>
                );
              })}
            </ChartTooltip>
          );
        }}
      />
    </Box>
  );
};

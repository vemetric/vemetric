import { Box, Flex, Icon, Text } from '@chakra-ui/react';
import type { ChartMotionDefinition, ChartTooltipAnchor } from '@tanstack/charts';
import { areaY, barY, crosshair, defineChart, dot, lineY, whenFocused } from '@tanstack/charts';
import { motion } from '@tanstack/charts/motion';
import { RendererChart } from '@tanstack/charts/react/tooltip';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { tooltip } from '@tanstack/charts/tooltip';
import { formatNumber } from '@vemetric/common/math';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { ChartCategory } from '@/components/pages/dashboard/chart-category-card';
import { CHART_CATEGORY_MAP } from '@/components/pages/dashboard/chart-category-card';
import type { ChartCategoryKey } from '@/hooks/use-chart-toggles';
import { ChartTooltip } from './chart-tooltip';
import type { transformChartSeries } from './dashboard-chart';

type ChartRow = ReturnType<typeof transformChartSeries>[number];
type MetricKey = Exclude<ChartCategoryKey, 'events'>;

// Animating resizes works around a TanStack Charts bug: a resize during the bars' entrance makes later updates regrow them
const renderer = motion({ resize: true });

const TOOLTIP_OFFSET = 20;
// The offset would also apply vertically, so this keeps the tooltip at the top
const tooltipAnchor: ChartTooltipAnchor = (_points, { focus, scales }) => ({
  x: scales.x.map(focus.primary.xValue) ?? 0,
  y: -TOOLTIP_OFFSET,
});

type RevealOptions = { duration: number; delay?: number; easing?: string };

// Not CSS animations, as they restart when the chart moves series in the DOM. Undocumented class names, check on upgrades.
const SERIES_SELECTOR = '.ts-chart__area, .ts-chart__line';
const revealSeries = (element: Element, { duration, delay = 0, easing = 'ease' }: RevealOptions) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  element.animate([{ clipPath: 'inset(0 100% 0 0) view-box' }, { clipPath: 'inset(0 0 0 0) view-box' }], {
    duration,
    delay,
    easing,
    fill: 'backwards',
  });
};

// Every n-th x-axis label is shown (anchored at the most recent one), based on an approximate 12px character width.
// The spacing includes half a label extra, as the last label is aligned with the right edge.
const X_LABEL_CHAR_WIDTH = 7;
const X_LABEL_GAP = 15;
// Room for marks centered on the outer points (half an events bar, the hover dot)
const EDGE_INSET = 8;

const tween = (duration: number) => ({ type: 'tween' as const, duration, easing: 'ease' as const });

interface Props {
  data: ChartRow[];
  categories: Array<[MetricKey, ChartCategory]>;
  showEvents: boolean;
  showEndDate: boolean;
  reveal?: RevealOptions;
  animateUpdates?: boolean;
  hideYAxis: boolean;
}

export const TimeSeriesChart = (props: Props) => {
  const { data, categories, showEvents, showEndDate, reveal, animateUpdates = false, hideYAxis } = props;

  const definition = useMemo(() => {
    const x = (_row: ChartRow, { index }: { index: number }) => index;
    const seriesMotion: ChartMotionDefinition<ChartRow> = animateUpdates
      ? ({ phase }) => (phase === 'update' ? { transition: tween(1500) } : false)
      : false;

    const hiddenScales = Object.fromEntries(
      [...categories.flatMap(([, { yAxisId }]) => (yAxisId ? [yAxisId] : [])), ...(showEvents ? ['events'] : [])].map(
        (scaleId) => [scaleId, { channel: 'y' as const, scale: scaleLinear, nice: 5, axis: false as const }],
      ),
    );

    const eventsColor = CHART_CATEGORY_MAP.events.color;

    return defineChart({
      chart: ({ width }) => {
        const labelWidth = Math.max(0, ...data.map((row) => row.startDate.length)) * X_LABEL_CHAR_WIDTH;
        const plotWidth = width - EDGE_INSET - (hideYAxis ? EDGE_INSET : 40);
        const xLabelStep = Math.max(
          1,
          Math.ceil(((labelWidth * 1.5 + X_LABEL_GAP) * (data.length - 1)) / Math.max(plotWidth, 1)),
        );
        const xLabels = data.map((_, index) => index).filter((index) => (data.length - 1 - index) % xLabelStep === 0);
        // Aligns the outer labels with the chart edges instead of reserving extra space for them
        const getXLabelAnchor = (index: number) => {
          if (index === data.length - 1) {
            return 'end';
          }
          const position = EDGE_INSET + (index * plotWidth) / Math.max(data.length - 1, 1);
          const overflowsLeft = hideYAxis && position < labelWidth / 2;
          return index === xLabels[0] && overflowsLeft ? 'start' : 'middle';
        };
        return {
          marks: [
            crosshair({ x: { stroke: '#d1d5db', strokeOpacity: 1, strokeWidth: 1 }, y: false }),
            ...categories.flatMap(([key, { color, yAxisId }]) => {
              const stroke = `var(--chakra-colors-${color}-500)`;
              const options = { x, yScale: yAxisId, motion: seriesMotion };
              return [
                // Background area with gradient - uses full data for consistent scaling
                areaY(data, {
                  ...options,
                  id: `${key}-area`,
                  y1: 0,
                  y2: `${key}Full`,
                  fill: `url(#${key}-fill)`,
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
                    // Skips empty bars, as their stroke would still be visible
                    y2: (row) => row.events || null,
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
                  values: xLabels,
                  format: (index) => data[index]?.startDate ?? '',
                  size: 0,
                  padding: 14,
                },
                tickLabels: {
                  fontSize: 12,
                  opacity: 1,
                  anchor: ({ value }) => getXLabelAnchor(value),
                  thin: { minGap: 15, priority: 'ends' },
                },
              },
            },
            y: {
              scale: scaleLinear,
              nice: 5,
              axis: hideYAxis
                ? { line: false, ticks: { count: 3, size: 0 }, tickLabels: false }
                : {
                    line: false,
                    ticks: { count: 5, size: 0, padding: 8, format: (value) => formatNumber(value, true) },
                    tickLabels: { fontSize: 12, opacity: 1 },
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
          margin: { top: showEvents ? 40 : 15, right: EDGE_INSET, ...(hideYAxis ? { left: EDGE_INSET } : {}) },
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
  }, [data, categories, showEvents, animateUpdates, hideYAxis]);

  const containerRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef(reveal);
  useLayoutEffect(() => {
    revealRef.current = reveal;
  }, [reveal]);
  // Mutation observers run before the next paint, so new series don't flash before being revealed
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    let shownSeries = new Set<string>();
    const revealNewSeries = () => {
      const nextShownSeries = new Set<string>();
      for (const element of container.querySelectorAll(SERIES_SELECTOR)) {
        const key = element.getAttribute('data-ts-key') ?? '';
        nextShownSeries.add(key);
        if (revealRef.current && !shownSeries.has(key)) {
          revealSeries(element, revealRef.current);
        }
      }
      shownSeries = nextShownSeries;
    };
    revealNewSeries();
    const observer = new MutationObserver(revealNewSeries);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      w="100%"
      h="100%"
      css={{
        // Chakra's CSS reset overrides the font size TanStack Charts sets on SVG text
        '& .ts-chart text': { fontSize: 'xs' },
        '--ts-chart-tooltip-background': 'transparent',
        '--ts-chart-tooltip-border': 'none',
        '--ts-chart-tooltip-border-radius': '0',
        '--ts-chart-tooltip-shadow': 'none',
        '--ts-chart-tooltip-padding': '0',
        '--ts-chart-tooltip-max-width': 'none',
        '--ts-chart-tooltip-font': '400 1rem/1.5 var(--chakra-fonts-body)',
      }}
      ref={containerRef}
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

import { Box } from '@chakra-ui/react';
import { areaY, defineChart, lineY } from '@tanstack/charts';
import { Chart } from '@tanstack/charts/react';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { useMemo } from 'react';
import { getNiceTicks } from '@/utils/chart-ticks';

type ActiveUserTimeSeries = Array<{ date: string; count: number }>;

// Line and gradient use currentColor, so the parent sets the color
export const ActiveUsersSparkline = ({ data }: { data: ActiveUserTimeSeries }) => {
  const definition = useMemo(() => {
    const counts = data.map((entry) => entry.count);
    const yTicks = getNiceTicks(Math.min(...counts), Math.max(...counts));
    const yMin = yTicks[0];

    return defineChart({
      marks: [
        // The area fills down to the lower bound of the domain, which doesn't necessarily start at zero
        areaY(data, { x: 'date', y1: yMin, y2: 'count', fill: 'url(#fill)', fillOpacity: 0.6 }),
        lineY(data, { x: 'date', y: 'count', stroke: 'currentColor', strokeWidth: 2 }),
      ],
      scales: {
        x: { scale: scalePoint<string>, axis: false },
        y: {
          scale: scaleLinear().domain([yMin, yTicks[yTicks.length - 1]]),
          // Hidden axis that only provides the tick values for the grid lines
          axis: { line: false, ticks: { values: yTicks, size: 0 }, tickLabels: false },
          grid: {
            stroke: 'var(--chakra-colors-gray-emphasized)',
            strokeOpacity: 0.5,
            strokeWidth: 0.8,
            strokeDasharray: '10 5',
          },
        },
      },
      gradients: [
        {
          id: 'fill',
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 1,
          stops: [
            { offset: 0.05, color: 'currentColor', opacity: 0.7 },
            { offset: 0.95, color: 'currentColor', opacity: 0 },
          ],
        },
      ],
      margin: { top: 20, right: 0, bottom: 10, left: 0 },
      focus: false,
    });
  }, [data]);

  return (
    <Box
      h="100%"
      css={{
        // TanStack Charts only grows lines and areas from the baseline, so we reveal the marks from left to right
        // ourselves. `ts-chart__marks` isn't documented by TanStack Charts, so check it still exists when upgrading.
        '& .ts-chart__marks': {
          animation: 'chart-reveal 1.5s ease both',
          _motionReduce: { animation: 'none' },
        },
      }}
    >
      <Chart definition={definition} ariaLabel="Active users" style={{ height: '100%' }} />
    </Box>
  );
};

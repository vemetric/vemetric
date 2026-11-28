import { Box } from '@chakra-ui/react';
import { areaY, defineChart, lineY } from '@tanstack/charts';
import { Chart } from '@tanstack/charts/react';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { useMemo } from 'react';

type ActiveUserTimeSeries = Array<{ date: string; count: number }>;

// Line and gradient use currentColor, so the parent sets the color
export const ActiveUsersSparkline = ({ data }: { data: ActiveUserTimeSeries }) => {
  const definition = useMemo(() => {
    const counts = data.map((entry) => entry.count);
    const yScale = scaleLinear()
      .domain([Math.min(...counts), Math.max(...counts)])
      .nice(5);
    const [yMin] = yScale.domain();

    return defineChart({
      marks: [
        areaY(data, { x: 'date', y1: yMin, y2: 'count', fill: 'url(#fill)', fillOpacity: 0.6 }),
        lineY(data, { x: 'date', y: 'count', stroke: 'currentColor', strokeWidth: 2 }),
      ],
      scales: {
        x: { scale: scalePoint<string>, axis: false },
        y: {
          scale: yScale,
          axis: { line: false, ticks: { count: 5, size: 0 }, tickLabels: false },
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
        // Undocumented class name, check on upgrades
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

import type { BoxProps } from '@chakra-ui/react';
import { Box } from '@chakra-ui/react';
import { useInView, useMotionValue, useSpring } from 'motion/react';
import { useEffect, useRef } from 'react';

export function NumberCounter({ value, ...props }: { value: number } & BoxProps) {
  const ref = useRef<HTMLElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { bounce: 0 });
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [motionValue, isInView, value]);

  useEffect(() => {
    springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = Intl.NumberFormat('en-US').format(Number(latest.toFixed(0)));
      }
    });
  }, [springValue]);

  return (
    <Box as="span" ref={ref} {...props}>
      {value}
    </Box>
  );
}

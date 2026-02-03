import { Box } from '@chakra-ui/react';
import { motion } from 'motion/react';

interface Props {
  value: number;
  maxValue?: number;
}

export const CardBar = ({ value, maxValue }: Props) => {
  return (
    <Box
      asChild
      pos="absolute"
      h="100%"
      bg="purple.emphasized"
      rounded="md"
      opacity={0.65}
      transition="opacity 0.2s ease-in-out"
      _groupHover={{ opacity: 1 }}
    >
      <motion.div
        animate={{
          width: `${(value / (maxValue || 1)) * 100}%`,
        }}
      />
    </Box>
  );
};

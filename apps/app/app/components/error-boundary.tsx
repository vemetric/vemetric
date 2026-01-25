import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" p={4}>
      <VStack gap={4} textAlign="center">
        <Heading size="xl">Something went wrong</Heading>
        <Text color="fg.muted" maxW="md">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </Text>
        <Button
          onClick={() => {
            router.invalidate();
          }}
        >
          Try Again
        </Button>
      </VStack>
    </Box>
  );
}

import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import { Link } from '@tanstack/react-router';

export function NotFound() {
  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" p={4}>
      <VStack gap={4} textAlign="center">
        <Heading size="xl">404 - Page Not Found</Heading>
        <Text color="fg.muted" maxW="md">
          The page you're looking for doesn't exist or has been moved.
        </Text>
        <Button asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </VStack>
    </Box>
  );
}

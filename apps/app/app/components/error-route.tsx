import { Center, Link, Spinner, Text } from '@chakra-ui/react';
import { CrispLink } from './crisp-link';
import { ErrorState } from './ui/empty-state';

const isModuleNotFoundError = (error: any): boolean =>
  typeof error?.message === 'string' && /Failed to fetch dynamically imported module/.test(error.message);

export const errorRoute = ({ error }: { error: any }) => {
  if (isModuleNotFoundError(error)) {
    return (
      <Center p={5}>
        <Spinner size="xl" colorPalette="purple" color="colorPalette.fg" borderWidth="2.5px" />
      </Center>
    );
  }

  return (
    <Center>
      <ErrorState
        title="Something went wrong!"
        description={
          <>
            <Text mb={2}>
              Try to{' '}
              <Link
                as="span"
                textDecor="underline"
                textUnderlineOffset="3px"
                transition="opacity 0.2s ease-in-out"
                _hover={{ opacity: 0.7 }}
                onClick={() => window.location.reload()}
              >
                refresh the page.
              </Link>
            </Text>
            <Text mb={6}>
              Please <CrispLink>reach out</CrispLink> if this error persists.
            </Text>
            {error?.message && <Text opacity={0.7}>Error Message: {error?.message}</Text>}
          </>
        }
      />
    </Center>
  );
};

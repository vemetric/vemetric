import { EmptyState as ChakraEmptyState, Icon, VStack } from '@chakra-ui/react';
import * as React from 'react';
import { TbAlertTriangle } from 'react-icons/tb';
import { CrispLink } from '../crisp-link';

export interface EmptyStateProps extends ChakraEmptyState.RootProps {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(props, ref) {
  const { title, description, icon, children, ...rest } = props;

  return (
    <ChakraEmptyState.Root ref={ref} {...rest}>
      <ChakraEmptyState.Content>
        {icon && <ChakraEmptyState.Indicator>{icon}</ChakraEmptyState.Indicator>}
        {description ? (
          <VStack textAlign="center">
            <ChakraEmptyState.Title>{title}</ChakraEmptyState.Title>
            <ChakraEmptyState.Description>{description}</ChakraEmptyState.Description>
          </VStack>
        ) : (
          <ChakraEmptyState.Title>{title}</ChakraEmptyState.Title>
        )}
        {children}
      </ChakraEmptyState.Content>
    </ChakraEmptyState.Root>
  );
});

interface ErrorStateProps {
  title: string;
  description?: React.ReactNode;
}

export const ErrorState = ({ title, description }: ErrorStateProps) => {
  return (
    <EmptyState
      icon={<Icon as={TbAlertTriangle} color="red.fg" />}
      title={title}
      description={
        description || (
          <>
            Please <CrispLink>reach out</CrispLink> if the problem persists.
          </>
        )
      }
    />
  );
};

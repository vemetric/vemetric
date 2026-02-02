import { Heading, Text, VStack } from '@chakra-ui/react';
import { BaseLayout } from './base-layout';

interface Props {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export const OnboardingLayout = (props: Props) => {
  const { icon, title, description, children } = props;

  return (
    <BaseLayout>
      <VStack flex="1" gap="8" px="4" py="16">
        {icon}
        <VStack textAlign="center">
          <Heading size="2xl">{title}</Heading>
          {description && <Text color="fg.muted">{description}</Text>}
        </VStack>
        {children}
      </VStack>
    </BaseLayout>
  );
};

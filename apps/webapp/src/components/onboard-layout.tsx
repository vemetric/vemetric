import { Heading, Text, VStack } from '@chakra-ui/react';
import { BaseLayout } from './base-layout';

interface Props {
  title: string;
  description: string;
  children: React.ReactNode;
}

export const OnboardingLayout = (props: Props) => {
  const { title, description, children } = props;

  return (
    <BaseLayout>
      <VStack flex="1" gap="8" px="4" py="16">
        <VStack textAlign="center">
          <Heading size="2xl">{title}</Heading>
          <Text color="fg.muted">{description}</Text>
        </VStack>
        {children}
      </VStack>
    </BaseLayout>
  );
};

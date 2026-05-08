import { Box, useBreakpointValue } from '@chakra-ui/react';
import { createFileRoute } from '@tanstack/react-router';
import { PageDotBackground } from '@/components/page-dot-background';
import { GlobeCanvas } from '@/components/pages/globe/globe-canvas';

export const Route = createFileRoute('/_layout/p/$projectId/globe')({
  component: RouteComponent,
});

function RouteComponent() {
  const isMobile = useBreakpointValue({ base: true, md: false }, { ssr: false });

  return (
    <>
      <PageDotBackground />
      {isMobile === undefined ? (
        <Box w="100%" h="100%" overflow="hidden" pos="relative" />
      ) : (
        <GlobeCanvas isMobile={isMobile} />
      )}
    </>
  );
}

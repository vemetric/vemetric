import { Box, Flex, Grid } from '@chakra-ui/react';
import type { PropsWithChildren } from 'react';
import React, { useEffect } from 'react';
import { TbPlugConnectedX } from 'react-icons/tb';
import { EmptyState } from '~/components/ui/empty-state';
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
  PaginationPageText,
} from '~/components/ui/pagination';
import { Skeleton } from '~/components/ui/skeleton';

export const LIST_CARD_PAGE_SIZE = 7;

interface Props {
  list?: Array<unknown>;
  page: number;
  setPage: (page: number) => void;
  emptyState: React.ReactNode;
  error: unknown;
}

export const ListCard = ({ list, page, setPage, children, emptyState, error }: PropsWithChildren<Props>) => {
  const pageCount = Math.ceil((list?.length ?? 0) / LIST_CARD_PAGE_SIZE);
  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount > 0 ? pageCount : 1);
    }
  }, [pageCount, page, setPage]);

  if (!list) {
    return (
      <Grid gridTemplateColumns="4fr 1fr 1fr" gap={2}>
        <Skeleton h="28px" />
        <Skeleton h="28px" />
        <Skeleton h="28px" />
        <Skeleton h="28px" />
        <Skeleton h="28px" />
        <Skeleton h="28px" />
      </Grid>
    );
  }

  if (list.length === 0) {
    return (
      <Flex boxSize="100%" justify="center" align="center" minH="200px">
        {emptyState}
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex boxSize="100%" justify="center" align="center">
        <EmptyState icon={<TbPlugConnectedX />} title="Error fetching data" />
      </Flex>
    );
  }

  return (
    <Flex flexGrow={1} flexDir="column" justify="space-between">
      {children}
      {pageCount > 1 && (
        <Flex asChild align="center" justify="center" mt={4} gap={0.5}>
          <PaginationRoot
            siblingCount={2}
            count={list.length}
            pageSize={LIST_CARD_PAGE_SIZE}
            page={page}
            onPageChange={(e) => setPage(e.page)}
            size="xs"
            variant="outline"
          >
            <PaginationPrevTrigger />
            <Flex hideBelow="lg" justify="center" px={1} flexWrap="wrap">
              <PaginationItems />
            </Flex>
            <Box hideFrom="lg">
              <PaginationPageText />
            </Box>
            <PaginationNextTrigger />
          </PaginationRoot>
        </Flex>
      )}
    </Flex>
  );
};

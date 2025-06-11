import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { proxy } from 'valtio';

type Breadcrumb = ReactElement | string;

export const headerStore = proxy({ breadcrumbs: [] as Array<Breadcrumb>, docsLink: null as string | null });

export const useSetBreadcrumbs = (breadcrumbs: Array<Breadcrumb>) => {
  useEffect(() => {
    headerStore.breadcrumbs = breadcrumbs;

    return () => {
      headerStore.breadcrumbs = [];
    };
  }, [breadcrumbs]);
};

export const useSetDocsLink = (link: string) => {
  useEffect(() => {
    headerStore.docsLink = link;

    return () => {
      headerStore.docsLink = null;
    };
  }, [link]);
};

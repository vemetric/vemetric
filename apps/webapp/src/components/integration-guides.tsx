import { SimpleGrid } from '@chakra-ui/react';
import {
  TbBrandAstro,
  TbBrandGoogleFilled,
  TbBrandNextjs,
  TbBrandNpm,
  TbBrandReact,
  TbCode,
  TbRegistered,
} from 'react-icons/tb';
import { DocsCard } from './docs-card';

export const IntegrationGuides = () => {
  return (
    <SimpleGrid columns={[1, 2]} gap={2.5}>
      <DocsCard
        icon={TbCode}
        title="HTML Script Tag"
        description="The simplest way to integrate Vemetric into any website."
        href="https://vemetric.com/docs/sdks/html-script"
      />
      <DocsCard
        icon={TbBrandNpm}
        title="NPM Package"
        description="For web applications, with proper TypeScript support."
        href="https://vemetric.com/docs/sdks/web-browser"
      />
      <DocsCard
        icon={TbBrandGoogleFilled}
        title="Google Tag Manager"
        description="Integrate Vemetric using Google Tag Manager."
        href="https://vemetric.com/docs/installation/google-tag-manager"
      />
      <DocsCard
        icon={TbBrandAstro}
        title="Astro"
        description="Integrate Vemetric into your Astro application"
        href="https://vemetric.com/docs/sdks/astro"
      />
      <DocsCard
        icon={TbBrandNextjs}
        title="Next.js"
        description="Integrate Vemetric into your Next.js application"
        href="https://vemetric.com/docs/installation/nextjs"
      />
      <DocsCard
        icon={TbRegistered}
        title="React Router (Remix)"
        description="Integrate Vemetric into your React Router application"
        href="https://vemetric.com/docs/installation/react-router"
      />
      <DocsCard
        icon={TbBrandReact}
        title="React"
        description="Integrate Vemetric into your React application"
        href="https://vemetric.com/docs/sdks/react"
      />
    </SimpleGrid>
  );
};

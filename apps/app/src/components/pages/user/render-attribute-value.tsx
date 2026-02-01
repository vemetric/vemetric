import { Link } from '@chakra-ui/react';
import Linkify from 'linkify-react';
import type { FC } from 'react';

interface RenderAttributeValueProps {
  value: string | number | boolean | null | undefined;
}

export const RenderAttributeValue: FC<RenderAttributeValueProps> = ({ value }) => {
  if (typeof value !== 'string') {
    const displayValue = typeof value === 'boolean' ? JSON.stringify(value) : String(value ?? '');
    return <>{displayValue}</>;
  }

  return (
    <Linkify
      options={{
        render: {
          url: ({ attributes, content }) => (
            <Link
              href={attributes.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              color="blue.fg"
              textDecoration="underline"
              outline="none"
              _hover={{ opacity: 0.7 }}
              display="inline"
            >
              {content}
            </Link>
          ),
        },
      }}
    >
      {value}
    </Linkify>
  );
};

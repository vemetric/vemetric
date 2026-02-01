import { Input, InputGroup, Button, Flex } from '@chakra-ui/react';
import { motion } from 'motion/react';
import { useRef, useState } from 'react';
import { TbSearch } from 'react-icons/tb';
import { CloseButton } from '@/components/ui/close-button';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export const SearchButtonInput = ({ value, onChange }: Props) => {
  const [_showSearch, setShowSearch] = useState(false);
  const showSearch = _showSearch || Boolean(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onChange(value);
  };

  return (
    <Flex asChild pos="relative" justify="flex-end">
      <motion.div
        initial={{ width: '34px' }}
        animate={{ width: showSearch ? 'auto' : '34px' }}
        transition={{ duration: 0.2 }}
      >
        <InputGroup
          startElement={<TbSearch />}
          endElement={
            value ? (
              <CloseButton
                size="xs"
                onClick={() => {
                  onChange('');
                }}
                me="-2"
              />
            ) : undefined
          }
          width={showSearch ? { base: 'full', md: '250px' } : '34px'}
          opacity={showSearch ? 1 : 0}
          transition="all 0.2s ease-in-out"
        >
          <Input
            ref={inputRef}
            tabIndex={showSearch ? 0 : -1}
            placeholder="Search users..."
            rounded="lg"
            value={value ?? ''}
            onChange={onSearchChange}
            size="sm"
            onFocus={() => {
              setShowSearch(true);
            }}
            onBlur={() => {
              setShowSearch(false);
            }}
          />
        </InputGroup>
        <Button
          pos="absolute"
          left="0px"
          top="1px"
          size="xs"
          variant="surface"
          boxSize="34px"
          px="0"
          tabIndex={showSearch ? -1 : 0}
          pointerEvents={showSearch ? 'none' : 'auto'}
          onFocus={() => {
            setShowSearch(true);
            inputRef.current?.focus();
          }}
          opacity={showSearch ? 0 : 1}
          transition={'all 0.2s ease-in-out'}
        >
          <TbSearch />
        </Button>
      </motion.div>
    </Flex>
  );
};

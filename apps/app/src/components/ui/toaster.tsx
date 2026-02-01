'use client';

import { Toaster as ChakraToaster, Flex, Button, Portal, Spinner, Stack, Toast, createToaster } from '@chakra-ui/react';
import { LightMode } from './color-mode';

export const toaster = createToaster({
  placement: 'bottom-end',
  pauseOnPageIdle: true,
});

export const Toaster = () => {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: '4' }}>
        {(toast) => (
          <Toast.Root width={{ md: 'sm' }}>
            <Stack gap="4">
              <Stack gap="3" direction="row">
                {toast.type === 'loading' ? <Spinner size="sm" color="blue.solid" /> : <Toast.Indicator />}
                <Stack gap="1" flex="1" maxWidth="100%">
                  {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
                  {toast.description && <Toast.Description>{toast.description}</Toast.Description>}
                </Stack>
              </Stack>
              {toast.action && (
                <LightMode>
                  <Flex justify="flex-end">
                    <Button
                      variant="solid"
                      colorPalette="gray"
                      onClick={() => {
                        toast.action?.onClick();
                        toaster.dismiss(toast.id);
                      }}
                    >
                      {toast.action.label}
                    </Button>
                  </Flex>
                </LightMode>
              )}
            </Stack>
            {toast.meta?.closable && <Toast.CloseTrigger />}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  );
};

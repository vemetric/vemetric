import { Dialog, Flex, Stack, Text, Button, CloseButton } from '@chakra-ui/react';
import { useState } from 'react';
import { TbBolt } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { toaster } from '@/components/ui/toaster';
import { Tooltip } from '@/components/ui/tooltip';
import { useOpenCrispChat } from '@/stores/crisp-chat-store';
import { authClient } from '@/utils/auth';
import { openPaddleCheckout } from '@/utils/paddle';
import { PRICING_PLANS } from '@/utils/pricing';
import { trpc } from '@/utils/trpc';
import { PricingSlider } from './pricing-slider';

interface PricingDialogProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (details: { open: boolean }) => void;
  currentPlan?: {
    pricingPlanIndex: number;
    isYearly: boolean;
  };
}

export const PricingDialog = ({ open, onOpenChange, currentPlan, organizationId }: PricingDialogProps) => {
  const openCrispChat = useOpenCrispChat();
  const { data: session } = authClient.useSession();
  const [isYearly, setIsYearly] = useState(currentPlan?.isYearly ?? false);
  const [sliderValue, setSliderValue] = useState(currentPlan?.pricingPlanIndex ?? 0);
  const [updatePreviewData, setUpdatePreviewData] = useState<{
    immediateCharge: number;
    nextBillingDate: string;
  } | null>(null);

  const { data: managmentUrls, isLoading: isManagementUrlsLoading } = trpc.billing.managmentUrls.useQuery({
    organizationId,
  });
  const { mutateAsync: mutateUpdatePreview, isLoading: isUpdatePreviewLoading } =
    trpc.billing.updatePreview.useMutation({
      onError: () => {
        toaster.error({
          title: 'Oh no an error occured. Please reach out to us.',
          description: 'No changes were made to your subscription.',
        });
      },
    });
  const { mutateAsync: mutateUpdateSubscription, isLoading: isUpdateSubscriptionLoading } =
    trpc.billing.updateSubscription.useMutation({
      onError: () => {
        toaster.error({
          title: 'Oh no an error occured while updating the subscription. Please reach out to us.',
        });
      },
    });

  const hasChanged =
    currentPlan === undefined || currentPlan.pricingPlanIndex !== sliderValue || currentPlan.isYearly !== isYearly;

  const pricingPlan = PRICING_PLANS[sliderValue];

  if (!session?.user) {
    return null;
  }

  let isDowngrade = false;
  let buttonText = 'Upgrade';
  if (currentPlan === undefined) {
    buttonText = 'Upgrade';
  } else if (sliderValue > currentPlan.pricingPlanIndex) {
    buttonText = 'Upgrade';
  } else if (sliderValue < currentPlan.pricingPlanIndex) {
    buttonText = 'Downgrade';
    isDowngrade = true;
  }

  const onOpenCheckout = () => {
    onOpenChange({ open: false });
    openPaddleCheckout({
      organizationId,
      email: session.user.email,
      pricingPlan,
      isYearly,
    });
  };

  const onUpdatePreview = async () => {
    const data = await mutateUpdatePreview({
      organizationId,
      newPriceId: isYearly ? pricingPlan.yearlyId : pricingPlan.monthlyId,
    });

    setUpdatePreviewData(data);
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content mt={10} bg="bg.card" minW={{ base: 'none', md: '550px' }}>
            <Dialog.Title p={5} borderBottom="1px solid" borderColor="gray.emphasized">
              <Flex align="center" gap={3}>
                <CardIcon>
                  <TbBolt />
                </CardIcon>
                <Text fontSize="2xl" fontWeight="semibold">
                  How many events are you going to track?
                </Text>
              </Flex>
            </Dialog.Title>
            <Dialog.Body p={5}>
              <Stack w="100%" gap={6} minH="100%">
                <PricingSlider
                  pricingPlanIndex={sliderValue}
                  setPricingPlanIndex={setSliderValue}
                  isYearly={isYearly}
                  setIsYearly={setIsYearly}
                  showYearlyToggle={!currentPlan?.isYearly}
                />

                <Stack gap={2.5}>
                  {pricingPlan.price >= 0 && !isDowngrade ? (
                    <Tooltip content={hasChanged ? '' : 'Choose a different plan to upgrade.'} disabled={hasChanged}>
                      <Button
                        py={2}
                        px={4}
                        fontSize="lg"
                        fontWeight="medium"
                        borderRadius="lg"
                        width="full"
                        colorPalette="purple"
                        disabled={!hasChanged}
                        loading={isUpdatePreviewLoading}
                        onClick={() => {
                          if (currentPlan) {
                            onUpdatePreview();
                          } else {
                            onOpenCheckout();
                          }
                        }}
                      >
                        {buttonText}
                      </Button>
                    </Tooltip>
                  ) : (
                    <Tooltip
                      content="Please contact us if you want to downgrade your subscription."
                      disabled={!isDowngrade}
                    >
                      <Button
                        py={2}
                        px={4}
                        fontSize="lg"
                        fontWeight="medium"
                        borderRadius="lg"
                        width="full"
                        colorPalette="purple"
                        textDecor="none"
                        onClick={() => {
                          onOpenChange({ open: false });
                          openCrispChat();
                        }}
                      >
                        Contact us
                      </Button>
                    </Tooltip>
                  )}
                  {currentPlan !== undefined && (
                    <>
                      <Button
                        variant="surface"
                        py={2}
                        px={4}
                        fontSize="lg"
                        fontWeight="medium"
                        borderRadius="lg"
                        width="full"
                        colorPalette="purple"
                        loading={isManagementUrlsLoading}
                        onClick={() => {
                          if (managmentUrls?.updatePaymentMethodUrl) {
                            window.open(managmentUrls.updatePaymentMethodUrl, '_blank');
                          }
                          onOpenChange({ open: false });
                        }}
                      >
                        Update payment method
                      </Button>
                      <Button
                        py={2}
                        px={4}
                        fontSize="lg"
                        fontWeight="medium"
                        borderRadius="lg"
                        width="full"
                        loading={isManagementUrlsLoading}
                        onClick={() => {
                          if (managmentUrls?.cancelSubscriptionUrl) {
                            window.open(managmentUrls.cancelSubscriptionUrl, '_blank');
                          }
                          onOpenChange({ open: false });
                        }}
                      >
                        Cancel your subscription
                      </Button>
                    </>
                  )}
                </Stack>
              </Stack>
            </Dialog.Body>
            <Dialog.CloseTrigger asChild top="0" right="0">
              <CloseButton bg="transparent" size="sm" variant="ghost" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
      {updatePreviewData && (
        <Dialog.Root
          open
          onOpenChange={({ open }) => {
            if (isUpdateSubscriptionLoading) {
              return;
            }
            setUpdatePreviewData(open ? updatePreviewData : null);
          }}
          size="sm"
        >
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content bg="bg.card">
              <Dialog.Header>
                <Dialog.Title>Are you sure?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <p>
                  You&apos;ll be charged{' '}
                  <Tooltip content="Excluding VAT (if applicable)">
                    <Text as="strong" borderBottom="2px dashed" borderColor="fg.subtle">
                      ${updatePreviewData.immediateCharge}
                    </Text>
                  </Tooltip>{' '}
                  immediately and{' '}
                  <Tooltip content="Excluding VAT (if applicable)">
                    <Text as="strong" borderBottom="2px dashed" borderColor="fg.subtle">
                      ${pricingPlan.price}
                    </Text>
                  </Tooltip>{' '}
                  every following <strong>{isYearly ? 'year' : 'month'}</strong>.
                </p>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline" disabled={isUpdateSubscriptionLoading}>
                    Cancel
                  </Button>
                </Dialog.ActionTrigger>
                <Button
                  colorPalette="purple"
                  loading={isUpdateSubscriptionLoading}
                  onClick={async () => {
                    await mutateUpdateSubscription({
                      organizationId,
                      newPriceId: isYearly ? pricingPlan.yearlyId : pricingPlan.monthlyId,
                    });
                    onOpenChange({ open: false });
                    window.location.reload();
                  }}
                >
                  Confirm
                </Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild top="0" right="0">
                <CloseButton bg="bg" size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      )}
    </>
  );
};

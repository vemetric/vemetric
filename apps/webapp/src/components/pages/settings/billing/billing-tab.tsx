import {
  Box,
  Button,
  Span,
  Text,
  FormatNumber,
  DataList,
  Card,
  Stack,
  Flex,
  AbsoluteCenter,
  Spinner,
} from '@chakra-ui/react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { addDays, format } from 'date-fns';
import { useState } from 'react';
import { TbArrowRight, TbCreditCard, TbBolt, TbLockX } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { InfoTip } from '@/components/info-tip';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { toaster } from '@/components/ui/toaster';
import { UsageCycleHistory } from '@/components/usage-cycle-history';
import { useOrganizationId } from '@/hooks/use-organization-id';
import { getPricingPlan } from '@/utils/pricing';
import { trpc } from '@/utils/trpc';
import { BillingHistory } from './billing-history';
import { PricingDialog } from './pricing-dialog';

interface Props {
  projectId: string;
}

export const BillingTab = ({ projectId }: Props) => {
  const { organizationId } = useOrganizationId(projectId);

  const { pricingDialog = false } = useSearch({ from: '/_layout/p/$projectId/settings/' });
  const navigate = useNavigate({ from: '/p/$projectId/settings' });
  const [isUndoCancellationLoading, setIsUndoCancellationLoading] = useState(false);

  const {
    data: billingInfo,
    isLoading,
    error,
  } = trpc.billing.billingInfo.useQuery({
    organizationId,
  });

  const { mutateAsync: undoCancellation } = trpc.billing.undoCancellation.useMutation({
    onError: () => {
      toaster.error({
        title: 'Oh no an error occured. Please reach out to us.',
      });
    },
  });

  const hasActiveSubscription = billingInfo?.isActive;
  const isPastDue = billingInfo?.isPastDue;
  const { pricingPlanIndex, isYearly, eventsIncluded, price, hasMultipleExceededCycles, showLimitWarning, cycles } =
    getPricingPlan(billingInfo);

  const { data: managmentUrls, isLoading: isManagementUrlsLoading } = trpc.billing.managmentUrls.useQuery(
    {
      organizationId,
    },
    { enabled: isPastDue },
  );

  if (error) {
    if (error?.data?.httpStatus === 403) {
      return (
        <EmptyState
          icon={<TbLockX />}
          title="You don't have admin access to this organization."
          description="The billing information can only be accessed by admins."
        />
      );
    }

    return <ErrorState title="Error loading billing info" />;
  }

  const nextPaymentDate = billingInfo?.subscriptionNextBilledAt;
  const hasInvoices = hasActiveSubscription;

  if (isLoading) {
    return (
      <Box h="200px" pos="relative">
        <AbsoluteCenter>
          <Spinner />
        </AbsoluteCenter>
      </Box>
    );
  }

  return (
    <Flex flexDir="column" gap={4}>
      <Text px={1} fontSize="sm" color="fg.muted">
        These Billing & Usage details count across all the projects in your Organization.
      </Text>

      <Flex flexDir="column" gap={6}>
        <Card.Root>
          <Card.Header gap="4" flexDirection={{ base: 'column', md: 'row' }} justifyContent="space-between">
            <Stack gap="0">
              <Card.Description>Current plan</Card.Description>
              <Card.Title textStyle="xl">{hasActiveSubscription ? 'Professional' : 'Free'}</Card.Title>
            </Stack>
            {!billingInfo.subscriptionEndDate && (
              <>
                {isPastDue ? (
                  <Button
                    size="sm"
                    variant="solid"
                    colorPalette="gray"
                    loading={isManagementUrlsLoading}
                    onClick={() => {
                      if (managmentUrls?.updatePaymentMethodUrl) {
                        window.open(managmentUrls.updatePaymentMethodUrl, '_blank');
                      }
                    }}
                  >
                    Update payment method
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant={hasActiveSubscription ? 'surface' : 'solid'}
                    colorPalette={hasActiveSubscription ? 'gray' : 'purple'}
                    onClick={() => {
                      navigate({ resetScroll: false, search: (prev) => ({ ...prev, pricingDialog: true }) });
                    }}
                  >
                    {hasActiveSubscription ? 'Manage subscription' : 'Upgrade'} <TbArrowRight />
                  </Button>
                )}
              </>
            )}
          </Card.Header>
          <Card.Body>
            {isPastDue && (
              <Text textStyle="sm" color="fg.error" mb={4}>
                Your subscription is past due. Please make sure your payment method is up to date to continue using
                Vemetric.
              </Text>
            )}
            <DataList.Root orientation="horizontal">
              <DataList.Item justifyContent="space-between">
                <DataList.ItemLabel>Included Events</DataList.ItemLabel>
                <DataList.ItemValue flex="unset" gap="0.5" alignItems="flex-end">
                  <FormatNumber value={eventsIncluded} />
                  <Span color="fg.muted" fontSize="xs">
                    /month
                  </Span>
                </DataList.ItemValue>
              </DataList.Item>

              <DataList.Item justifyContent="space-between">
                <DataList.ItemLabel>Pricing</DataList.ItemLabel>
                <DataList.ItemValue flex="unset" gap="0.5" alignItems="flex-end">
                  <FormatNumber
                    value={hasActiveSubscription ? (isYearly ? price * 10 : price) : 0}
                    currency="USD"
                    style="currency"
                    maximumFractionDigits={0}
                  />
                  <Span color="fg.muted" fontSize="xs">
                    /{hasActiveSubscription && isYearly ? 'year' : 'month'}
                  </Span>
                </DataList.ItemValue>
              </DataList.Item>

              {hasActiveSubscription && !billingInfo.subscriptionEndDate && (
                <DataList.Item justifyContent="space-between">
                  <DataList.ItemLabel>Next billing date</DataList.ItemLabel>
                  <DataList.ItemValue flex="unset">
                    <Text>{nextPaymentDate ? format(nextPaymentDate, 'MMMM d, yyyy') : 'N/A'}</Text>
                  </DataList.ItemValue>
                </DataList.Item>
              )}
            </DataList.Root>

            {billingInfo.subscriptionEndDate && (
              <Flex gap={2} alignItems="center" flexWrap="wrap" mt={4}>
                <Text textStyle="xs" color="fg.error">
                  Your subscription will be cancelled on {format(billingInfo.subscriptionEndDate, 'MMMM d, yyyy')}.
                </Text>
                <Button
                  variant="surface"
                  size="2xs"
                  loading={isUndoCancellationLoading}
                  onClick={async () => {
                    setIsUndoCancellationLoading(true);
                    try {
                      await undoCancellation({
                        organizationId,
                      });
                      window.location.reload();
                    } catch {
                      setIsUndoCancellationLoading(false);
                    }
                  }}
                >
                  Undo cancellation
                </Button>
              </Flex>
            )}
          </Card.Body>
        </Card.Root>

        <Card.Root size="sm">
          <Card.Header>
            <Flex align="center" gap={2}>
              <CardIcon>
                <TbBolt />
              </CardIcon>
              <Text fontWeight="semibold">Usage</Text>
              {showLimitWarning && (
                <InfoTip
                  content={
                    <>
                      <Text maxW={hasMultipleExceededCycles ? '260px' : undefined} mb="1.5">
                        You have {hasMultipleExceededCycles ? 'repeatedly ' : ''}exceeded your included events limit.
                      </Text>
                      <Text maxW={hasMultipleExceededCycles ? '260px' : undefined}>
                        Please upgrade to a higher plan.
                      </Text>
                    </>
                  }
                  colorPalette="red"
                />
              )}
              <Box flexGrow={1} />
              {showLimitWarning && (
                <Button
                  size="xs"
                  variant="subtle"
                  colorPalette="red"
                  onClick={() => {
                    navigate({ resetScroll: false, search: (prev) => ({ ...prev, pricingDialog: true }) });
                  }}
                >
                  Upgrade
                </Button>
              )}
            </Flex>
          </Card.Header>
          <Card.Body alignItems="flex-start" gap="4">
            <UsageCycleHistory cycles={cycles} eventsIncluded={eventsIncluded} />
            {cycles[0] && (
              <Text textStyle="xs" color="fg.muted" textWrap="balance">
                The current usage cycle resets on {format(addDays(cycles[0].usage.periodEnd, 1), 'MMMM d, yyyy')}.
              </Text>
            )}
          </Card.Body>
        </Card.Root>

        {hasInvoices && (
          <Card.Root>
            <Card.Header>
              <Flex align="center" gap={2}>
                <CardIcon>
                  <TbCreditCard />
                </CardIcon>
                <Text fontWeight="semibold">Billing History</Text>
              </Flex>
            </Card.Header>
            <Card.Body overflow="auto">
              <BillingHistory organizationId={organizationId} />
            </Card.Body>
          </Card.Root>
        )}

        {pricingDialog && (
          <PricingDialog
            open
            onOpenChange={({ open }) =>
              navigate({ resetScroll: false, search: (prev) => ({ ...prev, pricingDialog: open ? true : undefined }) })
            }
            currentPlan={hasActiveSubscription ? { pricingPlanIndex, isYearly } : undefined}
            organizationId={organizationId}
          />
        )}
      </Flex>
    </Flex>
  );
};

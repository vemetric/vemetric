import { Box, Slider, Stack, Flex, Switch, Text } from '@chakra-ui/react';
import { formatNumber } from '@vemetric/common/math';
import { motion } from 'motion/react';
import { TbRocket } from 'react-icons/tb';
import { Tooltip } from '~/components/ui/tooltip';
import { PRICING_PLANS } from '~/utils/pricing';

interface Props {
  pricingPlanIndex: number;
  setPricingPlanIndex: (value: number) => void;
  showYearlyToggle?: boolean;
  isYearly: boolean;
  setIsYearly: (isYearly: boolean) => void;
}

export const PricingSlider = ({
  pricingPlanIndex,
  setPricingPlanIndex,
  showYearlyToggle = true,
  isYearly,
  setIsYearly,
}: Props) => {
  const pricingPlan = PRICING_PLANS[pricingPlanIndex];
  const currentEvents = pricingPlan.events;
  const currentPrice = pricingPlan.price < 0 ? -1 : pricingPlan.price * (isYearly ? 10 : 1);

  return (
    <Stack gap={5} flex="1">
      {showYearlyToggle && (
        <Flex flexDir="column" gap={2} justifyContent="flex-end">
          <Flex as="label" justifyContent="flex-end" alignItems="center" gap={2}>
            <Text fontSize="sm">Monthly</Text>
            <Switch.Root checked={isYearly} onCheckedChange={({ checked }) => setIsYearly(checked)}>
              <Switch.HiddenInput />
              <Switch.Control bg={isYearly ? 'purple.500' : 'gray.emphasized'}>
                <Switch.Thumb bg="white" />
              </Switch.Control>
            </Switch.Root>
            <Text fontSize="sm">Yearly</Text>
          </Flex>
          <motion.div
            initial={{ height: isYearly ? 'auto' : 0 }}
            animate={{ height: isYearly ? 'auto' : 0 }}
            style={{ overflow: 'hidden' }}
          >
            <Text textStyle="xs" color="purple.fg" textAlign="right">
              2 months off
            </Text>
          </motion.div>
        </Flex>
      )}

      <Slider.Root
        min={0}
        max={7}
        step={1}
        value={[pricingPlanIndex]}
        onValueChange={({ value }) => {
          setPricingPlanIndex(value[0]);
        }}
        colorPalette="purple"
        size="sm"
      >
        <Slider.Control>
          <Slider.Marks
            marks={PRICING_PLANS.map((plan, index) => ({
              value: index,
              label: plan.price < 0 ? <TbRocket /> : formatNumber(plan.events, true),
            }))}
          />
          <Slider.Track bg="gray.emphasized">
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumbs bg="purple.500" borderColor="purple.200" />
        </Slider.Control>
      </Slider.Root>

      <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
        <Box lineHeight="1.25">
          <Text fontSize="3xl" fontWeight="medium">
            {currentEvents.toLocaleString()}
            {currentPrice < 0 && '+'}
          </Text>
          <Text fontSize="xl" color="fg.muted">
            <Tooltip content="Pageviews + Custom Events">
              <Text as="span" borderBottom="2px dashed" borderColor="fg.subtle">
                events
              </Text>
            </Tooltip>{' '}
            per month
          </Text>
        </Box>

        {currentPrice >= 0 && (
          <Stack gap={1} align="flex-end">
            <Flex align="flex-end" gap={1}>
              <Text fontSize="4xl" lineHeight={1} fontWeight="medium">
                ${currentPrice}
              </Text>
              <Text fontSize="lg" color="fg.muted">
                /{isYearly ? 'year' : 'month'}
              </Text>
            </Flex>
            <Text fontSize="sm" color="fg.muted">
              + VAT if applicable
            </Text>
          </Stack>
        )}
      </Flex>
    </Stack>
  );
};

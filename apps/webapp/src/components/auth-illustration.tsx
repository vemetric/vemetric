import { Icon, Center, Text } from '@chakra-ui/react';
import { motion } from 'motion/react';

export const AuthIllustration = () => {
  return (
    <Center color="white" w="full" h="full" bg="linear-gradient(to top, #7232F5, #A086FF)" flexDir="column" gap="6">
      <Icon asChild transform="translateX(-10px)" mb={4} css={{ rect: { transformBox: 'fill-box' } }}>
        <svg width="300" viewBox="0 0 402 244" fill="none" xmlns="http://www.w3.org/2000/svg">
          <motion.rect
            opacity="0.68"
            x="0.5"
            y="155.5"
            width="69"
            height="88"
            rx="19.5"
            fill="url(#paint0_linear_64_2)"
            stroke="#94B9E0"
            initial={{ scaleY: 0, originX: '50%', originY: '100%' }}
            animate={{ scaleY: 1, originX: '50%', originY: '100%', transition: { duration: 0.6, delay: 0.2 } }}
          />
          <motion.rect
            opacity="0.91"
            x="83.5"
            y="108.5"
            width="69"
            height="135"
            rx="19.5"
            fill="url(#paint3_linear_64_2)"
            stroke="#94B9E0"
            initial={{ scaleY: 0, originX: '50%', originY: '100%' }}
            animate={{ scaleY: 1, originX: '50%', originY: '100%', transition: { duration: 0.6, delay: 0.6 } }}
          />
          <motion.rect
            x="166.75"
            y="0.75"
            width="68.5"
            height="242.5"
            rx="19.25"
            fill="url(#paint4_linear_64_2)"
            stroke="#94B9E0"
            strokeWidth="1.5"
            initial={{ scaleY: 0, originX: '50%', originY: '100%' }}
            animate={{ scaleY: 1, originX: '50%', originY: '100%', transition: { duration: 0.6, delay: 1 } }}
          />
          <motion.rect
            opacity="0.87"
            x="249.5"
            y="41.5"
            width="69"
            height="202"
            rx="19.5"
            fill="url(#paint2_linear_64_2)"
            stroke="#94B9E0"
            initial={{ scaleY: 0, originX: '50%', originY: '100%' }}
            animate={{ scaleY: 1, originX: '50%', originY: '100%', transition: { duration: 0.6, delay: 1.4 } }}
          />
          <motion.rect
            opacity="0.82"
            x="332.5"
            y="87.5"
            width="69"
            height="155"
            rx="19.5"
            fill="url(#paint1_linear_64_2)"
            stroke="#94B9E0"
            initial={{ scaleY: 0, originX: '50%', originY: '100%' }}
            animate={{ scaleY: 1, originX: '50%', originY: '100%', transition: { duration: 0.6, delay: 1.8 } }}
          />
          <defs>
            <linearGradient
              id="paint0_linear_64_2"
              x1="27.451"
              y1="155"
              x2="77.4324"
              y2="239.609"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#8DA9FF" />
              <stop offset="1" stopColor="#5C4CE7" />
            </linearGradient>
            <linearGradient
              id="paint1_linear_64_2"
              x1="359.451"
              y1="87"
              x2="459.419"
              y2="183.546"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#8DA9FF" />
              <stop offset="1" stopColor="#5C4CE7" />
            </linearGradient>
            <linearGradient
              id="paint2_linear_64_2"
              x1="276.451"
              y1="41"
              x2="401.037"
              y2="133.464"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#8DA9FF" />
              <stop offset="1" stopColor="#5C4CE7" />
            </linearGradient>
            <linearGradient
              id="paint3_linear_64_2"
              x1="110.451"
              y1="108"
              x2="197.2"
              y2="204.101"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#8DA9FF" />
              <stop offset="1" stopColor="#5C4CE7" />
            </linearGradient>
            <linearGradient
              id="paint4_linear_64_2"
              x1="193.451"
              y1="-4.56682e-07"
              x2="333.33"
              y2="86.3701"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#8DA9FF" />
              <stop offset="1" stopColor="#5C4CE7" />
            </linearGradient>
          </defs>
        </svg>
      </Icon>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.3 } }}
      >
        <Text fontWeight="bold" fontSize="4xl" lineHeight="1.4em" maxW="500px" textAlign="center">
          Simple, yet powerful Web & Product Analytics
        </Text>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.6, delay: 2 } }}
      >
        <Text fontSize="1.65rem" lineHeight="1.4em" maxW="500px" textAlign="center">
          Combined to understand your users
        </Text>
      </motion.div>
    </Center>
  );
};

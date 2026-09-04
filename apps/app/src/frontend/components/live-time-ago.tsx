import { Span } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { dateTimeFormatter } from '@/utils/date-time-formatter';

let now = Date.now();
let intervalId: number | null = null;
const subscribers = new Set<() => void>();

function subscribe(callback: () => void) {
  subscribers.add(callback);

  if (intervalId === null) {
    now = Date.now();
    intervalId = window.setInterval(() => {
      now = Date.now();
      subscribers.forEach((subscriber) => subscriber());
    }, 1000);
  }

  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };
}

const doNotSubscribe = () => () => undefined;
const getNow = () => now;

interface Props {
  value: string | Date;
  active?: boolean;
  format?: 'distance' | 'duration';
  suffix?: ReactNode;
}

export const LiveTimeAgo = ({
  value,
  active = true,
  format = 'distance',
  suffix = <Span hideBelow="md">ago</Span>,
}: Props) => {
  const currentNow = useSyncExternalStore(active ? subscribe : doNotSubscribe, getNow, getNow);
  const formattedTime =
    format === 'duration'
      ? dateTimeFormatter.formatDurationBetween(value, new Date(currentNow))
      : dateTimeFormatter.formatDistance(value, new Date(currentNow), true);

  return (
    <>
      {formattedTime}
      {suffix && <> {suffix}</>}
    </>
  );
};

export const EventNames = {
  PageView: '$$pageView',
  OutboundLink: '$$outboundLink',
};

export function getEventName(name: string) {
  if (name === EventNames.OutboundLink) {
    return 'Outbound Link';
  } else if (name === EventNames.PageView) {
    return 'Page View';
  }
  return name;
}

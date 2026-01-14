import { Section, Text } from '@react-email/components';
import { anchorStyle, BaseTemplate, textStyle } from './base-template';

interface Props {
  userName?: string | null;
}

export const SubscriptionCancelledMail = ({ userName }: Props) => {
  const greeting = userName ? `Hey ${userName}` : 'Hey';

  return (
    <BaseTemplate previewText="I'm sad to see you go">
      <Section>
        <Text style={textStyle}>{greeting},</Text>
        <Text style={textStyle}>
          I'm sad to see you go, but I'm also grateful that you gave Vemetric a try and were part of the journey!
        </Text>
        <Text style={textStyle}>
          I'd love to understand what led to your decision - your feedback would really help me improve the product.
          Even just a quick note about why you cancelled would mean a lot.
        </Text>
        <Text style={textStyle}>
          You can simply reply to this email - I read every response personally. If you'd prefer to chat, feel free to{' '}
          <a href="https://seriouscode.io/call/dominik" style={anchorStyle}>
            schedule a quick call
          </a>{' '}
          with me instead.
        </Text>
        <Text style={textStyle}>Thank you, and I hope our paths cross again in the future!</Text>
      </Section>
    </BaseTemplate>
  );
};

SubscriptionCancelledMail.PreviewProps = {
  userName: 'John',
} as Props;

export default SubscriptionCancelledMail;

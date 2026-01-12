import { Button, Section, Text } from '@react-email/components';
import { anchorStyle, BaseTemplate, buttonStyle, textStyle } from './base-template';

interface Props {
  userName?: string | null;
}

export const SubscriptionCancelledMail = ({ userName }: Props) => {
  const greeting = userName ? `Hey ${userName}` : 'Hey there';

  return (
    <BaseTemplate previewText="We're sorry to see you go">
      <Section>
        <Text style={textStyle}>{greeting},</Text>
        <Text style={textStyle}>
          I noticed you've cancelled your Vemetric subscription. I'm really sorry to see you go.
        </Text>
        <Text style={textStyle}>
          Your feedback is incredibly valuable to me, and I'd love to understand what led to your decision. Could you
          take a moment to share:
        </Text>
        <Text style={textStyle}>
          - What made you decide to cancel?
          <br />
          - Was there a feature you were missing?
          <br />
          - Is there anything I could have done better?
          <br />- Would you consider coming back if certain things changed?
        </Text>
        <Text style={textStyle}>
          You can simply reply to this email - I read every response personally and take all feedback seriously.
        </Text>
        <Text style={textStyle}>
          If you'd prefer to chat, feel free to{' '}
          <a href="https://seriouscode.io/call/dominik" style={anchorStyle}>
            schedule a quick call
          </a>{' '}
          with me.
        </Text>
        <Button style={buttonStyle} href="mailto:info@vemetric.com?subject=Cancellation%20Feedback">
          Share Your Feedback
        </Button>
        <Text style={textStyle}>
          Thank you for giving Vemetric a try. I hope our paths cross again in the future!
        </Text>
      </Section>
    </BaseTemplate>
  );
};

SubscriptionCancelledMail.PreviewProps = {
  userName: 'John',
} as Props;

export default SubscriptionCancelledMail;

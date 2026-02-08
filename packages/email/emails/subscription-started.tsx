import { Button, Section, Text } from '@react-email/components';
import { anchorStyle, BaseTemplate, buttonStyle, textStyle } from './base-template';

interface Props {
  userName?: string | null;
}

export const SubscriptionStartedMail = ({ userName }: Props) => {
  const greeting = userName ? `Hey ${userName}` : 'Hey';

  return (
    <BaseTemplate previewText="Welcome to Vemetric Pro!">
      <Section>
        <Text style={textStyle}>{greeting},</Text>
        <Text style={textStyle}>Thanks for subscribing to Vemetric Pro! I’m excited to help you get more value from your product analytics.</Text>
        <Text style={textStyle}>Here are a few quick tips to get the most out of your subscription:</Text>
        <Text style={textStyle}>
          • Add your first project and install the tracking snippet (it takes just a minute). You’ll start seeing events immediately.
        </Text>
        <Text style={textStyle}>
          • Define 2–3 key events you care about (signup, checkout, upgrade) so your dashboard stays focused.
        </Text>
        <Text style={textStyle}>
          • Invite teammates so everyone can use the insights and build a shared analytics culture.
        </Text>
        <Text style={textStyle}>
          You can find step-by-step setup guides in the{' '}
          <a href="https://vemetric.com/docs/installation?utm_campaign=subscription-started" style={anchorStyle}>
            documentation
          </a>
          .
        </Text>
        <Button style={buttonStyle} href="https://app.vemetric.com?utm_campaign=subscription-started">
          Open Vemetric
        </Button>
        <Text style={textStyle}>If you need help, just reply to this email — I read every response.</Text>
      </Section>
    </BaseTemplate>
  );
};

SubscriptionStartedMail.PreviewProps = {
  userName: 'John',
} as Props;

export default SubscriptionStartedMail;

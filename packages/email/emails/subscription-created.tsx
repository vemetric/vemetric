import { Section, Text } from '@react-email/components';
import { BaseTemplate, textStyle } from './base-template';

interface Props {
  userName?: string | null;
}

export const SubscriptionCreatedMail = ({ userName }: Props) => {
  const greeting = userName ? `Hey ${userName}` : 'Hey';

  return (
    <BaseTemplate previewText="If you have any questions, please reach out to me.">
      <Section>
        <Text style={textStyle}>{greeting},</Text>
        <Text style={textStyle}>
          Thanks for subscribing to Vemetric Pro! I’m happy that you decided to support Vemetric and use it as your
          analytics solution.
        </Text>
        <Text style={textStyle}>
          If you run into any questions, or if there’s something missing that would make it more useful for you, please
          don't hesitate to reach out.
        </Text>
        <Text style={textStyle}>
          I’m actively working on improving Vemetric, making it easier to use and helping you understand and act on your
          analytics data, so your feedback is genuinely valuable to me.
        </Text>
        <Text style={textStyle}>
          Thanks again for choosing Vemetric.
          <br />
          I’m excited to see what you build with it!
        </Text>
      </Section>
    </BaseTemplate>
  );
};

SubscriptionCreatedMail.PreviewProps = {
  userName: 'John',
} as Props;

export default SubscriptionCreatedMail;

import { Section, Text } from '@react-email/components';
import { anchorStyle, BaseTemplate, textStyle } from '../../base-template';

interface Props {
  userName?: string | null;
  unsubscribeLink: string;
}

export const FirstEventFeedbackMail = ({ userName, unsubscribeLink }: Props) => {
  const greeting = userName ? `Hey ${userName}` : 'Hey there';

  return (
    <BaseTemplate previewText="I'd love to hear your feedback" unsubscribeLink={unsubscribeLink}>
      <Section>
        <Text style={textStyle}>{greeting},</Text>
        <Text style={textStyle}>It's been a week since you started tracking events with Vemetric! 🎉</Text>
        <Text style={textStyle}>
          As I'm constantly trying to improve Vemetric, I have a <strong>few quick questions</strong>:
        </Text>
        <Text style={textStyle}>
          • How are you liking Vemetric so far?
          <br />
          • Are you missing any features?
          <br />• Any open questions or other feedback you'd like to share?
        </Text>
        <Text style={textStyle}>
          You can reply directly to this email or we could also{' '}
          <a href={`https://seriouscode.io/call/dominik`} style={anchorStyle}>
            schedule a call
          </a>{' '}
          if you want to discuss things in detail.
        </Text>
        <Text style={textStyle}>
          Thanks for using Vemetric!
          <br />
          Dominik
        </Text>
      </Section>
    </BaseTemplate>
  );
};

FirstEventFeedbackMail.PreviewProps = {
  userName: 'John',
  projectName: 'snappify',
  unsubscribeLink: 'https://app.vemetric.com/email/unsubscribe?token=123',
} as Props;

export default FirstEventFeedbackMail;

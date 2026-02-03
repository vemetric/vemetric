import { Button, Section, Text } from '@react-email/components';
import { BaseTemplate, buttonStyle, textStyle } from '../../base-template';

interface Props {
  userName?: string | null;
  projectId: string;
  projectName: string;
  unsubscribeLink: string;
}

export const NoEventsSecondMail = ({ userName, projectName, unsubscribeLink }: Props) => {
  const greeting = userName ? `Hey ${userName}` : 'Hey there';

  return (
    <BaseTemplate previewText="Book a call and I'll help you with the integration" unsubscribeLink={unsubscribeLink}>
      <Section>
        <Text style={textStyle}>{greeting},</Text>
        <Text style={textStyle}>
          A few days ago, I sent you an email including installation guides for Vemetric to setup your new project{' '}
          <strong>{projectName}</strong>. I'd be happy to schedule a call to help you get everything set up.
        </Text>
        <Text style={textStyle}>
          On the call, we can:
          <br />
          - Walk through the setup process together
          <br />
          - Answer any questions you have about Vemetric
          <br />- Help you plan your analytics strategy
        </Text>
        <Button style={buttonStyle} href="https://seriouscode.io/call/dominik">
          Book a setup call
        </Button>
        <Text style={textStyle}>Or just reply to this email with any questions you have.</Text>
      </Section>
    </BaseTemplate>
  );
};

NoEventsSecondMail.PreviewProps = {
  userName: 'John',
  projectName: 'My Awesome App',
  unsubscribeLink: 'https://app.vemetric.com/_api/email/unsubscribe?token=123',
} as Props;

export default NoEventsSecondMail;

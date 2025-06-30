import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
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
          <strong>{projectName}</strong>. I realize that sometimes it's easier to just do a quick call and get
          everything working together.
        </Text>
        <Text style={textStyle}>
          If you're still having trouble or would prefer some personal guidance, I'd be happy to schedule call to help
          you get your tracking set up.
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
  unsubscribeLink: 'https://backend.vemetric.com/email/unsubscribe?token=123',
} as Props;

export default NoEventsSecondMail;

import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { BaseTemplate, buttonStyle, textStyle, anchorStyle } from '../../base-template';

interface Props {
  userName?: string | null;
  unsubscribeLink: string;
}

export const NoProjectSecondMail = ({ userName, unsubscribeLink }: Props) => {
  const greeting = userName ? `Hey ${userName}` : 'Hey there';

  return (
    <BaseTemplate previewText="Book a call and I'll help you with the integration" unsubscribeLink={unsubscribeLink}>
      <Section>
        <Text style={textStyle}>{greeting},</Text>
        <Text style={textStyle}>
          A few days ago, I reached out about creating your first project in Vemetric. Are there any specific questions
          you have about Vemetric?
        </Text>
        <Text style={textStyle}>
          We can schedule a call to:
          <br />
          - Create your project together, I'll walk you through the setup
          <br />
          - Integrate it into your application
          <br />- Plan your analytics strategy, and go through open questions
        </Text>
        <Button style={buttonStyle} href="https://seriouscode.io/call/dominik">
          Book a call
        </Button>
        <Text style={textStyle}>
          Or{' '}
          <a href="https://app.vemetric.com?utm_campaign=no-project&utm_content=second" style={anchorStyle}>
            create your project now
          </a>{' '}
          and reply to this email if you have any questions!
        </Text>
      </Section>
    </BaseTemplate>
  );
};

NoProjectSecondMail.PreviewProps = {
  userName: 'John',
  unsubscribeLink: 'https://backend.vemetric.com/email/unsubscribe?token=123',
} as Props;

export default NoProjectSecondMail;

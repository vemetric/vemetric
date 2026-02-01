import { Button, Section, Text } from '@react-email/components';
import { anchorStyle, BaseTemplate, buttonStyle, textStyle } from '../../base-template';

interface Props {
  userName?: string | null;
  unsubscribeLink: string;
}

export const NoProjectFirstMail = ({ userName, unsubscribeLink }: Props) => {
  const greeting = userName ? `Hey ${userName}` : 'Hey there';

  return (
    <BaseTemplate previewText="Integrate Vemetric and gain valuable insights" unsubscribeLink={unsubscribeLink}>
      <Section>
        <Text style={textStyle}>{greeting}, welcome to Vemetric!</Text>
        <Text style={textStyle}>
          I noticed you signed up but haven't created your first project yet. Creating a project is the first step to
          start tracking your website and app analytics.
        </Text>
        <Text style={textStyle}>
          It takes less than a minute and with our{' '}
          <a
            href={`https://vemetric.com/docs/installation?utm_campaign=no-project&utm_content=first`}
            style={anchorStyle}
          >
            installation guides
          </a>{' '}
          you can integrate Vemetric in no time!
        </Text>
        <Button style={buttonStyle} href="https://app.vemetric.com?utm_campaign=no-project&utm_content=first">
          Create Your First Project
        </Button>
        <Text style={textStyle}>Need help or have any questions? Just reply to this email!</Text>
      </Section>
    </BaseTemplate>
  );
};

NoProjectFirstMail.PreviewProps = {
  userName: 'John',
  unsubscribeLink: 'https://app.vemetric.com/email/unsubscribe?token=123',
} as Props;

export default NoProjectFirstMail;

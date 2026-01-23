import { Button, Section, Text } from '@react-email/components';
import { BaseTemplate, buttonStyle, textStyle } from './base-template';

interface Props {
  verificationLink: string;
}

export const EmailChangeMail = ({ verificationLink }: Props) => {
  return (
    <BaseTemplate previewText="Hey, please confirm your new email address.">
      <Section>
        <Text style={textStyle}>Hey, please verify your new email address by clicking the button below:</Text>
        <Button style={buttonStyle} href={verificationLink}>
          Verify your email address
        </Button>
        <Text style={textStyle}>
          Please don&apos;t hesitate to reach out if something is unclear or you have any questions.
        </Text>
        <Text style={textStyle}>If you didn&apos;t request this change, you can safely ignore this email.</Text>
      </Section>
    </BaseTemplate>
  );
};

EmailChangeMail.PreviewProps = {
  verificationLink: 'https://vemetric.com',
} as Props;

export default EmailChangeMail;

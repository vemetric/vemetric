import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { BaseTemplate, buttonStyle, textStyle } from './base-template';

interface Props {
  verificationLink: string;
}

export const EmailVerificationMail = ({ verificationLink }: Props) => {
  return (
    <BaseTemplate previewText="Hey, thanks for signing up for Vemetric!">
      <Section>
        <Text style={textStyle}>Hey, thanks for signing up for Vemetric!</Text>
        <Text style={textStyle}>
          Please verify your email address by clicking the button below to continue your journey:
        </Text>
        <Button style={buttonStyle} href={verificationLink}>
          Verify your email address
        </Button>
        <Text style={textStyle}>
          I hope that the onboarding process is clear and easy to follow, but please don&apos;t hesitate to reach out if
          you have any questions.
        </Text>
      </Section>
    </BaseTemplate>
  );
};

EmailVerificationMail.PreviewProps = {
  verificationLink: 'https://vemetric.com',
} as Props;

export default EmailVerificationMail;

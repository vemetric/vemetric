import { Link, Section, Text } from '@react-email/components';
import { BaseTemplate, anchorStyle, textStyle } from './base-template';

interface Props {
  verificationLink: string;
  verificationCode?: string;
}

const codeStyle = {
  margin: '18px 0',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#f8fafc',
  padding: '12px 16px',
  letterSpacing: '6px',
  fontSize: '30px',
  fontWeight: '700',
  textAlign: 'center' as const,
  color: '#1a202c',
};

export const EmailVerificationMail = ({ verificationLink, verificationCode }: Props) => {
  return (
    <BaseTemplate previewText="Hey, thanks for signing up for Vemetric!">
      <Section>
        <Text style={textStyle}>Hey, thanks for signing up for Vemetric!</Text>
        <Text style={textStyle}>Please verify your email address with this 6-digit code:</Text>
        <Text style={codeStyle}>{verificationCode ?? '------'}</Text>
        <Text style={textStyle}>
          Or open this{' '}
          <Link href={verificationLink} style={anchorStyle}>
            verification link
          </Link>
          .
        </Text>
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
  verificationCode: '123456',
} as Props;

export default EmailVerificationMail;

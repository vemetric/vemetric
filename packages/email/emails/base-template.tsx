import { Body, Column, Container, Head, Html, Img, Link, Preview, Row, Section, Text } from '@react-email/components';

export const baseUrl = 'https://vemetric.com';

interface Props {
  children: React.ReactNode;
  previewText: string;
  unsubscribeLink?: string;
}

export const BaseTemplate = ({ children, previewText, unsubscribeLink }: Props) => {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          <Img src={`${baseUrl}/images/logo.png`} width="40" height="40" alt="Vemetric Logo" />
          {children}
          <Section style={{ margin: '25px 0px', marginBottom: '0px', width: 'auto' }}>
            <Row>
              <Column>
                <Img src="https://cdn.snappi.fyi/dominik3.png" width="75" height="75" alt="Avatar of Dominik" />
              </Column>
              <Column>
                <Text style={{ margin: '0px 15px' }}>
                  Best regards,
                  <br />
                  Dominik
                  <br />
                  <span style={{ color: '#666666' }}>Founder of Vemetric</span>
                </Text>
              </Column>
            </Row>
          </Section>
        </Container>
        <Section>
          <Text style={{ ...footerStyle, marginBottom: '0px' }}>
            &copy;{' '}
            <Link style={blackStyle} href="https://vemetric.com">
              Vemetric
            </Link>{' '}
            - All rights reserved.
          </Text>
          <Text style={{ ...footerStyle, marginTop: '10px', lineHeight: '1.5em' }}>
            seriouscode GmbH
            <br />
            Stockerauer Straße 181, 2100 Korneuburg
            <br />
            Austria
          </Text>
          {unsubscribeLink && (
            <Text style={{ ...footerStyle, marginTop: '20px', fontSize: '12px', lineHeight: '1.5em' }}>
              Don't want to receive these emails?
              <br />
              <Link style={anchorStyle} href={unsubscribeLink}>
                Unsubscribe here
              </Link>
            </Text>
          )}
        </Section>
      </Body>
    </Html>
  );
};

BaseTemplate.PreviewProps = {
  children: <>test</>,
  previewText: 'test',
} as Props;

export default BaseTemplate;

const mainStyle = {
  backgroundColor: '#f6f9fc',
  padding: '10px 0',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
};

const containerStyle = {
  backgroundColor: '#ffffff',
  padding: '45px',
  borderRadius: '10px',
};

export const textStyle = {
  fontSize: '16px',
  fontFamily:
    "'Open Sans', 'HelveticaNeue-Light', 'Helvetica Neue Light', 'Helvetica Neue', Helvetica, Arial, 'Lucida Grande', sans-serif",
  fontWeight: '300',
  color: '#404040',
  lineHeight: '26px',
};

export const buttonStyle = {
  backgroundColor: '#8458fd',
  borderRadius: '6px',
  color: '#fff',
  fontFamily: "'Open Sans', 'Helvetica Neue', Arial",
  fontSize: '15px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: 'auto',
  padding: '12px 7px',
};

export const anchorStyle = {
  textDecoration: 'underline',
  color: '#8458fd',
};

const blackStyle = {
  color: '#000',
};

const footerStyle = {
  color: '#666666',
  fontSize: '13px',
  textAlign: 'center' as const,
};

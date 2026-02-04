import { Button, Section, Text } from '@react-email/components';
import { BaseTemplate, buttonStyle, textStyle } from './base-template';

interface Props {
  userName: string;
  projectName: string;
  projectDomain: string;
  confirmationLink: string;
}

export const ProjectDeletionMail = ({ userName, projectName, projectDomain, confirmationLink }: Props) => {
  return (
    <BaseTemplate previewText={`Confirm deletion of ${projectName}`}>
      <Section>
        <Text style={textStyle}>Hey {userName},</Text>
        <Text style={textStyle}>
          A deletion request was initiated for the project <strong>{projectName}</strong> ({projectDomain}).
        </Text>
        <Text style={textStyle}>
          This action will <strong>permanently delete</strong> all data associated with this project and cannot be
          undone.
        </Text>
        <Text style={textStyle}>If this was you, click the button below to confirm the deletion:</Text>
        <Button style={{ ...buttonStyle, backgroundColor: '#dc2626' }} href={confirmationLink}>
          Confirm Deletion
        </Button>
        <Text style={{ ...textStyle, marginTop: '24px', fontSize: '14px', color: '#666666' }}>
          This link will expire in 1 hour. If you did not request this deletion, you can safely ignore this email.
        </Text>
      </Section>
    </BaseTemplate>
  );
};

ProjectDeletionMail.PreviewProps = {
  userName: 'John',
  projectName: 'My Project',
  projectDomain: 'example.com',
  confirmationLink: 'https://app.vemetric.com/email/confirm-project-deletion?token=abc123',
} as Props;

export default ProjectDeletionMail;

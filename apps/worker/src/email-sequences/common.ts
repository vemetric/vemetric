import { type EmailDripSequence, type Project } from 'database';

export type SequenceResult = { skipped: true } | { success: boolean; response: { MessageID: string; Message: string } };

export type SequenceContext = {
  project?: Project;
  user: { id: string; name?: string | null; email: string };
  unsubscribeLink: string;
  sequence: EmailDripSequence;
  stepNumber: number;
};

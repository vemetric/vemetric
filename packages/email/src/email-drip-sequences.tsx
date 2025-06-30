import type { DripSequenceType } from 'database';

export interface DripSequenceStep {
  delayHours: number; // Hours after previous step (or enrollment for step 1)
}

export interface DripSequenceDefinition {
  type: DripSequenceType; // Unique identifier for this sequence
  steps: DripSequenceStep[];
}

// Registry of all available drip sequences
const DRIP_SEQUENCES: Record<DripSequenceType, DripSequenceDefinition> = {
  NO_EVENTS: {
    type: 'NO_EVENTS',
    steps: [
      {
        delayHours: 48, // 48 hours after creating the project
      },
      {
        delayHours: 72, // 72 hours after step 1
      },
    ],
  },
  NO_PROJECT: {
    type: 'NO_PROJECT',
    steps: [
      {
        delayHours: 24, // 24 hours after user signup
      },
      {
        delayHours: 72, // 72 hours after step 1
      },
    ],
  },
} as const;

// Helper functions for working with drip sequences
export const getDripSequence = (type: DripSequenceType): DripSequenceDefinition => {
  return DRIP_SEQUENCES[type];
};

export const getSequenceStep = (type: DripSequenceType, stepNumber: number): DripSequenceStep | undefined => {
  const sequence = getDripSequence(type);
  return sequence.steps[stepNumber];
};

export const getStepDelay = (type: DripSequenceType, stepNumber: number) => {
  const step = getSequenceStep(type, stepNumber);
  return (step?.delayHours ?? 0) * 60 * 60 * 1000;
};

export const isSequenceComplete = (type: DripSequenceType, currentStep: number): boolean => {
  const sequence = getDripSequence(type);
  return currentStep >= sequence.steps.length - 1;
};

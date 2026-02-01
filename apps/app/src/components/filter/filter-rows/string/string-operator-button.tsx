import type { IStringFilterOperator } from '@vemetric/common/filters';
import { stringOperatorValues } from '@vemetric/common/filters';
import { OperatorButton } from '../../operator-button';

interface Props {
  operator: IStringFilterOperator;
  onChange: (operator: IStringFilterOperator) => void;
}

export const StringOperatorButton = ({ operator, onChange }: Props) => {
  return <OperatorButton operator={operator} operators={stringOperatorValues} onChange={onChange} />;
};

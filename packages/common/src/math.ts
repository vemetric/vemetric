export const round = (x: number, digit = 0) => {
  return Math.round(x * Math.pow(10, digit)) / Math.pow(10, digit);
};

export const roundTwoDecimal = (value: number) => round(value, 2);

export const formatNumber = (value: number, shorten = false) => {
  if (shorten) {
    const absoluteValue = Math.abs(value);

    if (absoluteValue >= 1000000) {
      return `${roundTwoDecimal(value / 1000000)}M`;
    }

    if (absoluteValue >= 1000) {
      return `${roundTwoDecimal(value / 1000)}k`;
    }
  }

  return Intl.NumberFormat('en-US').format(value);
};

export const formatPercentage = (value: number) => {
  return `${value.toFixed(2).replace(/[.,]00$/, '')}%`;
};

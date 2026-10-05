// Port of recharts' default "auto" tick algorithm (getNiceTickValues), so charts keep the
// same y-axis domains and tick values: always `tickCount` evenly spaced ticks covering [min, max]

const round = (value: number) => Number(value.toPrecision(12));

const getDigitCount = (value: number) => (value === 0 ? 1 : Math.floor(Math.log10(Math.abs(value))) + 1);

const getAdaptiveStep = (roughStep: number, allowDecimals: boolean, correctionFactor: number) => {
  if (roughStep <= 0) {
    return 0;
  }
  const digitCount = getDigitCount(roughStep);
  const digitCountValue = 10 ** digitCount;
  const stepRatioScale = digitCount !== 1 ? 0.05 : 0.1;
  const stepRatio = round(roughStep / digitCountValue);
  const step = round(
    (Math.ceil(round(stepRatio / stepRatioScale)) + correctionFactor) * stepRatioScale * digitCountValue,
  );
  return allowDecimals ? step : Math.ceil(step);
};

const getTicksOfSingleValue = (value: number, tickCount: number, allowDecimals: boolean) => {
  let step = 1;
  let middle = value;
  if (!Number.isInteger(value) && allowDecimals) {
    if (Math.abs(value) < 1) {
      step = 10 ** (getDigitCount(value) - 1);
      middle = round(Math.floor(value / step) * step);
    } else {
      middle = Math.floor(value);
    }
  } else if (value === 0) {
    middle = Math.floor((tickCount - 1) / 2);
  } else if (!allowDecimals) {
    middle = Math.floor(value);
  }
  const middleIndex = Math.floor((tickCount - 1) / 2);
  return Array.from({ length: tickCount }, (_, i) => round(middle + (i - middleIndex) * step));
};

export function getNiceTicks(min: number, max: number, tickCount = 5, allowDecimals = true): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [];
  }
  if (min > max) {
    [min, max] = [max, min];
  }
  if (min === max) {
    return getTicksOfSingleValue(min, tickCount, allowDecimals);
  }

  for (let correctionFactor = 0; ; correctionFactor++) {
    const step = getAdaptiveStep((max - min) / (tickCount - 1), allowDecimals, correctionFactor);
    // When 0 is inside the interval, 0 should be a tick
    const middle = min <= 0 && max >= 0 ? 0 : round((min + max) / 2 - (((min + max) / 2) % step));
    let belowCount = Math.ceil(round((middle - min) / step));
    let upCount = Math.ceil(round((max - middle) / step));
    const scaleCount = belowCount + upCount + 1;
    if (scaleCount > tickCount) {
      // More ticks would be needed to cover the interval, so try the next bigger step
      continue;
    }
    if (max > 0) {
      upCount += tickCount - scaleCount;
    } else {
      belowCount += tickCount - scaleCount;
    }
    return Array.from({ length: belowCount + upCount + 1 }, (_, i) => round(middle + (i - belowCount) * step));
  }
}

export interface TickCandidate {
  /** Position of the tick along the axis in pixels */
  coordinate: number;
  /** Size of the tick label along the axis in pixels (width for horizontal axes, height for vertical ones) */
  size: number;
}

export interface VisibleTick {
  index: number;
  /** Position of the label, which is moved inwards when the label would otherwise overflow the boundaries */
  labelCoordinate: number;
}

const isTickVisible = (sign: number, position: number, size: number, start: number, end: number) =>
  sign * position >= sign * start &&
  sign * position <= sign * end &&
  sign * (position - (sign * size) / 2 - start) >= 0 &&
  sign * (position + (sign * size) / 2 - end) <= 0;

// Port of recharts' tick label thinning (getTicksStart / getTicksEnd), so axes keep showing the same labels:
// - `preserveStartEnd` keeps the first and last label and fills the space in between from the start
// - `preserveEnd` keeps the last label and fills the space towards the start
// Labels need at least `minTickGap` pixels between them and must stay within [start, end].
export function getVisibleTicks(
  candidates: TickCandidate[],
  {
    start,
    end,
    minTickGap,
    mode,
  }: { start: number; end: number; minTickGap: number; mode: 'preserveStartEnd' | 'preserveEnd' },
): VisibleTick[] {
  if (candidates.length === 0) {
    return [];
  }
  const sign = candidates.length >= 2 ? Math.sign(candidates[1].coordinate - candidates[0].coordinate) || 1 : 1;
  if (sign === -1) {
    [start, end] = [end, start];
  }
  const visible = new Map<number, number>();
  const last = candidates.length - 1;

  // Moves the first or last label inwards if it would overflow the boundaries
  const getLabelCoordinate = (index: number) => {
    const { coordinate, size } = candidates[index];
    if (index === last) {
      const gap = sign * (coordinate + (sign * size) / 2 - end);
      return gap > 0 ? coordinate - gap * sign : coordinate;
    }
    if (index === 0 && mode === 'preserveStartEnd') {
      const gap = sign * (coordinate - (sign * size) / 2 - start);
      return gap < 0 ? coordinate - gap * sign : coordinate;
    }
    return coordinate;
  };

  // Both modes guarantee the last label first
  const tailCoordinate = getLabelCoordinate(last);
  const tailSize = candidates[last].size;
  if (isTickVisible(sign, tailCoordinate, tailSize, start, end)) {
    visible.set(last, tailCoordinate);
    end = tailCoordinate - sign * (tailSize / 2 + minTickGap);
  }

  if (mode === 'preserveStartEnd') {
    for (let index = 0; index < last; index++) {
      const labelCoordinate = getLabelCoordinate(index);
      const { size } = candidates[index];
      if (isTickVisible(sign, labelCoordinate, size, start, end)) {
        visible.set(index, labelCoordinate);
        start = labelCoordinate + sign * (size / 2 + minTickGap);
      }
    }
  } else {
    for (let index = last - 1; index >= 0; index--) {
      const labelCoordinate = getLabelCoordinate(index);
      const { size } = candidates[index];
      if (isTickVisible(sign, labelCoordinate, size, start, end)) {
        visible.set(index, labelCoordinate);
        end = labelCoordinate - sign * (size / 2 + minTickGap);
      }
    }
  }

  return Array.from(visible, ([index, labelCoordinate]) => ({ index, labelCoordinate })).sort(
    (a, b) => a.index - b.index,
  );
}

const labelSizeCache = new Map<string, { width: number; height: number }>();

/** Measures a 12px tick label the same way recharts did, so the same labels fit */
export function measureTickLabel(text: string) {
  let size = labelSizeCache.get(text);
  if (!size) {
    const span = document.createElement('span');
    Object.assign(span.style, {
      position: 'absolute',
      top: '-20000px',
      left: '0',
      whiteSpace: 'pre',
      fontSize: '12px',
    });
    span.textContent = text;
    document.body.appendChild(span);
    const rect = span.getBoundingClientRect();
    span.remove();
    size = { width: rect.width, height: rect.height };
    labelSizeCache.set(text, size);
  }
  return size;
}

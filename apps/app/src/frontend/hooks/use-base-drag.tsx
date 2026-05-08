import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef } from 'react';

function preventSelectionWhileDrag(event: PointerEvent) {
  event.stopPropagation();
  event.preventDefault();
  event.cancelBubble = true;
  return false;
}

interface Props<ElementType extends Element = HTMLDivElement> {
  onDrag: (event: PointerEvent) => void;
  onDragEnd: (event: PointerEvent, hasBeenDragged: boolean) => void;
  onDragStart: (event: ReactPointerEvent<ElementType>) => boolean | undefined;
  draggingTolerance?: number; // tolerance in px when the drag should start to happen
}

export function useBaseDrag<ElementType extends Element = HTMLDivElement>({
  onDrag,
  onDragEnd,
  onDragStart,
  draggingTolerance,
}: Props<ElementType>) {
  const startingPoint = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasBeenDragged = useRef(false);

  function whileDrag(event: PointerEvent) {
    if (!hasBeenDragged.current && typeof draggingTolerance === 'number') {
      const deltaX = Math.abs(event.pageX - startingPoint.current.x);
      const deltaY = Math.abs(event.pageY - startingPoint.current.y);

      if (deltaX < draggingTolerance && deltaY < draggingTolerance) {
        return;
      }
    }
    hasBeenDragged.current = true;
    onDrag(event);
    return preventSelectionWhileDrag(event);
  }

  function stopDrag(event: PointerEvent) {
    onDragEnd(event, hasBeenDragged.current);
    window.removeEventListener('pointermove', whileDrag);
    window.removeEventListener('pointerup', stopDrag);
    window.removeEventListener('pointercancel', stopDrag);
  }

  function startDrag(event: ReactPointerEvent<ElementType>) {
    if (!event.isPrimary) return;

    startingPoint.current = { x: event.pageX, y: event.pageY };
    hasBeenDragged.current = false;
    if (onDragStart(event) !== false) {
      event.currentTarget.setPointerCapture(event.pointerId);
      window.addEventListener('pointermove', whileDrag);
      window.addEventListener('pointerup', stopDrag);
      window.addEventListener('pointercancel', stopDrag);
    }
  }

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', whileDrag);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return startDrag;
}

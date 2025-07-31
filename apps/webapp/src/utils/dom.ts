interface ResizeObserveProps {
  element: Element;
  callback: (firstCalled: boolean) => void;
  options?: ResizeObserverOptions;
}

export const observeResize = ({ element, callback, options }: ResizeObserveProps) => {
  let firstCalled = true;
  const observer = new ResizeObserver(() => {
    callback(firstCalled);
    firstCalled = false;
  });
  observer.observe(element, options);
  return observer;
};

export const isActiveElementAnInput = () => {
  if (!document.activeElement) {
    return false;
  }

  if (['input', 'textarea', 'select'].includes(document.activeElement.tagName.toLowerCase())) {
    return true;
  }

  return (document.activeElement as HTMLElement)?.isContentEditable;
};

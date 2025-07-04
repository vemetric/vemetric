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

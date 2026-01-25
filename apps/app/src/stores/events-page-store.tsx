import { createContext, useContext, useState } from 'react';
import { proxy } from 'valtio';

const defaultState = {
  eventsOpened: [] as Array<string>,
};

const EventsPageContext = createContext(defaultState);

export const EventsPageStoreProvider = ({ children }: { children: React.ReactNode }) => {
  const [state] = useState(() => proxy(JSON.parse(JSON.stringify(defaultState))));
  return <EventsPageContext.Provider value={state}>{children}</EventsPageContext.Provider>;
};

export const useEventsPageStore = () => {
  return useContext(EventsPageContext);
};

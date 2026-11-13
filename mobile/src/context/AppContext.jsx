import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { demoUsers, events as mockEvents } from "../mock/data";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState(() => mockEvents.map((event) => ({ ...event })));

  const signIn = useCallback((role) => {
    const nextUser = demoUsers[role] || demoUsers.student;
    setUser(nextUser);
    return nextUser;
  }, []);

  const signOut = useCallback(() => setUser(null), []);

  const confirmAttendance = useCallback((eventId, status = "present") => {
    setEvents((current) =>
      current.map((event) =>
        event.id === eventId
          ? { ...event, [status]: event[status] + 1 }
          : event,
      ),
    );
  }, []);

  const getEvent = useCallback(
    (eventId) => events.find((event) => event.id === eventId) || events[0],
    [events],
  );

  const value = useMemo(
    () => ({ user, signIn, signOut, events, getEvent, confirmAttendance }),
    [user, signIn, signOut, events, getEvent, confirmAttendance],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return context;
}

"use client";

import { createContext, ReactNode, useContext } from "react";
import { Awareness } from "y-protocols/awareness";

interface AwarenessContextType {
  awareness: Awareness | null;
}

const AwarenessContext = createContext<AwarenessContextType | null>(null);

export function AwarenessProvider({
  awareness,
  children,
}: {
  awareness: Awareness | null;
  children: ReactNode;
}) {
  return (
    <AwarenessContext.Provider value={{ awareness }}>
      {children}
    </AwarenessContext.Provider>
  );
}

export function useAwarenessContext(): AwarenessContextType {
  const context = useContext(AwarenessContext);
  if (!context) {
    throw new Error(
      "useAwarenessContext must be used within AwarenessProvider",
    );
  }
  return context;
}

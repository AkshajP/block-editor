"use client";

import { useEffect, useState } from "react";

import { useAwarenessContext } from "@/components/AwarenessContext";

/**
 * UserPresence displays all active users currently editing the document
 */
export default function UserPresence() {
  const { awareness } = useAwarenessContext();
  const [users, setUsers] = useState<
    Array<{ clientID: number; name: string; color: string }>
  >([]);

  useEffect(() => {
    if (!awareness) return;

    const handleChange = () => {
      const states = awareness.getStates();
      const userList: Array<{ clientID: number; name: string; color: string }> =
        [];

      states.forEach((state: Record<string, unknown>, clientID: number) => {
        const userState = state.user as
          | { name?: string; color?: string }
          | undefined;
        if (userState) {
          userList.push({
            clientID,
            name: userState.name || "Unknown",
            color: userState.color || "#999",
          });
        }
      });

      setUsers(userList);
    };

    handleChange(); // Set initial state
    awareness.on("change", handleChange);

    return () => {
      awareness.off("change", handleChange);
    };
  }, [awareness]);

  if (users.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
      <span className="text-xs font-semibold text-gray-600 uppercase">
        Active Users:
      </span>
      <div className="flex items-center gap-2">
        {users.map((user) => (
          <div
            key={user.clientID}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: user.color }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            {user.name}
          </div>
        ))}
      </div>
    </div>
  );
}

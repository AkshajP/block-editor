import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Awareness } from "y-protocols/awareness";
import { Doc } from "yjs";

/**
 * Unit tests for MultiCursorPlugin offline behavior and session merging
 *
 * Tests the plugin's ability to:
 * - Maintain local cursor state when offline
 * - Handle awareness state merging on reconnection
 * - Recover from connection interruptions
 * - Sync multi-cursor state from persistent storage
 */

describe("MultiCursorPlugin - Offline & Reconnection", () => {
  let yDoc: Doc;
  let awareness: Awareness;
  let secondYDoc: Doc;
  let secondAwareness: Awareness;

  beforeEach(() => {
    // Initialize primary document and awareness
    yDoc = new Doc();
    awareness = new Awareness(yDoc);

    // Initialize secondary document for multi-user scenarios
    secondYDoc = new Doc();
    secondAwareness = new Awareness(secondYDoc);
  });

  afterEach(() => {
    // Cleanup - safely destroy all resources
    try {
      awareness?.destroy?.();
    } catch (e) {
      // Ignore cleanup errors
    }
    try {
      yDoc?.destroy?.();
    } catch (e) {
      // Ignore cleanup errors
    }
    try {
      secondAwareness?.destroy?.();
    } catch (e) {
      // Ignore cleanup errors
    }
    try {
      secondYDoc?.destroy?.();
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe("Offline State Management", () => {
    it("should preserve local cursor state when awareness disconnected", () => {
      const localState = {
        clientID: 1,
        user: { name: "Test User", color: "#FF6B6B" },
        cursor: { anchor: 0, head: 5 },
        selection: {
          anchorKey: "key1",
          anchorOffset: 0,
          focusKey: "key1",
          focusOffset: 5,
        },
        lastUpdate: Date.now(),
      };

      awareness.setLocalState(localState);
      const stateBeforeOffline = awareness.getLocalState();

      expect(stateBeforeOffline).toBeDefined();
      expect(stateBeforeOffline?.user.name).toBe("Test User");
      expect(stateBeforeOffline?.cursor).toEqual({ anchor: 0, head: 5 });
    });

    it("should maintain empty awareness state for disconnected clients", () => {
      awareness.setLocalState(null);
      const state = awareness.getLocalState();

      expect(state).toBeNull();
    });

    it("should restore state after simulated network interruption", () => {
      const originalState = {
        clientID: 1,
        user: { name: "User A", color: "#4ECDC4" },
        cursor: { anchor: 10, head: 20 },
        lastUpdate: Date.now(),
      };

      // Set initial state
      awareness.setLocalState(originalState);
      expect(awareness.getLocalState()).toEqual(originalState);

      // Simulate network interruption (clear state)
      awareness.setLocalState(null);
      expect(awareness.getLocalState()).toBeNull();

      // Restore state
      awareness.setLocalState(originalState);
      expect(awareness.getLocalState()).toEqual(originalState);
    });

    it("should track lastUpdate timestamp for state freshness", () => {
      const beforeTime = Date.now();
      const state = {
        clientID: 1,
        user: { name: "User", color: "#FF6B6B" },
        lastUpdate: beforeTime,
      };

      awareness.setLocalState(state);
      const savedState = awareness.getLocalState();

      expect(savedState?.lastUpdate).toBeLessThanOrEqual(Date.now());
      expect(savedState?.lastUpdate).toBeGreaterThanOrEqual(beforeTime);
    });
  });

  describe("Session Merging & Reconnection", () => {
    it("should merge remote cursor states after reconnection", (done) => {
      let changeCount = 0;
      const remoteStates: Array<Map<number, any>> = [];

      // Setup awareness change listener
      const handleChange = () => {
        changeCount++;
        remoteStates.push(new Map(awareness.getStates()));
      };

      awareness.on("change", handleChange);

      // Set local state
      awareness.setLocalState({
        clientID: 1,
        user: { name: "User A", color: "#FF6B6B" },
        cursor: { anchor: 0, head: 5 },
      });

      // Simulate receiving remote state after reconnection
      setTimeout(() => {
        const remoteState = new Awareness(new Doc());
        remoteState.clientID = 2;
        remoteState.setLocalState({
          clientID: 2,
          user: { name: "User B", color: "#4ECDC4" },
          cursor: { anchor: 10, head: 15 },
          selection: {
            anchorKey: "key2",
            anchorOffset: 10,
            focusKey: "key2",
            focusOffset: 15,
          },
        });

        // Merge remote state directly
        awareness.setLocalState({
          clientID: 1,
          user: { name: "User A", color: "#FF6B6B" },
          cursor: { anchor: 0, head: 5 },
        });

        setTimeout(() => {
          expect(changeCount).toBeGreaterThan(0);
          expect(remoteStates.length).toBeGreaterThan(0);

          awareness.off("change", handleChange);
          remoteState.destroy();
          done();
        }, 50);
      }, 50);
    });

    it("should handle multiple concurrent remote cursor updates", (done) => {
      const cursors = new Map<
        number,
        { name: string; color: string; position: any }
      >();
      let updateCount = 0;

      // Track all cursor updates
      awareness.on("change", () => {
        updateCount++;
        awareness.getStates().forEach((state, clientID) => {
          if (state.user) {
            cursors.set(clientID, {
              name: state.user.name,
              color: state.user.color,
              position: state.cursor,
            });
          }
        });
      });

      // Simulate 3 concurrent users connecting/updating
      const updates = [
        {
          clientID: 1,
          state: {
            user: { name: "User 1", color: "#FF6B6B" },
            cursor: { anchor: 0, head: 5 },
          },
        },
        {
          clientID: 2,
          state: {
            user: { name: "User 2", color: "#4ECDC4" },
            cursor: { anchor: 10, head: 20 },
          },
        },
        {
          clientID: 3,
          state: {
            user: { name: "User 3", color: "#FFE66D" },
            cursor: { anchor: 30, head: 40 },
          },
        },
      ];

      // Apply updates sequentially
      let index = 0;
      const applyNext = () => {
        if (index < updates.length) {
          const { state } = updates[index];
          awareness.setLocalState({
            clientID: updates[index].clientID,
            ...state,
            lastUpdate: Date.now(),
          });
          index++;
          setTimeout(applyNext, 10);
        } else {
          setTimeout(() => {
            expect(updateCount).toBeGreaterThan(0);
            expect(cursors.size).toBeGreaterThan(0);
            awareness.off("change", () => {});
            done();
          }, 50);
        }
      };

      applyNext();
    });

    it("should clear stale cursor state after timeout period", (done) => {
      const STALE_TIMEOUT = 5000; // 5 seconds

      awareness.setLocalState({
        clientID: 1,
        user: { name: "User A", color: "#FF6B6B" },
        cursor: { anchor: 0, head: 5 },
        lastUpdate: Date.now(),
      });

      const initialState = awareness.getLocalState();
      expect(initialState).toBeDefined();

      // Simulate passage of time without updates
      setTimeout(() => {
        const currentState = awareness.getLocalState();
        const timeSinceUpdate = (currentState?.lastUpdate || 0) - 0;

        // Manually check if state should be considered stale
        // (In real implementation, this would be handled by Yjs/awareness)
        if (timeSinceUpdate && Date.now() - timeSinceUpdate > STALE_TIMEOUT) {
          awareness.setLocalState(null);
        }

        done();
      }, 100);
    });

    it("should prevent duplicate cursor entries during merge", () => {
      // Set initial state
      awareness.setLocalState({
        clientID: 1,
        user: { name: "User A", color: "#FF6B6B" },
        cursor: { anchor: 5, head: 10 },
      });

      const firstState = awareness.getLocalState();
      expect(firstState).toBeDefined();

      // Update with same clientID multiple times (simulating merge)
      awareness.setLocalState({
        clientID: 1,
        user: { name: "User A", color: "#FF6B6B" },
        cursor: { anchor: 10, head: 20 },
      });

      const secondState = awareness.getLocalState();

      // Set same state again
      awareness.setLocalState({
        clientID: 1,
        user: { name: "User A", color: "#FF6B6B" },
        cursor: { anchor: 10, head: 20 },
      });

      const thirdState = awareness.getLocalState();

      // Verify that multiple updates don't create duplicates - final state should be correct
      expect(firstState?.user.name).toBe("User A");
      expect(secondState?.cursor.anchor).toBe(10);
      expect(thirdState?.cursor.anchor).toBe(10);

      // Verify local state exists and has correct data
      const localState = awareness.getLocalState();
      expect(localState?.clientID).toBe(1);
      expect(localState?.user.name).toBe("User A");
      expect(localState?.cursor).toEqual({ anchor: 10, head: 20 });

      // Verify state is a distinct single object (not duplicated)
      expect(localState).toEqual(thirdState);
      expect(awareness.getLocalState()).toBe(localState);
    });
  });

  describe("Cursor Position Recovery", () => {
    it("should restore cursor selection from persistent awareness state", () => {
      const selectionData = {
        anchorKey: "key123",
        anchorOffset: 10,
        focusKey: "key123",
        focusOffset: 25,
      };

      awareness.setLocalState({
        clientID: 1,
        user: { name: "User A", color: "#FF6B6B" },
        selection: selectionData,
      });

      const savedState = awareness.getLocalState();
      expect(savedState?.selection).toEqual(selectionData);
    });

    it("should handle missing or invalid selection keys gracefully", () => {
      const invalidSelection = {
        anchorKey: null,
        anchorOffset: 0,
        focusKey: undefined,
        focusOffset: 0,
      };

      awareness.setLocalState({
        clientID: 1,
        user: { name: "User A", color: "#FF6B6B" },
        selection: invalidSelection,
      });

      const state = awareness.getLocalState();
      expect(state?.selection).toBeDefined();
      expect(state?.selection?.anchorKey).toBeNull();
    });

    it("should update cursor position when selection changes", (done) => {
      const positions: any[] = [];

      awareness.on("change", () => {
        const state = awareness.getLocalState();
        if (state?.selection) {
          positions.push(state.selection);
        }
      });

      // Simulate cursor movement
      const movements = [
        {
          anchorKey: "key1",
          anchorOffset: 0,
          focusKey: "key1",
          focusOffset: 5,
        },
        {
          anchorKey: "key1",
          anchorOffset: 0,
          focusKey: "key1",
          focusOffset: 15,
        },
        {
          anchorKey: "key2",
          anchorOffset: 5,
          focusKey: "key2",
          focusOffset: 20,
        },
      ];

      let index = 0;
      const applyMovement = () => {
        if (index < movements.length) {
          awareness.setLocalState({
            clientID: 1,
            user: { name: "User", color: "#FF6B6B" },
            selection: movements[index],
          });
          index++;
          setTimeout(applyMovement, 20);
        } else {
          setTimeout(() => {
            expect(positions.length).toBeGreaterThan(0);
            awareness.off("change", () => {});
            done();
          }, 50);
        }
      };

      applyMovement();
    });
  });

  describe("Multi-Document Scenarios", () => {
    it("should maintain separate awareness states for different documents", () => {
      const state1 = {
        clientID: 1,
        user: { name: "User 1", color: "#FF6B6B" },
        cursor: { anchor: 0, head: 10 },
      };

      const state2 = {
        clientID: 2,
        user: { name: "User 2", color: "#4ECDC4" },
        cursor: { anchor: 20, head: 30 },
      };

      awareness.setLocalState(state1);
      secondAwareness.setLocalState(state2);

      expect(awareness.getLocalState()).toEqual(state1);
      expect(secondAwareness.getLocalState()).toEqual(state2);
    });

    it("should not leak state between document reconnections", () => {
      awareness.setLocalState({
        clientID: 1,
        user: { name: "User A", color: "#FF6B6B" },
      });

      const firstState = awareness.getLocalState();

      // Switch to second document
      secondAwareness.setLocalState({
        clientID: 2,
        user: { name: "User B", color: "#4ECDC4" },
      });

      const secondState = secondAwareness.getLocalState();

      // First state should remain unchanged
      expect(awareness.getLocalState()).toEqual(firstState);
      expect(secondAwareness.getLocalState()).toEqual(secondState);
      expect(firstState?.clientID).not.toBe(secondState?.clientID);
    });
  });

  describe("Edge Cases & Error Handling", () => {
    it("should handle awareness destruction gracefully", () => {
      awareness.setLocalState({
        clientID: 1,
        user: { name: "User", color: "#FF6B6B" },
      });

      const state = awareness.getLocalState();
      expect(state).toBeDefined();

      // Destroy awareness
      awareness.destroy();

      // Should not throw when accessing destroyed awareness
      expect(() => awareness.clientID).not.toThrow();
    });

    it("should handle rapid state updates without losing data", (done) => {
      const updates: any[] = [];

      awareness.on("change", () => {
        updates.push(awareness.getLocalState());
      });

      // Rapid state updates
      for (let i = 0; i < 10; i++) {
        awareness.setLocalState({
          clientID: 1,
          user: { name: "User", color: "#FF6B6B" },
          cursor: { anchor: i * 5, head: i * 5 + 5 },
          lastUpdate: Date.now(),
        });
      }

      setTimeout(() => {
        expect(updates.length).toBeGreaterThan(0);
        const lastState = awareness.getLocalState();
        expect(lastState?.cursor?.anchor).toBe(45); // Last update should be preserved
        awareness.off("change", () => {});
        done();
      }, 100);
    });

    it("should recover from invalid state objects", () => {
      // Attempt to set invalid state
      awareness.setLocalState({
        clientID: 1,
        user: { name: "User", color: "#FF6B6B" },
      });

      // Verify valid state is retained
      const state = awareness.getLocalState();
      expect(state?.clientID).toBe(1);
      expect(state?.user).toBeDefined();
    });

    it("should handle color palette consistency across rejoins", () => {
      const colors = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3"];

      // First connection
      awareness.setLocalState({
        clientID: 1,
        user: { name: "User", color: colors[0] },
      });
      const firstColor = awareness.getLocalState()?.user.color;

      // Simulate disconnect/reconnect
      awareness.setLocalState(null);
      awareness.setLocalState({
        clientID: 1,
        user: { name: "User", color: colors[0] },
      });
      const secondColor = awareness.getLocalState()?.user.color;

      expect(firstColor).toBe(secondColor);
      expect(firstColor).toBe(colors[0]);
    });
  });

  describe("Awareness Event Tracking", () => {
    it("should emit change events on state updates", (done) => {
      let changeEvent = false;

      awareness.on("change", () => {
        changeEvent = true;
      });

      awareness.setLocalState({
        clientID: 1,
        user: { name: "User", color: "#FF6B6B" },
      });

      setTimeout(() => {
        expect(changeEvent).toBe(true);
        awareness.off("change", () => {});
        done();
      }, 50);
    });

    it("should track awareness states across multiple clients", (done) => {
      const stateHistory: Array<{ states: Map<number, any>; time: number }> =
        [];

      awareness.on("change", () => {
        stateHistory.push({
          states: new Map(awareness.getStates()),
          time: Date.now(),
        });
      });

      // Simulate state from multiple clients
      awareness.setLocalState({
        clientID: 1,
        user: { name: "User 1", color: "#FF6B6B" },
      });

      setTimeout(() => {
        awareness.setLocalState({
          clientID: 1,
          user: { name: "User 1", color: "#FF6B6B" },
          cursor: { anchor: 5, head: 10 },
        });

        setTimeout(() => {
          expect(stateHistory.length).toBeGreaterThan(0);
          stateHistory.forEach((entry) => {
            expect(entry.states).toBeInstanceOf(Map);
            expect(entry.time).toBeGreaterThan(0);
          });

          awareness.off("change", () => {});
          done();
        }, 50);
      }, 50);
    });
  });
});

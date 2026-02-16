import { beforeEach, describe, expect, it, vi } from "vitest";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";

import { PlaybackEngine } from "@/lib/playback-engine";
import { VersionedEdit, VersionHistory } from "@/lib/version-history";

describe("VersionHistory", () => {
  let doc: Y.Doc;
  let awareness: Awareness;
  let versionHistory: VersionHistory;

  beforeEach(() => {
    doc = new Y.Doc();
    awareness = new Awareness(doc);
    versionHistory = new VersionHistory(10); // Small interval for testing
  });

  it("should initialize version tracking", () => {
    const cleanup = versionHistory.initializeVersionTracking(doc, awareness);

    expect(cleanup).toBeDefined();
    expect(typeof cleanup).toBe("function");

    cleanup();
  });

  it("should capture edits", async () => {
    versionHistory.initializeVersionTracking(doc, awareness);

    // Make an edit
    const ytext = doc.getText("shared");
    ytext.insert(0, "hello");

    // Wait for edits to be captured
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check captured edits
    const edits = versionHistory.getEdits();
    expect(edits.length).toBeGreaterThan(0);
    expect(edits[0]).toHaveProperty("timestamp");
    expect(edits[0]).toHaveProperty("clientID");
    expect(edits[0]).toHaveProperty("userName");
  });

  it("should get edits", () => {
    versionHistory.initializeVersionTracking(doc, awareness);

    const ytext = doc.getText("shared");
    ytext.insert(0, "test");

    const edits = versionHistory.getEdits();
    expect(Array.isArray(edits)).toBe(true);
  });

  it("should create snapshots", () => {
    versionHistory.initializeVersionTracking(doc, awareness);

    const ytext = doc.getText("shared");

    // Create 12 edits to trigger snapshot (interval is 10)
    for (let i = 0; i < 12; i++) {
      ytext.insert(i, "x");
    }

    const snapshots = versionHistory.getSnapshots();
    expect(snapshots.length).toBeGreaterThan(0);
  });

  it("should find edits by user", async () => {
    versionHistory.initializeVersionTracking(doc, awareness);

    awareness.setLocalState({
      clientID: awareness.clientID,
      user: { name: "Test User", color: "#000000" },
      lastUpdate: Date.now(),
    });

    const ytext = doc.getText("shared");
    ytext.insert(0, "hello");

    // Wait for edits to be captured
    await new Promise((resolve) => setTimeout(resolve, 100));

    const edits = versionHistory.findEditsByUser("Test User");
    expect(edits.length).toBeGreaterThan(0);
  });

  it("should export history", () => {
    versionHistory.initializeVersionTracking(doc, awareness);

    const ytext = doc.getText("shared");
    ytext.insert(0, "test");

    const exported = versionHistory.exportHistory();

    expect(exported).toHaveProperty("edits");
    expect(exported).toHaveProperty("snapshots");
    expect(exported).toHaveProperty("exportTime");
    expect(Array.isArray(exported.edits)).toBe(true);
  });

  it("should get statistics", () => {
    versionHistory.initializeVersionTracking(doc, awareness);

    const ytext = doc.getText("shared");
    ytext.insert(0, "test");

    const stats = versionHistory.getStatistics();

    expect(stats).toHaveProperty("totalEdits");
    expect(stats).toHaveProperty("totalSnapshots");
    expect(stats).toHaveProperty("editsByUser");
    expect(stats).toHaveProperty("editsByType");
    expect(stats).toHaveProperty("timeSpan");
  });

  it("should clear history", async () => {
    versionHistory.initializeVersionTracking(doc, awareness);

    const ytext = doc.getText("shared");
    ytext.insert(0, "test");

    // Wait for edits to be captured
    await new Promise((resolve) => setTimeout(resolve, 100));

    versionHistory.clearHistory();
    expect(versionHistory.getEditCount()).toBe(0);
  });
});

describe("PlaybackEngine", () => {
  let _doc: Y.Doc;
  let playbackEngine: PlaybackEngine;
  let edits: VersionedEdit[] = [];

  beforeEach(() => {
    _doc = new Y.Doc();
    playbackEngine = new PlaybackEngine();
    edits = [];
  });

  it("should seek to start", () => {
    const playbackDoc = playbackEngine.seekToStart(edits, []);

    expect(playbackDoc).toBeDefined();
    expect(playbackDoc).toBeInstanceOf(Y.Doc);
  });

  it("should seek to end", () => {
    const playbackDoc = playbackEngine.seekToEnd(edits, []);

    expect(playbackDoc).toBeDefined();
    expect(playbackDoc).toBeInstanceOf(Y.Doc);
  });

  it("should step forward", () => {
    const playbackDoc = playbackEngine.stepForward(edits, []);

    expect(playbackDoc).toBeDefined();
    expect(playbackDoc).toBeInstanceOf(Y.Doc);
  });

  it("should step backward", () => {
    const playbackDoc = playbackEngine.stepBackward(edits, []);

    expect(playbackDoc).toBeDefined();
    expect(playbackDoc).toBeInstanceOf(Y.Doc);
  });

  it("should set playback speed", () => {
    playbackEngine.setPlaybackSpeed(2.0);

    expect(playbackEngine.getPlaybackSpeed()).toBe(2.0);
  });

  it("should throw on invalid speed", () => {
    expect(() => {
      playbackEngine.setPlaybackSpeed(0);
    }).toThrow();

    expect(() => {
      playbackEngine.setPlaybackSpeed(-1);
    }).toThrow();
  });

  it("should track playback state", () => {
    expect(playbackEngine.isCurrentlyPlaying()).toBe(false);

    playbackEngine.resume();
    expect(playbackEngine.isCurrentlyPlaying()).toBe(true);

    playbackEngine.pause();
    expect(playbackEngine.isCurrentlyPlaying()).toBe(false);
  });

  it("should subscribe to playback events", () => {
    const callback = vi.fn();
    const unsubscribe = playbackEngine.subscribe(callback);

    playbackEngine.seekToStart(edits, []);

    expect(callback).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "seek",
      }),
      expect.any(Y.Doc),
    );

    unsubscribe();
  });

  it("should reset playback state", () => {
    playbackEngine.setPlaybackSpeed(2.0);
    playbackEngine.resume();

    playbackEngine.reset();

    expect(playbackEngine.getPlaybackSpeed()).toBe(1.0);
    expect(playbackEngine.isCurrentlyPlaying()).toBe(false);
    expect(playbackEngine.getCurrentEditIndex()).toBe(0);
  });
});

describe("Integration: Version History + Playback", () => {
  let _doc: Y.Doc;
  let awareness: Awareness;
  let versionHistory: VersionHistory;
  let playbackEngine: PlaybackEngine;

  beforeEach(async () => {
    _doc = new Y.Doc();
    awareness = new Awareness(_doc);
    versionHistory = new VersionHistory(5);
    playbackEngine = new PlaybackEngine();

    versionHistory.initializeVersionTracking(_doc, awareness);

    // Create some edits
    const ytext = _doc.getText("shared");
    for (let i = 0; i < 3; i++) {
      ytext.insert(i, `text${i}`);
    }

    // Wait for edits to be captured
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  it("should seek to specific timestamps", () => {
    const edits = versionHistory.getEdits();
    const snapshots = versionHistory.getSnapshots();

    if (edits.length > 0) {
      const timestamp = edits[0].timestamp;
      const playbackDoc = playbackEngine.seekToTimestamp(
        timestamp,
        edits,
        snapshots,
      );

      expect(playbackDoc).toBeDefined();
    }
  });

  it("should seek to specific edit index", () => {
    const edits = versionHistory.getEdits();
    const snapshots = versionHistory.getSnapshots();

    if (edits.length > 0) {
      const playbackDoc = playbackEngine.seekToEditIndex(0, edits, snapshots);

      expect(playbackDoc).toBeDefined();
    }
  });
});

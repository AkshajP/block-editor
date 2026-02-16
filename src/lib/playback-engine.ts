import * as Y from "yjs";

import { Snapshot, VersionedEdit } from "./version-history";

/**
 * Playback event emitted during document reconstruction
 */
export interface PlaybackEvent {
  type: "seek" | "playback" | "stop" | "speed-change";
  currentEditIndex: number;
  totalEdits: number;
  currentTimestamp: number;
  edit?: VersionedEdit;
}

/**
 * Callback function for playback events
 */
export type PlaybackEventCallback = (event: PlaybackEvent, doc?: Y.Doc) => void;

/**
 * Manages playback of version history with time-travel reconstruction
 */
export class PlaybackEngine {
  private playbackDoc: Y.Doc | null = null;
  private currentEditIndex = 0;
  private isPlaying = false;
  private playbackSpeed = 1.0;
  private eventListeners: Set<PlaybackEventCallback> = new Set();

  constructor() {}

  /**
   * Seek to a specific timestamp by reconstructing the document state
   */
  public seekToTimestamp(
    targetTime: number,
    edits: VersionedEdit[],
    snapshots: Snapshot[],
  ): Y.Doc {
    // Find closest snapshot before target time
    const snapshot = this.findClosestSnapshot(targetTime, snapshots);

    // Create new playback document
    this.playbackDoc = new Y.Doc();

    if (snapshot) {
      // Apply snapshot state
      Y.applyUpdate(this.playbackDoc, snapshot.yDocState);
      this.currentEditIndex = snapshot.editIndex + 1;
    } else {
      // Start from beginning
      this.currentEditIndex = 0;
    }

    // Apply edits from snapshot to target time
    while (this.currentEditIndex < edits.length) {
      const edit = edits[this.currentEditIndex];
      if (edit.timestamp > targetTime) {
        break;
      }

      Y.applyUpdate(this.playbackDoc, edit.yUpdate);
      this.currentEditIndex++;
    }

    // Emit seek event
    this.emitEvent({
      type: "seek",
      currentEditIndex: this.currentEditIndex,
      totalEdits: edits.length,
      currentTimestamp: targetTime,
    });

    return this.playbackDoc;
  }

  /**
   * Seek to a specific edit index
   */
  public seekToEditIndex(
    targetIndex: number,
    edits: VersionedEdit[],
    snapshots: Snapshot[],
  ): Y.Doc {
    if (targetIndex < 0 || targetIndex >= edits.length) {
      throw new Error(`Invalid edit index: ${targetIndex}`);
    }

    const targetTime = edits[targetIndex].timestamp;
    return this.seekToTimestamp(targetTime, edits, snapshots);
  }

  /**
   * Seek to the beginning of the document
   */
  public seekToStart(edits: VersionedEdit[], _snapshots: Snapshot[]): Y.Doc {
    this.playbackDoc = new Y.Doc();
    this.currentEditIndex = 0;

    this.emitEvent({
      type: "seek",
      currentEditIndex: 0,
      totalEdits: edits.length,
      currentTimestamp: edits.length > 0 ? edits[0].timestamp : Date.now(),
    });

    return this.playbackDoc;
  }

  /**
   * Seek to the end of the document
   */
  public seekToEnd(edits: VersionedEdit[], snapshots: Snapshot[]): Y.Doc {
    if (edits.length === 0) {
      this.playbackDoc = new Y.Doc();
      this.currentEditIndex = 0;
      return this.playbackDoc;
    }

    const lastEdit = edits[edits.length - 1];
    return this.seekToTimestamp(lastEdit.timestamp, edits, snapshots);
  }

  /**
   * Play forward one edit at a time
   */
  public async playForward(
    edits: VersionedEdit[],
    snapshots: Snapshot[],
    onUpdate?: PlaybackEventCallback,
  ): Promise<boolean> {
    if (!this.playbackDoc) {
      this.playbackDoc = new Y.Doc();
      this.currentEditIndex = 0;
    }

    this.isPlaying = true;
    const localOnUpdate = onUpdate || ((e) => this.emitEvent(e));

    while (this.isPlaying && this.currentEditIndex < edits.length) {
      const edit = edits[this.currentEditIndex];

      // Apply the edit
      Y.applyUpdate(this.playbackDoc, edit.yUpdate);

      // Emit playback event
      localOnUpdate(
        {
          type: "playback",
          currentEditIndex: this.currentEditIndex,
          totalEdits: edits.length,
          currentTimestamp: edit.timestamp,
          edit,
        },
        this.playbackDoc,
      );

      // Calculate delay for next edit based on playback speed
      const nextEdit = edits[this.currentEditIndex + 1];
      if (nextEdit) {
        const delay =
          (nextEdit.timestamp - edit.timestamp) / this.playbackSpeed;
        // Cap delay at 2 seconds to prevent long waits
        await this.sleep(Math.min(delay, 2000));
      }

      this.currentEditIndex++;
    }

    if (this.isPlaying) {
      this.isPlaying = false;
      localOnUpdate({
        type: "stop",
        currentEditIndex: this.currentEditIndex,
        totalEdits: edits.length,
        currentTimestamp:
          edits.length > 0 ? edits[edits.length - 1].timestamp : Date.now(),
      });
    }

    return this.isPlaying;
  }

  /**
   * Play backwards one edit at a time
   */
  public async playBackward(
    edits: VersionedEdit[],
    snapshots: Snapshot[],
    onUpdate?: PlaybackEventCallback,
  ): Promise<boolean> {
    if (!this.playbackDoc || this.currentEditIndex === 0) {
      return false;
    }

    this.isPlaying = true;
    const localOnUpdate = onUpdate || ((e) => this.emitEvent(e));

    while (this.isPlaying && this.currentEditIndex > 0) {
      this.currentEditIndex--;

      // Rebuild from closest snapshot to reach current index
      const snapshot = this.findClosestSnapshot(
        edits[this.currentEditIndex].timestamp,
        snapshots,
      );

      this.playbackDoc = new Y.Doc();
      let rebuildIndex = 0;

      if (snapshot) {
        Y.applyUpdate(this.playbackDoc, snapshot.yDocState);
        rebuildIndex = snapshot.editIndex + 1;
      }

      // Apply edits up to current index
      while (rebuildIndex <= this.currentEditIndex) {
        Y.applyUpdate(this.playbackDoc, edits[rebuildIndex].yUpdate);
        rebuildIndex++;
      }

      const edit = edits[this.currentEditIndex];

      localOnUpdate(
        {
          type: "playback",
          currentEditIndex: this.currentEditIndex,
          totalEdits: edits.length,
          currentTimestamp: edit.timestamp,
          edit,
        },
        this.playbackDoc,
      );

      // Calculate delay
      const prevEdit = edits[this.currentEditIndex - 1];
      if (prevEdit) {
        const delay =
          (edit.timestamp - prevEdit.timestamp) / this.playbackSpeed;
        await this.sleep(Math.min(delay, 2000));
      }
    }

    if (this.isPlaying) {
      this.isPlaying = false;
      localOnUpdate({
        type: "stop",
        currentEditIndex: this.currentEditIndex,
        totalEdits: edits.length,
        currentTimestamp:
          this.currentEditIndex > 0
            ? edits[this.currentEditIndex].timestamp
            : Date.now(),
      });
    }

    return this.isPlaying;
  }

  /**
   * Step forward one edit (without playback delay)
   */
  public stepForward(edits: VersionedEdit[], _snapshots: Snapshot[]): Y.Doc {
    if (!this.playbackDoc) {
      this.playbackDoc = new Y.Doc();
    }

    if (this.currentEditIndex < edits.length) {
      const edit = edits[this.currentEditIndex];
      Y.applyUpdate(this.playbackDoc, edit.yUpdate);

      this.emitEvent({
        type: "playback",
        currentEditIndex: this.currentEditIndex,
        totalEdits: edits.length,
        currentTimestamp: edit.timestamp,
        edit,
      });

      this.currentEditIndex++;
    }

    return this.playbackDoc;
  }

  /**
   * Step backward one edit (without playback delay)
   */
  public stepBackward(edits: VersionedEdit[], snapshots: Snapshot[]): Y.Doc {
    if (this.currentEditIndex === 0) {
      return this.playbackDoc || new Y.Doc();
    }

    this.currentEditIndex--;

    // Rebuild from snapshot
    const snapshot = this.findClosestSnapshot(
      edits[this.currentEditIndex].timestamp,
      snapshots,
    );

    this.playbackDoc = new Y.Doc();
    let rebuildIndex = 0;

    if (snapshot) {
      Y.applyUpdate(this.playbackDoc, snapshot.yDocState);
      rebuildIndex = snapshot.editIndex + 1;
    }

    // Apply edits up to current index
    while (rebuildIndex <= this.currentEditIndex) {
      Y.applyUpdate(this.playbackDoc, edits[rebuildIndex].yUpdate);
      rebuildIndex++;
    }

    const edit = edits[this.currentEditIndex];

    this.emitEvent({
      type: "playback",
      currentEditIndex: this.currentEditIndex,
      totalEdits: edits.length,
      currentTimestamp: edit.timestamp,
      edit,
    });

    return this.playbackDoc;
  }

  /**
   * Pause playback
   */
  public pause(): void {
    this.isPlaying = false;

    this.emitEvent({
      type: "stop",
      currentEditIndex: this.currentEditIndex,
      totalEdits: 0,
      currentTimestamp: Date.now(),
    });
  }

  /**
   * Resume playback
   * Note: Call playForward or playBackward to actually resume
   */
  public resume(): void {
    this.isPlaying = true;
  }

  /**
   * Set playback speed (1.0 is normal, 2.0 is 2x, 0.5 is half)
   */
  public setPlaybackSpeed(speed: number): void {
    if (speed <= 0) {
      throw new Error("Playback speed must be greater than 0");
    }

    this.playbackSpeed = speed;

    this.emitEvent({
      type: "speed-change",
      currentEditIndex: this.currentEditIndex,
      totalEdits: 0,
      currentTimestamp: Date.now(),
    });
  }

  /**
   * Get current playback speed
   */
  public getPlaybackSpeed(): number {
    return this.playbackSpeed;
  }

  /**
   * Check if currently playing
   */
  public isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get current edit index in playback
   */
  public getCurrentEditIndex(): number {
    return this.currentEditIndex;
  }

  /**
   * Get current playback document
   */
  public getPlaybackDocument(): Y.Doc {
    return this.playbackDoc || new Y.Doc();
  }

  /**
   * Subscribe to playback events
   */
  public subscribe(callback: PlaybackEventCallback): () => void {
    this.eventListeners.add(callback);

    return () => {
      this.eventListeners.delete(callback);
    };
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: PlaybackEvent, doc?: Y.Doc): void {
    this.eventListeners.forEach((listener) => {
      listener(event, doc || this.playbackDoc || undefined);
    });
  }

  /**
   * Find closest snapshot before target time
   */
  private findClosestSnapshot(
    targetTime: number,
    snapshots: Snapshot[],
  ): Snapshot | null {
    let closest: Snapshot | null = null;

    for (const snapshot of snapshots) {
      if (snapshot.timestamp <= targetTime) {
        if (!closest || snapshot.timestamp > closest.timestamp) {
          closest = snapshot;
        }
      }
    }

    return closest;
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reset playback engine
   */
  public reset(): void {
    this.playbackDoc = null;
    this.currentEditIndex = 0;
    this.isPlaying = false;
    this.playbackSpeed = 1.0;
  }
}

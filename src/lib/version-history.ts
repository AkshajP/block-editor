import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";

/**
 * Represents a single versioned edit operation
 */
export interface VersionedEdit {
  id: string;
  timestamp: number;
  clientID: number;
  userName: string;
  operation: "insert" | "delete" | "format" | "unknown";
  position: {
    key: string;
    offset: number;
  };
  content: string | null;
  yUpdate: Uint8Array; // Raw Yjs update for reconstruction
  contentLength?: number; // Length of content for insert operations
}

/**
 * Represents a snapshot of document state at a point in time
 */
export interface Snapshot {
  id: string;
  timestamp: number;
  yDocState: Uint8Array; // Full document state
  editIndex: number; // Position in edit history
  docLength: number; // Length of document at this snapshot
}

/**
 * Manages the version history of a collaborative document
 * Captures fine-grained edits and maintains snapshots for efficient playback
 */
export class VersionHistory {
  private edits: VersionedEdit[] = [];
  private snapshots: Snapshot[] = [];
  private snapshotInterval: number;
  private updateListeners: Set<
    (edits: VersionedEdit[], snapshots: Snapshot[]) => void
  > = new Set();
  private editCounter = 0;

  constructor(snapshotInterval: number = 100) {
    this.snapshotInterval = snapshotInterval;
  }

  /**
   * Initialize version tracking for a document
   */
  public initializeVersionTracking(
    doc: Y.Doc,
    awareness: Awareness,
  ): () => void {
    // Create initial snapshot
    this.createSnapshot(doc);

    // Listen to all document updates
    const updateHandler = (update: Uint8Array, _origin: unknown) => {
      this.captureEdit(update, awareness, doc);
    };

    doc.on("update", updateHandler);

    // Return cleanup function
    return () => {
      doc.off("update", updateHandler);
    };
  }

  /**
   * Capture an edit from a Yjs update
   */
  private captureEdit(
    update: Uint8Array,
    awareness: Awareness,
    doc: Y.Doc,
  ): void {
    const currentState = awareness.getLocalState() as Record<
      string,
      unknown
    > | null;
    const timestamp = Date.now();

    // Get document content before and after update to extract what changed
    const stateBefore = Y.encodeStateAsUpdate(doc);

    // Create a temporary doc with the state before this update
    const tempDocBefore = new Y.Doc();
    Y.applyUpdate(tempDocBefore, stateBefore);
    const contentBefore = tempDocBefore.getText("shared").toString();

    // Create a temporary doc with both the previous state and this update
    const tempDocAfter = new Y.Doc();
    Y.applyUpdate(tempDocAfter, stateBefore);
    Y.applyUpdate(tempDocAfter, update);
    const contentAfter = tempDocAfter.getText("shared").toString();

    // Detect operation type by comparing before/after
    let operationType: "insert" | "delete" | "format" | "unknown" = "unknown";
    let content: string | null = null;

    if (contentAfter.length > contentBefore.length) {
      operationType = "insert";
      // Extract what was inserted - simple approach: find the difference
      const diff = contentAfter.length - contentBefore.length;
      if (contentAfter.includes(contentBefore)) {
        const idx = contentAfter.indexOf(contentBefore);
        if (idx === 0) {
          // Inserted at the end
          content = contentAfter.substring(contentBefore.length);
        } else {
          // Inserted in the middle
          content = contentAfter.substring(
            idx + contentBefore.length,
            idx + contentBefore.length + diff,
          );
        }
      } else {
        // Content changed significantly, take first N chars of new content
        content = contentAfter.substring(0, Math.min(50, contentAfter.length));
      }
    } else if (contentAfter.length < contentBefore.length) {
      operationType = "delete";
      content = null; // Don't store deleted content
    } else if (contentAfter !== contentBefore) {
      operationType = "format";
      content = null;
    }

    const editId = `${awareness.clientID}-${timestamp}-${this.editCounter++}`;

    const edit: VersionedEdit = {
      id: editId,
      timestamp,
      clientID: awareness.clientID,
      userName:
        (currentState?.user as Record<string, string> | undefined)?.name ||
        "Unknown",
      operation: operationType,
      position: { key: "ytext", offset: 0 },
      content,
      contentLength: content?.length,
      yUpdate: update,
    };

    this.edits.push(edit);

    // Create snapshots periodically for faster seeking
    if (this.edits.length % this.snapshotInterval === 0) {
      this.createSnapshot(doc);
    }

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Create a snapshot of the current document state
   */
  private createSnapshot(doc: Y.Doc): void {
    const snapshotId = `snap-${Date.now()}-${this.snapshots.length}`;

    const snapshot: Snapshot = {
      id: snapshotId,
      timestamp: Date.now(),
      yDocState: Y.encodeStateAsUpdate(doc),
      editIndex: this.edits.length - 1,
      docLength: this.getDocumentLength(doc),
    };

    this.snapshots.push(snapshot);
  }

  /**
   * Get the approximate length of the document
   */
  private getDocumentLength(doc: Y.Doc): number {
    const ytext = doc.getText("shared");
    return ytext.length;
  }

  /**
   * Get all edits
   */
  public getEdits(): VersionedEdit[] {
    return [...this.edits];
  }

  /**
   * Get all snapshots
   */
  public getSnapshots(): Snapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get edit count
   */
  public getEditCount(): number {
    return this.edits.length;
  }

  /**
   * Find the closest snapshot before a given timestamp
   */
  public findClosestSnapshot(targetTime: number): Snapshot | null {
    let closest: Snapshot | null = null;

    for (const snapshot of this.snapshots) {
      if (snapshot.timestamp <= targetTime) {
        if (!closest || snapshot.timestamp > closest.timestamp) {
          closest = snapshot;
        }
      }
    }

    return closest;
  }

  /**
   * Find edits within a time range
   */
  public findEditsByTimeRange(
    startTime: number,
    endTime: number,
  ): VersionedEdit[] {
    return this.edits.filter(
      (edit) => edit.timestamp >= startTime && edit.timestamp <= endTime,
    );
  }

  /**
   * Find edits by user
   */
  public findEditsByUser(userName: string): VersionedEdit[] {
    return this.edits.filter((edit) => edit.userName === userName);
  }

  /**
   * Get edit timeline (edits grouped by user)
   */
  public getEditTimeline(): Map<string, VersionedEdit[]> {
    const timeline = new Map<string, VersionedEdit[]>();

    for (const edit of this.edits) {
      if (!timeline.has(edit.userName)) {
        timeline.set(edit.userName, []);
      }
      timeline.get(edit.userName)!.push(edit);
    }

    return timeline;
  }

  /**
   * Subscribe to version history changes
   */
  public subscribe(
    listener: (edits: VersionedEdit[], snapshots: Snapshot[]) => void,
  ): () => void {
    this.updateListeners.add(listener);

    return () => {
      this.updateListeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    const edits = this.getEdits();
    const snapshots = this.getSnapshots();

    this.updateListeners.forEach((listener) => {
      listener(edits, snapshots);
    });
  }

  /**
   * Export version history as JSON
   */
  public exportHistory(): {
    edits: VersionedEdit[];
    snapshots: Snapshot[];
    exportTime: number;
  } {
    return {
      edits: this.getEdits(),
      snapshots: this.getSnapshots(),
      exportTime: Date.now(),
    };
  }

  /**
   * Clear all history (use with caution)
   */
  public clearHistory(): void {
    this.edits = [];
    this.snapshots = [];
    this.editCounter = 0;
    this.notifyListeners();
  }

  /**
   * Get statistics about the version history
   */
  public getStatistics(): {
    totalEdits: number;
    totalSnapshots: number;
    editsByUser: Record<string, number>;
    editsByType: Record<string, number>;
    timeSpan: number; // milliseconds from first to last edit
  } {
    const editsByUser: Record<string, number> = {};
    const editsByType: Record<string, number> = {};

    for (const edit of this.edits) {
      editsByUser[edit.userName] = (editsByUser[edit.userName] || 0) + 1;
      editsByType[edit.operation] = (editsByType[edit.operation] || 0) + 1;
    }

    const timeSpan =
      this.edits.length > 0
        ? this.edits[this.edits.length - 1].timestamp - this.edits[0].timestamp
        : 0;

    return {
      totalEdits: this.edits.length,
      totalSnapshots: this.snapshots.length,
      editsByUser,
      editsByType,
      timeSpan,
    };
  }
}

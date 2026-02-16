# Version History & Playback Feature

A comprehensive version control system for the collaborative block editor that captures fine-grained edits, maintains snapshots, and provides powerful playback capabilities.

## Overview

The versioning system automatically tracks all document edits at the word/character level with timestamps and user information. It uses Yjs's built-in update mechanism for storage and provides efficient time-travel reconstruction of the document.

## Architecture

### Core Components

#### 1. **VersionHistory** (`src/lib/version-history.ts`)

Captures and manages all document edits.

**Key Features:**

- Captures individual insert, delete, and format operations
- Stores edits with timestamps, user info, and raw Yjs updates
- Creates snapshots periodically for efficient seeking (default: every 100 edits)
- Provides query methods for finding edits by user, time range, etc.
- Emits change notifications for real-time UI updates

**Key Methods:**

```typescript
initializeVersionTracking(doc, awareness) // Start tracking
getEdits(): VersionedEdit[]
getSnapshots(): Snapshot[]
findEditsByUser(userName): VersionedEdit[]
findEditsByTimeRange(startTime, endTime): VersionedEdit[]
getEditTimeline(): Map<string, VersionedEdit[]>
exportHistory(): { edits, snapshots, exportTime }
```

#### 2. **PlaybackEngine** (`src/lib/playback-engine.ts`)

Reconstructs document state and provides playback controls.

**Key Features:**

- Seeks to any point in time or edit index
- Forward and backward playback with adjusted speed
- Step-by-step navigation through edits
- Efficient reconstruction using snapshots
- Events for monitoring playback state

**Key Methods:**

```typescript
seekToTimestamp(targetTime, edits, snapshots): Y.Doc
seekToEditIndex(targetIndex, edits, snapshots): Y.Doc
playForward(edits, snapshots, onUpdate): Promise<boolean>
playBackward(edits, snapshots, onUpdate): Promise<boolean>
stepForward(edits, snapshots): Y.Doc
stepBackward(edits, snapshots): Y.Doc
setPlaybackSpeed(speed): void
```

#### 3. **useVersionHistory Hook** (`src/hooks/use-version-history.ts`)

React hook that manages version history and playback.

**Provides:**

- Automatic initialization when doc/awareness change
- State management for edits, snapshots, and statistics
- Convenient wrappers around PlaybackEngine methods
- Subscription to playback events

**Usage:**

```typescript
const versionHistory = useVersionHistory(doc, awareness, enabled);

// Access state
const { edits, snapshots, isInitialized, statistics } = versionHistory;

// Control playback
await versionHistory.playForward();
versionHistory.seekToTimestamp(timestamp);
versionHistory.setPlaybackSpeed(2.0);
```

### UI Components

#### 1. **VersionPlayback** (`src/components/VersionPlayback.tsx`)

Complete playback control interface with progress slider.

**Features:**

- Play/pause/step forward/backward controls
- Progress slider for seeking
- Playback speed adjustment (0.25x - 4x)
- Current edit information display
- Edit statistics (by type and user)
- Compact mode for space-constrained layouts

#### 2. **VersionHistoryViewer** (`src/components/VersionHistoryViewer.tsx`)

Detailed table view of all edits with filtering.

**Features:**

- Searchable table of all edits
- Filter by user, operation type
- Sort by timestamp (ascending/descending)
- Click to select and jump to specific edit

#### 3. **VersionTimeline** (`src/components/VersionTimeline.tsx`)

Visual timeline showing edits per user.

**Features:**

- Color-coded timeline for each collaborator
- Visual indication of operation type (insert/delete/format)
- Click any point to jump to that edit
- Hover tooltips with detailed edit info

## Data Structures

### VersionedEdit

```typescript
interface VersionedEdit {
  id: string; // Unique identifier
  timestamp: number; // Created time
  clientID: number; // Yjs client ID
  userName: string; // User display name
  operation: "insert" | "delete" | "format" | "unknown";
  position: { key: string; offset: number };
  content: string | null; // Insert content or null for delete
  yUpdate: Uint8Array; // Raw Yjs update
  contentLength?: number; // Length of inserted content
}
```

### Snapshot

```typescript
interface Snapshot {
  id: string;
  timestamp: number;
  yDocState: Uint8Array; // Full document state
  editIndex: number; // Edits applied so far
  docLength: number; // Document length at snapshot
}
```

## Usage Examples

### Basic Integration

```typescript
import { VersionPlayback } from '@/components/VersionPlayback';
import { VersionTimeline } from '@/components/VersionTimeline';
import { useVersionHistory } from '@/hooks/use-version-history';

export function EditorWithVersioning() {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);

  const versionHistory = useVersionHistory(doc, awareness);

  return (
    <div className="flex flex-col gap-4">
      {/* Editor */}
      <Editor doc={doc} awareness={awareness} />

      {/* Playback Controls */}
      <VersionPlayback doc={doc} awareness={awareness} />

      {/* Timeline Visualization */}
      <VersionTimeline
        edits={versionHistory.edits}
        currentEditIndex={versionHistory.getCurrentEditIndex()}
        onEditSelect={(edit, index) => {
          versionHistory.seekToEditIndex(index);
        }}
      />

      {/* History Viewer */}
      <VersionHistoryViewer
        edits={versionHistory.edits}
        onEditSelect={(edit, index) => {
          versionHistory.seekToEditIndex(index);
        }}
      />
    </div>
  );
}
```

### Advanced Playback

```typescript
const versionHistory = useVersionHistory(doc, awareness);

// Play with custom update handler
await versionHistory.playForward((event, doc) => {
  console.log(`Edit ${event.currentEditIndex}:`, event.edit?.userName);
  updatePreviewDocument(doc);
});

// Seek to specific time
const oneHourAgo = Date.now() - 3600000;
versionHistory.seekToTimestamp(oneHourAgo);

// Find all edits by a specific user
const userEdits = versionHistory.findEditsByUser("Swift Panda");
console.log(`${userEdits.length} edits from ${userEdits[0]?.userName}`);

// Export history for archival
const exported = versionHistory.exportHistory();
localStorage.setItem("version-history", JSON.stringify(exported));
```

### Filtering Timeline

```typescript
const versionHistory = useVersionHistory(doc, awareness);

// Find edits within time range
const lastHour = versionHistory.findEditsByTimeRange(
  Date.now() - 3600000,
  Date.now(),
);

// Get edits grouped by user
const timeline = versionHistory.getTimeline();
timeline.forEach((edits, userName) => {
  console.log(`${userName}: ${edits.length} edits`);
});

// Access statistics
const stats = versionHistory.statistics;
console.log(`Total edits: ${stats.totalEdits}`);
console.log(`Edit types:`, stats.editsByType);
console.log(`Edits by user:`, stats.editsByUser);
```

## Playback Speed

The playback engine respects the time between edits (capped at 2 seconds max).

**Speed Multipliers:**

- `0.25x` - Quarter speed (4x slower)
- `1.0x` - Normal speed (actual timestamps)
- `2.0x` - Double speed (2x faster)
- `4.0x` - Quadruple speed (4x faster)

Example:

```typescript
versionHistory.setPlaybackSpeed(2.0); // Play at 2x speed
// Wait for playback to finish
await versionHistory.playForward();
```

## Snapshots

Snapshots are created automatically every 100 edits and are used to optimize playback seeking.

**Benefits:**

- Faster seeking to future timestamps (avoid replaying all edits)
- Memory-efficient reconstruction
- Logarithmic seek time regardless of edit count

**Configuration:**

```typescript
// Create custom VersionHistory with different snapshot interval
const versionHistory = new VersionHistory(50); // Snapshot every 50 edits
versionHistory.initializeVersionTracking(doc, awareness);
```

## Events and Subscriptions

### Listen to Playback Events

```typescript
const versionHistory = useVersionHistory(doc, awareness);

const unsubscribe = versionHistory.subscribeToPlayback((event, doc) => {
  switch (event.type) {
    case "seek":
      console.log(`Sought to edit ${event.currentEditIndex}`);
      break;
    case "playback":
      console.log(`Playing edit ${event.currentEditIndex}`);
      updateUI(doc);
      break;
    case "stop":
      console.log(`Playback finished`);
      break;
    case "speed-change":
      console.log(`Speed changed to ${versionHistory.getPlaybackSpeed()}x`);
      break;
  }
});

// Cleanup
unsubscribe();
```

## Storage and Persistence

The versioning system uses Yjs's built-in binary format for storage. You can export the history for persistence:

```typescript
// Export
const exported = versionHistory.exportHistory();
const json = JSON.stringify(exported);
localStorage.setItem("editor-history", json);

// Note: Importing requires manual reconstruction
// For now, restart the editor to resume tracking
```

## Performance Considerations

- **Memory**: Each edit stores a Yjs update (typically 20-100 bytes). 1000 edits ≈ 50KB
- **Snapshots**: Full document state snapshots (size varies with content)
- **Playback**: Linear time complexity based on number of edits
- **Seeking**: Logarithmic when using snapshots

**For Large Documents:**

- Increase snapshot interval: `new VersionHistory(500)`
- Periodically export and clear history: `versionHistory.exportHistory()` then `versionHistory.clearHistory()`
- Disable tracking for offline-only editor: `useVersionHistory(doc, awareness, false)`

## Limitations

1. **Operation Detection**: Currently uses heuristics to detect insert/delete/format. More sophisticated detection would require Yjs update decoding.
2. **Content Extraction**: For privacy, original content from system/network is included but could be excluded
3. **Undo/Redo**: Version history is separate from Lexical's HistoryPlugin. They work independently.
4. **Real-time Sync**: Changes are captured from the Yjs doc, so synced changes from other clients are also recorded

## Troubleshooting

**No edits recorded:**

- Ensure `doc` and `awareness` are properly passed to the hook
- Check that `enabled` is `true` in the hook parameters
- Verify Yjs document is initialized before tracking starts

**Playback seems slow:**

- Check playback speed setting (may be < 1.0x)
- Verify there are large time gaps between edits
- Increase speed: `versionHistory.setPlaybackSpeed(4.0)`

**Memory usage growing:**

- Export and clear history periodically
- Increase snapshot interval (fewer snapshots = less memory but slower seeking)
- Consider disabling tracking for read-only editors

## Future Enhancements

- [ ] Sophisticated Yjs update decoder for better operation detection
- [ ] Collaborative playback (show all users' cursors during replay)
- [ ] Branching/diffing between versions
- [ ] Selective history replay per user
- [ ] Version history persistence with IndexedDB
- [ ] Compression of Yjs updates for storage
- [ ] Diff visualization between snapshots

"use client";

import { Globe, Lock, Shield, UserMinus, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserResult {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

interface MemberEntry {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  roleId: string;
  roleName: string;
}

interface BlocklistEntry {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

interface Role {
  id: string;
  name: string;
}

type DocumentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  workspaceId: string;
  status: DocumentStatus;
  isPublic: boolean;
  onIsPublicChange: (v: boolean) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── User search combobox ───────────────────────────────────────────────────────

function UserSearch({
  workspaceId,
  placeholder,
  excludeIds,
  onSelect,
}: {
  workspaceId: string;
  placeholder: string;
  excludeIds: string[];
  onSelect: (user: UserResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    (q: string) => {
      fetch(
        `/api/users/search?q=${encodeURIComponent(q)}&workspaceId=${workspaceId}`,
      )
        .then((r) => r.json())
        .then((data: UserResult[]) => {
          setResults(data.filter((u) => !excludeIds.includes(u.id)));
          setOpen(true);
        })
        .catch(() => {});
    },
    [workspaceId, excludeIds],
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length === 0) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => search(v), 200);
  }

  function handleSelect(user: UserResult) {
    onSelect(user);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => query.trim() && setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 bg-white"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-56 overflow-y-auto">
          {results.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(u);
                }}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={u.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {initials(u.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {u.displayName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{u.email}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && results.length === 0 && query.trim().length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg px-3 py-2 text-sm text-slate-400">
          No users found
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function VisibilityModal({
  open,
  onOpenChange,
  documentId,
  workspaceId,
  status,
  isPublic,
  onIsPublicChange,
}: Props) {
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"access" | "blocklist">("access");

  // Load data when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [m, b, r] = await Promise.all([
          fetch(`/api/documents/${documentId}/members`).then((r) => r.json()),
          fetch(`/api/documents/${documentId}/blocklist`).then((r) => r.json()),
          fetch(`/api/roles`).then((r) => r.json()).catch(() => [] as Role[]),
        ]);
        if (cancelled) return;
        setMembers(Array.isArray(m) ? m : []);
        setBlocklist(Array.isArray(b) ? b : []);
        setRoles(Array.isArray(r) ? r : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [open, documentId]);

  // ── Members ──────────────────────────────────────────────────────────────────

  async function addMember(user: UserResult, roleId: string) {
    const res = await fetch(`/api/documents/${documentId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, roleId }),
    });
    if (!res.ok) return;
    const entry: MemberEntry = await res.json();
    setMembers((prev) => {
      const filtered = prev.filter((m) => m.userId !== entry.userId);
      return [...filtered, entry];
    });
  }

  async function updateMemberRole(userId: string, roleId: string) {
    const res = await fetch(`/api/documents/${documentId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId }),
    });
    if (!res.ok) return;
    const entry: MemberEntry = await res.json();
    setMembers((prev) => prev.map((m) => (m.userId === userId ? entry : m)));
  }

  async function removeMember(userId: string) {
    const res = await fetch(`/api/documents/${documentId}/members/${userId}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }

  // ── Blocklist ─────────────────────────────────────────────────────────────────

  async function addToBlocklist(user: UserResult) {
    const res = await fetch(`/api/documents/${documentId}/blocklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    if (!res.ok) return;
    const entry: BlocklistEntry = await res.json();
    setBlocklist((prev) => [
      ...prev.filter((b) => b.userId !== entry.userId),
      entry,
    ]);
  }

  async function removeFromBlocklist(userId: string) {
    const res = await fetch(
      `/api/documents/${documentId}/blocklist/${userId}`,
      {
        method: "DELETE",
      },
    );
    if (!res.ok) return;
    setBlocklist((prev) => prev.filter((b) => b.userId !== userId));
  }

  // ── Visibility toggle ─────────────────────────────────────────────────────────

  async function toggleVisibility() {
    const next = !isPublic;
    const res = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: next }),
    });
    if (res.ok) onIsPublicChange(next);
  }

  const memberIds = members.map((m) => m.userId);
  const blocklistIds = blocklist.map((b) => b.userId);

  // Default role for new members: first non-Admin role
  const defaultRoleId =
    roles.find((r) => r.name === "Viewer")?.id ??
    roles.find((r) => r.name !== "Admin")?.id ??
    roles[0]?.id ??
    "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Visibility & Access</DialogTitle>
        </DialogHeader>

        {/* ── Visibility switch ── */}
        {status === "PUBLISHED" ? (
          <div className="rounded-lg border border-slate-200 p-4 flex items-start gap-4">
            <div className="mt-0.5">
              {isPublic ? (
                <Globe size={20} className="text-blue-500" />
              ) : (
                <Lock size={20} className="text-slate-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900">
                {isPublic ? "Public to workspace" : "Private (invite-only)"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {isPublic
                  ? "All workspace members can read this document."
                  : "Only explicitly invited users can access this document."}
              </p>
            </div>
            <button
              onClick={toggleVisibility}
              className={`shrink-0 text-xs px-3 py-1.5 rounded border transition-colors ${
                isPublic
                  ? "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                  : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
              }`}
            >
              {isPublic ? "Make private" : "Make public"}
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 p-4 flex items-start gap-4 bg-slate-50">
            <div className="mt-0.5">
              <Lock size={20} className="text-slate-400" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-700">Invite-only</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {status === "ARCHIVED"
                  ? "Archived documents are always invite-only."
                  : "Draft documents are always invite-only. Publish to make this document visible to the workspace."}
              </p>
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex border-b border-slate-200 mt-1">
          <TabButton active={tab === "access"} onClick={() => setTab("access")}>
            <UserPlus size={13} />
            Explicit access
          </TabButton>
          <TabButton
            active={tab === "blocklist"}
            onClick={() => setTab("blocklist")}
            disabled={status !== "PUBLISHED" || !isPublic}
            title={
              status !== "PUBLISHED"
                ? "Blocklist only applies to published public documents"
                : !isPublic
                  ? "Blocklist only applies when the document is public"
                  : undefined
            }
          >
            <Shield size={13} />
            Block list
            {(status !== "PUBLISHED" || !isPublic) && (
              <span className="ml-1 text-[10px] text-slate-400">
                (public only)
              </span>
            )}
          </TabButton>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">
            Loading…
          </div>
        ) : tab === "access" ? (
          <AccessTab
            members={members}
            roles={roles}
            defaultRoleId={defaultRoleId}
            workspaceId={workspaceId}
            excludeIds={memberIds}
            onAdd={addMember}
            onChangeRole={updateMemberRole}
            onRemove={removeMember}
          />
        ) : (
          <BlocklistTab
            entries={blocklist}
            workspaceId={workspaceId}
            excludeIds={blocklistIds}
            onAdd={addToBlocklist}
            onRemove={removeFromBlocklist}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  disabled,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "border-slate-900 text-slate-900 font-medium"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

// ── Access tab ────────────────────────────────────────────────────────────────

function AccessTab({
  members,
  roles,
  defaultRoleId,
  workspaceId,
  excludeIds,
  onAdd,
  onChangeRole,
  onRemove,
}: {
  members: MemberEntry[];
  roles: Role[];
  defaultRoleId: string;
  workspaceId: string;
  excludeIds: string[];
  onAdd: (user: UserResult, roleId: string) => void;
  onChangeRole: (userId: string, roleId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const pendingRoleId = selectedRoleId || defaultRoleId;

  return (
    <div className="space-y-3">
      {/* Add user row */}
      <div className="flex gap-2">
        <div className="flex-1">
          <UserSearch
            workspaceId={workspaceId}
            placeholder="Search by name or email…"
            excludeIds={excludeIds}
            onSelect={(user) => onAdd(user, pendingRoleId)}
          />
        </div>
        {roles.length > 0 && (
          <select
            value={pendingRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 bg-white"
          >
            {roles
              .filter((r) => r.name !== "Admin")
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        )}
      </div>

      {/* Member list */}
      {members.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-4">
          No explicit members yet. Search above to add someone.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 overflow-hidden">
          {members.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              roles={roles}
              onChangeRole={onChangeRole}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function MemberRow({
  member,
  roles,
  onChangeRole,
  onRemove,
}: {
  member: MemberEntry;
  roles: Role[];
  onChangeRole: (userId: string, roleId: string) => void;
  onRemove: (userId: string) => void;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 bg-white">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={member.avatarUrl ?? undefined} />
        <AvatarFallback className="text-xs">
          {initials(member.displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">
          {member.displayName}
        </p>
        <p className="text-xs text-slate-500 truncate">{member.email}</p>
      </div>
      {roles.length > 0 && (
        <select
          value={member.roleId}
          onChange={(e) => onChangeRole(member.userId, e.target.value)}
          className="rounded border border-slate-200 px-1.5 py-1 text-xs text-slate-700 outline-none focus:border-slate-400 bg-white"
        >
          {roles
            .filter((r) => r.name !== "Admin")
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
      )}
      <button
        onClick={() => onRemove(member.userId)}
        className="shrink-0 text-slate-400 hover:text-red-500 transition-colors"
        title="Remove access"
      >
        <X size={15} />
      </button>
    </li>
  );
}

// ── Blocklist tab ─────────────────────────────────────────────────────────────

function BlocklistTab({
  entries,
  workspaceId,
  excludeIds,
  onAdd,
  onRemove,
}: {
  entries: BlocklistEntry[];
  workspaceId: string;
  excludeIds: string[];
  onAdd: (user: UserResult) => void;
  onRemove: (userId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Blocked users cannot access this document even though it is public to
        the workspace.
      </p>

      <UserSearch
        workspaceId={workspaceId}
        placeholder="Search workspace members to block…"
        excludeIds={excludeIds}
        onSelect={onAdd}
      />

      {entries.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-4">
          No users blocked.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 overflow-hidden">
          {entries.map((e) => (
            <li
              key={e.userId}
              className="flex items-center gap-3 px-3 py-2.5 bg-white"
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={e.avatarUrl ?? undefined} />
                <AvatarFallback className="text-xs">
                  {initials(e.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {e.displayName}
                </p>
                <p className="text-xs text-slate-500 truncate">{e.email}</p>
              </div>
              <button
                onClick={() => onRemove(e.userId)}
                className="shrink-0 text-slate-400 hover:text-green-600 transition-colors"
                title="Unblock user"
              >
                <UserMinus size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

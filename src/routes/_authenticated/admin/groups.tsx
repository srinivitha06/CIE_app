import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listGroupsFn, createGroupFn, renameGroupFn, deleteGroupFn,
  getGroupFn, addGroupMembersFn, removeGroupMemberFn,
  listStudentsFn, listClassesFn,
} from "@/lib/admin.functions";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Pencil, Users, X, Check, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/groups")({
  head: () => ({ meta: [{ title: "Groups · Admin" }] }),
  component: GroupsPage,
});

function GroupsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listGroupsFn);
  const create = useServerFn(createGroupFn);
  const rename = useServerFn(renameGroupFn);
  const del = useServerFn(deleteGroupFn);

  const groupsQ = useQuery({ queryKey: ["groups"], queryFn: () => list() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["groups"] });

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const createMut = useMutation({
    mutationFn: () => create({ data: { name: newName.trim(), description: newDesc.trim() || null } }),
    onSuccess: () => { toast.success("Group created"); setNewName(""); setNewDesc(""); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const renameMut = useMutation({
    mutationFn: (vars: { id: string; name: string; description: string | null }) => rename({ data: vars }),
    onSuccess: () => { toast.success("Group updated"); setEditId(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Group deleted"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to admin
      </Link>
      <div className="mt-4 mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Groups & cohorts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create cohorts (e.g. "ECE 3rd Year A") to bulk-assign exams.</p>
        </div>
      </div>

      {/* Create new */}
      <form onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createMut.mutate(); }} className="mb-6 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Create group</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <input required maxLength={100} placeholder="Name (e.g. ECE 3rd Year A)" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
          <input maxLength={500} placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
          <button disabled={createMut.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {createMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Create
          </button>
        </div>
      </form>

      {/* List */}
      {groupsQ.isLoading ? (
        <p className="text-sm text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin" /> Loading…</p>
      ) : (groupsQ.data?.groups ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No groups yet. Create your first cohort above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(groupsQ.data?.groups ?? []).map((g: any) => (
            <div key={g.id} className="rounded-lg border border-border bg-card p-4">
              {editId === g.id ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
                  <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => renameMut.mutate({ id: g.id, name: editName.trim(), description: editDesc.trim() || null })} disabled={renameMut.isPending} className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                      {renameMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                    </button>
                    <button onClick={() => setEditId(null)} className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{g.name}</p>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{g.member_count} student{g.member_count === 1 ? "" : "s"}</span>
                    </div>
                    {g.description && <p className="mt-0.5 text-xs text-muted-foreground">{g.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setOpenGroupId(g.id)} className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-secondary">
                      <Users className="h-3 w-3" /> Manage members
                    </button>
                    <button title="Rename" onClick={() => { setEditId(g.id); setEditName(g.name); setEditDesc(g.description || ""); }} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                    <button title="Delete" onClick={() => { if (confirm(`Delete group "${g.name}"? Students will not be deleted.`)) delMut.mutate(g.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {openGroupId && <MembersDialog groupId={openGroupId} onClose={() => { setOpenGroupId(null); invalidate(); }} />}
    </div>
  );
}

function MembersDialog({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const getGroup = useServerFn(getGroupFn);
  const listSt = useServerFn(listStudentsFn);
  const listCls = useServerFn(listClassesFn);
  const addMembers = useServerFn(addGroupMembersFn);
  const removeMember = useServerFn(removeGroupMemberFn);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");

  const groupQ = useQuery({ queryKey: ["group", groupId], queryFn: () => getGroup({ data: { id: groupId } }) });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: () => listCls() });
  const studentsQ = useQuery({
    queryKey: ["students", search, classFilter],
    queryFn: () => listSt({ data: { search, class_name: classFilter || undefined } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["group", groupId] });
  const memberIds = new Set((groupQ.data?.students ?? []).map((s: any) => s.id));

  const addMut = useMutation({
    mutationFn: (ids: string[]) => addMembers({ data: { group_id: groupId, student_ids: ids } }),
    onSuccess: (r) => { toast.success(`Added ${r.added} student(s)`); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const removeMut = useMutation({
    mutationFn: (studentId: string) => removeMember({ data: { group_id: groupId, student_id: studentId } }),
    onSuccess: () => { toast.success("Removed"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const visible = studentsQ.data?.students ?? [];
  const visibleNotMembers = visible.filter((s: any) => !memberIds.has(s.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl rounded-lg border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">Members of "{groupQ.data?.group?.name ?? "…"}"</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{(groupQ.data?.students ?? []).length} student(s) in this group</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Add students</h4>
            <div className="mb-2 grid grid-cols-[1fr_120px] gap-2">
              <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 rounded-md border border-input bg-background px-3 text-xs" />
              <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                <option value="">All classes</option>
                {(classesQ.data?.classes ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {classFilter && visibleNotMembers.length > 0 && (
              <button onClick={() => addMut.mutate(visibleNotMembers.map((s: any) => s.id))} disabled={addMut.isPending} className="mb-2 inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {addMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add all in "{classFilter}" ({visibleNotMembers.length})
              </button>
            )}
            <div className="max-h-[400px] space-y-1 overflow-y-auto rounded-md border border-border bg-background p-1">
              {visibleNotMembers.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground">No students to add.</p>
              ) : visibleNotMembers.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-secondary">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.full_name || s.email}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{s.email}{s.class_name ? ` · ${s.class_name}` : ""}</p>
                  </div>
                  <button onClick={() => addMut.mutate([s.id])} disabled={addMut.isPending} className="ml-2 inline-flex h-6 items-center rounded bg-primary px-2 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Add</button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Current members ({(groupQ.data?.students ?? []).length})</h4>
            <div className="max-h-[440px] space-y-1 overflow-y-auto rounded-md border border-border bg-background p-1">
              {(groupQ.data?.students ?? []).length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground">No members yet.</p>
              ) : (groupQ.data?.students ?? []).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-secondary">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.full_name || s.email}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{s.email}{s.class_name ? ` · ${s.class_name}` : ""}</p>
                  </div>
                  <button onClick={() => removeMut.mutate(s.id)} disabled={removeMut.isPending} className="ml-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

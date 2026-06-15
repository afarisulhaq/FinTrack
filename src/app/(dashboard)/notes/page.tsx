"use client";

import { useState, useMemo } from "react";
import { FileText, Plus, Search, Edit, Trash2, Tag, X } from "lucide-react";
import { motion } from "framer-motion";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { Input } from "~/components/ui/input";
import { useFinanceStore } from "~/store/useFinanceStore";
import { formatDate } from "~/lib/utils";

const NOTE_COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#38bdf8", "#ec4899", "#8b5cf6",
] as const;

const NOTE_BG: Record<string, string> = {
  "#6366f1": "rgba(99,102,241,0.08)",
  "#22c55e": "rgba(34,197,94,0.08)",
  "#f59e0b": "rgba(245,158,11,0.08)",
  "#38bdf8": "rgba(56,189,248,0.08)",
  "#ec4899": "rgba(236,72,153,0.08)",
  "#8b5cf6": "rgba(139,92,246,0.08)",
};

const DEFAULT_NOTE_COLOR = "#6366f1";

export default function NotesPage() {
  const notes = useFinanceStore((s) => s.notes);
  const addNote = useFinanceStore((s) => s.addNote);
  const updateNote = useFinanceStore((s) => s.updateNote);
  const deleteNote = useFinanceStore((s) => s.deleteNote);

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", content: "", tags: "", color: DEFAULT_NOTE_COLOR,
  });

  const filteredNotes = useMemo(() => {
    if (!search) return notes;
    const q = search.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [notes, search]);

  function openAddModal() {
    setEditingNote(null);
    setForm({ title: "", content: "", tags: "", color: DEFAULT_NOTE_COLOR });
    setShowModal(true);
  }

  function openEditModal(noteId: string) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    setEditingNote(noteId);
    setForm({
      title: note.title,
      content: note.content,
      tags: (note.tags || []).join(", "),
      color: note.color || DEFAULT_NOTE_COLOR,
    });
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title) return;
    const tagsArr = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (editingNote) {
      updateNote(editingNote, { title: form.title, content: form.content, tags: tagsArr, color: form.color });
    } else {
      addNote({ title: form.title, content: form.content, tags: tagsArr, color: form.color });
    }
    setShowModal(false);
    setEditingNote(null);
  }

  const fld = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <PageWrapper
      title="Catatan"
      subtitle="Simpan ide dan catatan keuangan kamu"
      actions={
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openAddModal}>
          Tambah Catatan
        </Button>
      }
    >
      {/* ── Search ──────────────────────────────────────────────────── */}
      <Input
        placeholder="Cari catatan..."
        leftIcon={<Search className="h-4 w-4" />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        rightIcon={
          search ? (
            <button onClick={() => setSearch("")} className="hover:text-text-primary">
              <X className="h-4 w-4" />
            </button>
          ) : undefined
        }
      />

      {/* ── Notes Masonry Grid ───────────────────────────────────────── */}
      {filteredNotes.length > 0 ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
          {filteredNotes.map((note) => {
            const color = note.color || DEFAULT_NOTE_COLOR;
            const bg = NOTE_BG[color] || "rgba(99,102,241,0.08)";
            const tags = note.tags || [];
            return (
              <motion.div
                key={note.id}
                className="break-inside-avoid group cursor-pointer"
                whileHover={{ scale: 1.015, y: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <div
                  className="rounded-xl border p-4 flex flex-col gap-3 transition-shadow hover:shadow-lg"
                  style={{
                    backgroundColor: bg,
                    borderColor: `${color}25`,
                  }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className="font-semibold text-sm leading-snug"
                      style={{ color: "#f1f5f9" }}
                    >
                      {note.title}
                    </h3>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(note.id); }}
                        className="h-6 w-6 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                        className="h-6 w-6 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Content preview */}
                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-4 whitespace-pre-line">
                    {note.content}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t" style={{ borderColor: `${color}20` }}>
                    <div className="flex flex-wrap gap-1">
                      {tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: `${color}15`, color: color }}
                        >
                          {tag}
                        </span>
                      ))}
                      {tags.length > 3 && (
                        <span className="text-[10px] text-text-muted">+{tags.length - 3}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-text-muted shrink-0">{formatDate(note.updatedAt)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card className="py-16 text-center">
          <FileText className="h-10 w-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted">
            {search ? "Tidak ada catatan yang cocok" : "Belum ada catatan. Buat catatan pertama kamu!"}
          </p>
          {!search && (
            <Button variant="outline" size="sm" className="mt-4" onClick={openAddModal}>
              <Plus className="h-4 w-4" />
              Buat Catatan
            </Button>
          )}
        </Card>
      )}

      {/* ── Add / Edit Note Modal ────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingNote(null); }}
        title={editingNote ? "Edit Catatan" : "Catatan Baru"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Judul" placeholder="Judul catatan..." value={form.title} onChange={(e) => fld("title", e.target.value)} required />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Isi Catatan</label>
            <textarea
              value={form.content}
              onChange={(e) => fld("content", e.target.value)}
              placeholder="Tulis catatan kamu di sini..."
              rows={8}
              className="w-full px-3 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none leading-relaxed"
            />
          </div>
          <Input
            label="Tag (pisahkan dengan koma)"
            placeholder="cth. rencana, investasi, tips"
            leftIcon={<Tag className="h-3.5 w-3.5" />}
            value={form.tags}
            onChange={(e) => fld("tags", e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Warna</label>
            <div className="flex gap-2">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => fld("color", c)}
                  className={`w-7 h-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-offset-bg-surface ring-white scale-110" : "opacity-70 hover:opacity-100"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Batal</Button>
            <Button type="submit">{editingNote ? "Simpan Perubahan" : "Buat Catatan"}</Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}

import { useState } from "react";
import { fmtDate } from "../utils/patientUtils";

const NOTE_CATEGORIES = [
  { key: "reception", label: "Reception", icon: "ti-phone-call", color: "#4f7cff" },
  { key: "clinical",  label: "Clinical",  icon: "ti-stethoscope", color: "#7c4fff" },
  { key: "billing",   label: "Billing",   icon: "ti-receipt", color: "#f59e0b" },
  { key: "insurance", label: "Insurance", icon: "ti-shield", color: "#22c55e" },
  { key: "followup",  label: "Follow-Up", icon: "ti-clock", color: "#ec4899" },
];

const NOTE_TEMPLATES = [
  { category: "reception", label: "Insurance Pending", text: "Insurance verification in progress. Documents submitted on {date}." },
  { category: "reception", label: "Phone Verified", text: "Phone number verified via OTP. Patient confirmed identity." },
  { category: "reception", label: "ID Verified", text: "Government ID verified. Document type: {id_type}." },
  { category: "clinical",  label: "Routine Follow-Up", text: "Routine follow-up consultation. Patient reports {symptoms}." },
  { category: "clinical",  label: "Medication Review", text: "Current medications reviewed. No changes required." },
  { category: "clinical",  label: "Vitals Normal", text: "Vitals within normal range. BP: {bp}, HR: {hr}." },
  { category: "billing",   label: "Payment Pending", text: "Outstanding balance: {amount}. Payment due by {date}." },
  { category: "billing",   label: "Payment Received", text: "Payment of {amount} received via {method}." },
  { category: "insurance", label: "Claim Submitted", text: "Insurance claim submitted for {service}. Claim ID: {claim_id}." },
  { category: "insurance", label: "Authorization Needed", text: "Prior authorization required for {treatment}. Contact insurer." },
  { category: "followup",  label: "Call Scheduled", text: "Follow-up call scheduled for {date} at {time}." },
  { category: "followup",  label: "No Answer", text: "Attempted follow-up call. No answer. Left voicemail." },
];

export default function PatientNotes({ notes: notesProp, onNotesChange, patient }) {
  // Supports lifted-state (notesProp + onNotesChange) or standalone (patient.notes)
  const [localNotes, setLocalNotes] = useState(notesProp ?? patient?.notes ?? []);
  const notes = notesProp != null ? notesProp : localNotes;
  const [newNote, setNewNote] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("reception");
  const [showTemplates, setShowTemplates] = useState(false);

  function update(updated) {
    if (onNotesChange) onNotesChange(updated);
    else setLocalNotes(updated);
  }

  function addNote() {
    const text = newNote.trim();
    if (!text) return;
    update([
      ...notes,
      {
        id: `note-${Date.now()}`,
        text,
        pinned: false,
        date: new Date().toISOString().split("T")[0],
        category: selectedCategory,
        author: "Staff", // In real app, this would be current user
      },
    ]);
    setNewNote("");
  }

  function applyTemplate(template) {
    setNewNote(template.text);
    setSelectedCategory(template.category);
    setShowTemplates(false);
  }

  function togglePin(id) {
    update(notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  }

  function deleteNote(id) {
    update(notes.filter((n) => n.id !== id));
  }

  const pinned = notes.filter((n) => n.pinned);
  const rest = notes.filter((n) => !n.pinned);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Category Selector ── */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {NOTE_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500,
              cursor: "pointer",
              border: `1px solid ${selectedCategory === cat.key ? cat.color : "var(--border)"}`,
              background: selectedCategory === cat.key ? cat.color + "15" : "var(--surface2)",
              color: selectedCategory === cat.key ? cat.color : "var(--muted)",
              transition: "all 0.12s",
            }}
          >
            <i className={`ti ${cat.icon}`} style={{ fontSize: 10 }} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Input with Templates ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder={`Add ${NOTE_CATEGORIES.find(c => c.key === selectedCategory)?.label.toLowerCase()} note…`}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNote()}
            style={{ flex: 1, fontSize: 13 }}
          />
          <button
            className="btn btn-primary"
            style={{ padding: "7px 12px", fontSize: 13 }}
            onClick={addNote}
          >
            <i className="ti ti-plus" style={{ fontSize: 13 }} />
          </button>
        </div>
        
        {/* Template Button */}
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "4px 8px", fontSize: 11, fontWeight: 500,
            background: "none", border: "none", cursor: "pointer",
            color: "var(--accent)", alignSelf: "flex-start",
          }}
        >
          <i className="ti ti-template" style={{ fontSize: 11 }} />
          Use Template
          <i className={`ti ti-chevron-${showTemplates ? "up" : "down"}`} style={{ fontSize: 10 }} />
        </button>

        {/* Templates Dropdown */}
        {showTemplates && (
          <div style={{
            padding: "8px 0", background: "var(--surface)",
            border: "1px solid var(--border)", borderRadius: 8,
            display: "flex", flexDirection: "column", gap: 2,
          }}>
            {NOTE_TEMPLATES.filter(t => t.category === selectedCategory).map((t) => (
              <button
                key={t.label}
                onClick={() => applyTemplate(t)}
                style={{
                  padding: "6px 12px", fontSize: 12, cursor: "pointer",
                  background: "none", border: "none", textAlign: "left",
                  color: "var(--text)", display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <i className="ti ti-file-text" style={{ fontSize: 11, color: "var(--muted)" }} />
                {t.label}
              </button>
            ))}
            {NOTE_TEMPLATES.filter(t => t.category === selectedCategory).length === 0 && (
              <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--muted)" }}>
                No templates for this category
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Pinned ── */}
      {pinned.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <GroupLabel icon="ti-pin-filled" color="#92400e">Pinned</GroupLabel>
          {pinned.map((n) => (
            <NoteCard key={n.id} note={n} pinned onTogglePin={togglePin} onDelete={deleteNote} />
          ))}
        </div>
      )}

      {/* ── Notes by Category ── */}
      {NOTE_CATEGORIES.map((cat) => {
        const categoryNotes = rest.filter((n) => n.category === cat.key);
        if (categoryNotes.length === 0) return null;
        return (
          <div key={cat.key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <GroupLabel icon={cat.icon} color={cat.color}>{cat.label}</GroupLabel>
            {categoryNotes.map((n) => (
              <NoteCard key={n.id} note={n} onTogglePin={togglePin} onDelete={deleteNote} />
            ))}
          </div>
        );
      })}

      {/* Uncategorized notes */}
      {rest.filter((n) => !n.category).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <GroupLabel icon="ti-notes" color="var(--muted)">General</GroupLabel>
          {rest.filter((n) => !n.category).map((n) => (
            <NoteCard key={n.id} note={n} onTogglePin={togglePin} onDelete={deleteNote} />
          ))}
        </div>
      )}

      {notes.length === 0 && (
        <div style={{ color: "var(--muted)", fontSize: 13 }}>No notes yet.</div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GroupLabel({ icon, color, children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700,
      color, textTransform: "uppercase", letterSpacing: "0.07em",
      display: "flex", alignItems: "center", gap: 4,
    }}>
      <i className={`ti ${icon}`} style={{ fontSize: 11 }} />
      {children}
    </div>
  );
}

function NoteCard({ note, pinned, onTogglePin, onDelete }) {
  const [hover, setHover] = useState(false);
  const category = NOTE_CATEGORIES.find((c) => c.key === note.category);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "9px 12px",
        background: pinned ? "#fef9ec" : "var(--surface2)",
        borderRadius: 8,
        border:     pinned ? "1px solid #f59e0b40" : category ? `1px solid ${category.color}30` : "1px solid var(--border)",
        borderLeft: pinned ? "3px solid #f59e0b"   : category ? `3px solid ${category.color}` : undefined,
        fontSize: 13,
        position: "relative",
        transition: "background 0.12s",
      }}
    >
      <div style={{ paddingRight: hover ? 60 : 0, transition: "padding 0.12s" }}>
        {note.text}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(note.date)}</span>
        {category && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "1px 6px", borderRadius: 10, fontSize: 10, fontWeight: 600,
            background: category.color + "15", color: category.color,
          }}>
            <i className={`ti ${category.icon}`} style={{ fontSize: 9 }} />
            {category.label}
          </span>
        )}
        {note.author && (
          <span style={{ fontSize: 10, color: "var(--muted)" }}>by {note.author}</span>
        )}
      </div>

      {/* Hover actions */}
      <div style={{
        position: "absolute", top: 8, right: 8,
        display: "flex", gap: 4,
        opacity: hover ? 1 : 0,
        transition: "opacity 0.12s",
        pointerEvents: hover ? "auto" : "none",
      }}>
        <ActionBtn
          icon={pinned ? "ti-pin-filled" : "ti-pin"}
          color={pinned ? "#f59e0b" : "var(--muted)"}
          title={pinned ? "Unpin" : "Pin"}
          onClick={() => onTogglePin(note.id)}
        />
        <ActionBtn
          icon="ti-trash"
          color="#ef4444"
          title="Delete"
          onClick={() => onDelete(note.id)}
        />
      </div>
    </div>
  );
}

function ActionBtn({ icon, color, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 26, height: 26, borderRadius: 6,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 12, color }} />
    </button>
  );
}

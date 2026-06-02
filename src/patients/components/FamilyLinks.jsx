import { useState } from "react";
import { AvatarCircle } from "./PatientBadges";
import { RELATIONS } from "../constants/patientConstants";

export default function FamilyLinks({ patient, onPatientUpdate, onNavigateToPatient }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    relation: "Parent",
    patientId: "",
    phone: "",
    email: "",
    isEmergency: false,
  });

  const family = patient.family || [];

  function handleAddMember() {
    setShowAddModal(true);
    setEditingMember(null);
    setFormData({
      name: "",
      relation: "Parent",
      patientId: "",
      phone: "",
      email: "",
      isEmergency: false,
    });
  }

  function handleEditMember(member) {
    setEditingMember(member);
    setFormData({
      name: member.name,
      relation: member.relation,
      patientId: member.patientId || "",
      phone: member.phone || "",
      email: member.email || "",
      isEmergency: member.isEmergency || false,
    });
    setShowAddModal(true);
  }

  function handleSaveMember() {
    if (!formData.name.trim() || !formData.relation) return;

    const newMember = {
      id: editingMember?.id || `family-${Date.now()}`,
      name: formData.name.trim(),
      relation: formData.relation,
      patientId: formData.patientId.trim() || null,
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      isEmergency: formData.isEmergency,
    };

    let updatedFamily;
    if (editingMember) {
      updatedFamily = family.map((f) => (f.id === editingMember.id ? newMember : f));
    } else {
      updatedFamily = [...family, newMember];
    }

    onPatientUpdate?.({ ...patient, family: updatedFamily });
    setShowAddModal(false);
    setEditingMember(null);
  }

  function handleDeleteMember(id) {
    if (!confirm("Remove this family member?")) return;
    const updatedFamily = family.filter((f) => f.id !== id);
    onPatientUpdate?.({ ...patient, family: updatedFamily });
  }

  function handleViewMember(member) {
    if (member.patientId && onNavigateToPatient) {
      onNavigateToPatient(member.patientId);
    }
  }

  if (family.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", padding: "32px 16px" }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "var(--accent-soft)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ti ti-users" style={{ fontSize: 26, color: "var(--accent)" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>No family members linked</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Link family members to track related patients and emergency contacts.
          </div>
        </div>
        <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={handleAddMember}>
          <i className="ti ti-user-plus" style={{ fontSize: 14 }} /> Link Family Member
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {family.map((f) => (
        <div
          key={f.id}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px",
            background: f.isEmergency ? "#fef3c7" : "var(--surface2)",
            borderRadius: 8,
            border: f.isEmergency ? "1px solid #f59e0b40" : "1px solid var(--border)",
          }}
        >
          <AvatarCircle name={f.name} />

          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</span>
              {f.isEmergency && (
                <span style={{
                  padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                  background: "#f59e0b", color: "#fff",
                }}>
                  Emergency
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span
                style={{
                  padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                  background: "var(--accent-soft)", color: "var(--accent)",
                }}
              >
                {f.relation}
              </span>
              {f.patientId && (
                <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>
                  {f.patientId}
                </span>
              )}
            </div>
            {(f.phone || f.email) && (
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                {f.phone && <span>📞 {f.phone}</span>}
                {f.phone && f.email && <span> · </span>}
                {f.email && <span>✉️ {f.email}</span>}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 4 }}>
            {f.patientId && onNavigateToPatient && (
              <button
                className="btn btn-ghost"
                style={{ padding: "4px 8px", fontSize: 12 }}
                onClick={() => handleViewMember(f)}
                title="View Patient Record"
              >
                <i className="ti ti-eye" style={{ fontSize: 13 }} />
              </button>
            )}
            <button
              className="btn btn-ghost"
              style={{ padding: "4px 8px", fontSize: 12 }}
              onClick={() => handleEditMember(f)}
              title="Edit"
            >
              <i className="ti ti-pencil" style={{ fontSize: 13 }} />
            </button>
            <button
              className="btn btn-ghost"
              style={{ padding: "4px 8px", fontSize: 12, color: "#ef4444" }}
              onClick={() => handleDeleteMember(f.id)}
              title="Remove"
            >
              <i className="ti ti-trash" style={{ fontSize: 13 }} />
            </button>
          </div>
        </div>
      ))}

      <button className="btn btn-ghost" style={{ fontSize: 12, alignSelf: "flex-start" }} onClick={handleAddMember}>
        <i className="ti ti-user-plus" style={{ fontSize: 13 }} /> Link Family Member
      </button>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16,
        }}>
          <div style={{
            background: "var(--surface)", borderRadius: 12, padding: 20,
            width: "100%", maxWidth: 400, maxHeight: "90vh", overflow: "auto",
            border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
              {editingMember ? "Edit Family Member" : "Add Family Member"}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" }}>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Full name"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" }}>Relation *</label>
                <select
                  value={formData.relation}
                  onChange={(e) => setFormData({ ...formData, relation: e.target.value })}
                  style={{ width: "100%" }}
                >
                  {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" }}>Patient ID (if in system)</label>
                <input
                  type="text"
                  value={formData.patientId}
                  onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                  placeholder="e.g., P001"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" }}>Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Contact number"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" }}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Email address"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="emergency"
                  checked={formData.isEmergency}
                  onChange={(e) => setFormData({ ...formData, isEmergency: e.target.checked })}
                  style={{ width: 16, height: 16 }}
                />
                <label htmlFor="emergency" style={{ fontSize: 13 }}>Mark as Emergency Contact</label>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleSaveMember}
                  disabled={!formData.name.trim() || !formData.relation}
                >
                  {editingMember ? "Update" : "Add"}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

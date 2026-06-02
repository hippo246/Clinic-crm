// ─── WORKFLOW INTELLIGENCE ───────────────────────────────────────────────────────
// Track actions, pending tasks, and activity summaries for each patient

/**
 * Get last action for a patient from audit entries
 */
export function getLastAction(auditEntries = []) {
  if (!auditEntries || auditEntries.length === 0) {
    return null;
  }

  const sorted = [...auditEntries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const last = sorted[0];

  return {
    user: last.user,
    timestamp: last.timestamp,
    action: last.action,
    field: last.field,
    label: last.label,
    oldValue: last.oldValue,
    newValue: last.newValue,
    timeAgo: getTimeAgo(new Date(last.timestamp)),
  };
}

/**
 * Get action history summary for the last 7 days
 */
export function getActionHistorySummary(auditEntries = [], days = 7) {
  if (!auditEntries || auditEntries.length === 0) {
    return { total: 0, byType: {}, byUser: {}, recent: [] };
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const recentEntries = auditEntries.filter(e => new Date(e.timestamp) >= cutoff);

  const byType = {};
  const byUser = {};

  recentEntries.forEach(entry => {
    // Count by action type
    byType[entry.action] = (byType[entry.action] || 0) + 1;

    // Count by user
    byUser[entry.user] = (byUser[entry.user] || 0) + 1;
  });

  // Get most recent entries
  const recent = [...recentEntries]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10)
    .map(entry => ({
      ...entry,
      timeAgo: getTimeAgo(new Date(entry.timestamp)),
    }));

  return {
    total: recentEntries.length,
    byType,
    byUser,
    recent,
  };
}

/**
 * Get pending tasks for a patient
 */
export function getPendingTasks(patient) {
  const tasks = [];
  const now = new Date();

  // Missing consent
  if (!patient.consentSigned) {
    tasks.push({
      id: "consent-missing",
      title: "Upload Consent Form",
      priority: "high",
      category: "documents",
      dueDate: null,
      description: "Patient consent form has not been collected",
    });
  }

  // Missing emergency contact
  if (!patient.emergencyName || !patient.emergencyPhone) {
    tasks.push({
      id: "emergency-missing",
      title: "Add Emergency Contact",
      priority: "high",
      category: "contact",
      dueDate: null,
      description: "No emergency contact information on file",
    });
  }

  // Insurance verification needed
  if (patient.insurer && patient.insurer !== "None" && !patient.insuranceVerified) {
    tasks.push({
      id: "insurance-verify",
      title: "Verify Insurance",
      priority: "medium",
      category: "insurance",
      dueDate: patient.insuranceExpiry ? new Date(patient.insuranceExpiry) : null,
      description: "Insurance details need verification",
    });
  }

  // ID verification needed
  if (!patient.idVerified) {
    tasks.push({
      id: "id-verify",
      title: "Verify ID Document",
      priority: "medium",
      category: "documents",
      dueDate: null,
      description: "Patient ID has not been verified",
    });
  }

  // Phone verification needed
  if (!patient.phoneVerified) {
    tasks.push({
      id: "phone-verify",
      title: "Verify Phone Number",
      priority: "low",
      category: "contact",
      dueDate: null,
      description: "Phone number has not been verified",
    });
  }

  // Follow-up overdue
  if (patient.status === "Follow-Up Due" || (patient.followUpDate && new Date(patient.followUpDate) < now)) {
    tasks.push({
      id: "followup-overdue",
      title: "Follow-Up Call",
      priority: "high",
      category: "followup",
      dueDate: patient.followUpDate ? new Date(patient.followUpDate) : null,
      description: patient.followUpReason || "Scheduled follow-up is overdue",
    });
  }

  // Documents incomplete
  if (!patient.documentsComplete) {
    tasks.push({
      id: "docs-incomplete",
      title: "Complete Documentation",
      priority: "medium",
      category: "documents",
      dueDate: null,
      description: "Required patient documents are incomplete",
    });
  }

  // Critical alerts not reviewed
  const criticalAlerts = (patient.alerts || []).filter(a =>
    ["Allergy", "Heart Condition", "Pregnancy", "High Risk"].includes(a)
  );
  if (criticalAlerts.length > 0 && !patient.alertsReviewed) {
    tasks.push({
      id: "alerts-review",
      title: "Review Critical Alerts",
      priority: "critical",
      category: "medical",
      dueDate: null,
      description: `Critical alerts require review: ${criticalAlerts.join(", ")}`,
    });
  }

  // Insurance expiring soon
  if (patient.insuranceExpiry) {
    const daysUntilExpiry = Math.floor((new Date(patient.insuranceExpiry) - now) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry >= 0 && daysUntilExpiry <= 30) {
      tasks.push({
        id: "insurance-expiring",
        title: "Insurance Expiring Soon",
        priority: daysUntilExpiry <= 7 ? "high" : "medium",
        category: "insurance",
        dueDate: new Date(patient.insuranceExpiry),
        description: `Insurance expires in ${daysUntilExpiry} days`,
      });
    }
  }

  // No visit in 90+ days
  if (patient.lastVisit) {
    const daysSinceLastVisit = Math.floor((now - new Date(patient.lastVisit)) / (1000 * 60 * 60 * 24));
    if (daysSinceLastVisit >= 90) {
      tasks.push({
        id: "no-visit-90days",
        title: "Schedule Review Visit",
        priority: "low",
        category: "followup",
        dueDate: null,
        description: `No visit in ${daysSinceLastVisit} days`,
      });
    }
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return tasks;
}

/**
 * Get task statistics for a patient
 */
export function getTaskStats(patient) {
  const tasks = getPendingTasks(patient);

  return {
    total: tasks.length,
    critical: tasks.filter(t => t.priority === "critical").length,
    high: tasks.filter(t => t.priority === "high").length,
    medium: tasks.filter(t => t.priority === "medium").length,
    low: tasks.filter(t => t.priority === "low").length,
    byCategory: {
      documents: tasks.filter(t => t.category === "documents").length,
      contact: tasks.filter(t => t.category === "contact").length,
      insurance: tasks.filter(t => t.category === "insurance").length,
      followup: tasks.filter(t => t.category === "followup").length,
      medical: tasks.filter(t => t.category === "medical").length,
    },
  };
}

/**
 * Format time ago string
 */
function getTimeAgo(date) {
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/**
 * Mark a task as complete (returns updated patient data)
 */
export function completeTask(patient, taskId) {
  const updates = {};

  switch (taskId) {
    case "consent-missing":
      updates.consentSigned = true;
      break;
    case "emergency-missing":
      // This requires user input, so we just return the task
      return { needsInput: true, field: "emergencyContact" };
    case "insurance-verify":
      updates.insuranceVerified = true;
      break;
    case "id-verify":
      updates.idVerified = true;
      break;
    case "phone-verify":
      updates.phoneVerified = true;
      break;
    case "followup-overdue":
      updates.status = "Active";
      updates.followUpDate = null;
      break;
    case "docs-incomplete":
      updates.documentsComplete = true;
      break;
    case "alerts-review":
      updates.alertsReviewed = true;
      break;
    default:
      return { needsInput: true };
  }

  return { updatedPatient: { ...patient, ...updates } };
}

import type { Patient, TimelineEvent, PatientDocument, PatientNote, FamilyMember, AlertType } from "./types";
import {
  DOCTORS, INSURERS, GENDERS, BLOOD_GROUPS, STATUSES, ALERT_TYPES,
  DOC_TYPES, RELATIONS, FIRST_NAMES_M, FIRST_NAMES_F, LAST_NAMES, TIMELINE_TYPES,
} from "./constants";
import { randomFrom, randomInt, randomDate, calcAge } from "./utils";

function generateTimeline(i: number): TimelineEvent[] {
  const count = randomInt(2, 8);
  const timeline: TimelineEvent[] = [];
  let tDate = randomDate(new Date(2023, 0, 1), new Date(2024, 0, 1));
  for (let t = 0; t < count; t++) {
    const ev = randomFrom(TIMELINE_TYPES);
    timeline.push({
      id:     `tl-${i}-${t}`,
      type:   ev.type,
      label:  ev.label,
      icon:   ev.icon,
      color:  ev.color,
      date:   new Date(tDate),
      note:   ev.type === "note" ? randomFrom([
        "Patient reports improved symptoms.",
        "Advised rest and hydration.",
        "Follow-up in 2 weeks.",
        "Referred to specialist.",
      ]) : null,
      doctor: randomFrom(DOCTORS),
    });
    tDate = new Date(tDate.getTime() + randomInt(5, 60) * 86400000);
  }
  return timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function generateDocuments(i: number): PatientDocument[] {
  return Array.from({ length: randomInt(0, 4) }, (_, d) => ({
    id:       `doc-${i}-${d}`,
    type:     randomFrom(DOC_TYPES),
    uploaded: randomDate(new Date(2023, 0, 1), new Date(2025, 5, 1)).toISOString().split("T")[0],
    size:     `${randomInt(100, 5000)} KB`,
    verified: Math.random() > 0.5,
  }));
}

function generateNotes(i: number): PatientNote[] {
  return Array.from({ length: randomInt(0, 3) }, (_, n) => ({
    id:     `note-${i}-${n}`,
    text:   randomFrom([
      "Prefers evening appointments",
      "Wheelchair assistance required",
      "Insurance approval needed",
      "Speaks only Hindi",
      "VIP — contact Dr. Sharma directly",
      "Sensitive to penicillin",
    ]),
    pinned: Math.random() > 0.7,
    date:   randomDate(new Date(2024, 0, 1), new Date(2025, 5, 1)).toISOString().split("T")[0],
    author: randomFrom(DOCTORS),
  }));
}

function generateFamily(i: number, lastName: string): FamilyMember[] {
  if (Math.random() <= 0.5) return [];
  return Array.from({ length: randomInt(1, 2) }, (_, f) => ({
    id:       `fam-${i}-${f}`,
    name:     `${randomFrom([...FIRST_NAMES_M, ...FIRST_NAMES_F])} ${lastName}`,
    relation: randomFrom(RELATIONS),
    patientId: `CLN-${String(randomInt(1000, 9999)).padStart(5, "0")}`,
  }));
}

export function generatePatients(count = 120): Patient[] {
  return Array.from({ length: count }, (_, i) => {
    const gender     = randomFrom(GENDERS);
    const firstName  = randomFrom(gender === "Male" ? FIRST_NAMES_M : FIRST_NAMES_F);
    const lastName   = randomFrom(LAST_NAMES);
    const dob        = randomDate(new Date(1950, 0, 1), new Date(2010, 0, 1));
    const alerts     = Array.from({ length: randomInt(0, 3) }, () => randomFrom(ALERT_TYPES))
                         .filter((v, idx, arr) => arr.indexOf(v) === idx) as AlertType[];
    const status     = randomFrom(STATUSES);
    const lastVisit  = randomDate(new Date(2024, 0, 1), new Date(2025, 5, 1));
    const nextAppt   = Math.random() > 0.4
                         ? randomDate(new Date(2025, 5, 1), new Date(2025, 11, 31))
                         : null;
    const insurer    = randomFrom(INSURERS);
    const insExpiry  = insurer !== "None"
                         ? randomDate(new Date(2025, 0, 1), new Date(2027, 0, 1))
                         : null;
    const followUp   = status === "Follow-Up Due"
                         ? randomDate(new Date(2025, 5, 1), new Date(2025, 8, 1))
                         : null;

    const insStatus = !insurer || insurer === "None" ? "None"
      : !insExpiry                                   ? "None"
      : insExpiry < new Date()                       ? "Expired"
      : insExpiry < new Date(Date.now() + 30 * 86400000) ? "Expiring"
      : "Active";

    return {
      id:        `CLN-${String(i + 1001).padStart(5, "0")}`,
      firstName, lastName,
      name:      `${firstName} ${lastName}`,
      dob:       dob.toISOString().split("T")[0],
      age:       calcAge(dob),
      gender,
      bloodGroup: randomFrom(BLOOD_GROUPS),
      phone:      `+91 ${randomInt(7, 9)}${String(randomInt(100000000, 999999999))}`,
      email:      `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 99)}@email.com`,
      address:    `${randomInt(1, 200)}, ${randomFrom(["MG Road","Park Street","Link Road","SV Nagar","Bandra West"])}, Mumbai`,
      nationality: "Indian",

      emergencyName:     `${randomFrom([...FIRST_NAMES_M, ...FIRST_NAMES_F])} ${lastName}`,
      emergencyRelation: randomFrom(RELATIONS),
      emergencyPhone:    `+91 ${randomInt(7, 9)}${String(randomInt(100000000, 999999999))}`,

      insurer,
      policyNumber:    insurer !== "None" ? `POL-${String(randomInt(100000, 999999))}` : null,
      insuranceExpiry: insExpiry ? insExpiry.toISOString().split("T")[0] : null,
      insuranceStatus: insStatus as "Active" | "Expiring" | "Expired" | "None",

      allergies:   alerts.includes("Allergy") ? randomFrom(["Penicillin","Sulfa drugs","Aspirin","Latex"]) : "",
      conditions:  alerts.filter((a) => a !== "Allergy"),
      medications: alerts.includes("Diabetic") ? ["Metformin 500mg"] : [],
      alerts,

      status,
      doctor:          randomFrom(DOCTORS),
      lastVisit:       lastVisit.toISOString().split("T")[0],
      nextAppointment: nextAppt ? nextAppt.toISOString().split("T")[0] : null,

      followUpDate:     followUp ? followUp.toISOString().split("T")[0] : null,
      followUpReason:   followUp ? randomFrom(["Post-surgery check","Medication review","Lab results review","General follow-up"]) : null,
      followUpStaff:    followUp ? randomFrom(DOCTORS) : null,
      followUpPriority: followUp ? randomFrom(["High","Medium","Low"] as const) : null,
      followUpStatus:   followUp ? randomFrom(["Pending","Called","No Answer"] as const) : null,
      callAttempts:     followUp ? randomInt(0, 3) : 0,
      lastContacted:    followUp && Math.random() > 0.45
                          ? randomDate(new Date(2025, 3, 1), new Date(2025, 5, 30)).toISOString().split("T")[0]
                          : null,
      followUpNotes:    followUp ? randomFrom([
                          "Left voicemail, awaiting callback.",
                          "Patient confirmed appointment.",
                          "Family member contacted.",
                          "",
                        ]) : null,

      phoneVerified:     Math.random() > 0.25,
      insuranceVerified: insurer !== "None" ? Math.random() > 0.2 : false,
      idVerified:        Math.random() > 0.3,
      consentSigned:     Math.random() > 0.15,
      documentsComplete: Math.random() > 0.35,

      timeline:  generateTimeline(i),
      documents: generateDocuments(i),
      notes:     generateNotes(i),
      family:    generateFamily(i, lastName),
      consents:  {},
      flags:     {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}

// Stable singleton — generated once at module load, persisted via localStorage
let _patients: Patient[] | null = null;

export function getInitialPatients(): Patient[] {
  if (_patients) return _patients;
  _patients = generatePatients(120);
  return _patients;
}

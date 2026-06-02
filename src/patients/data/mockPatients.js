import {
  DOCTORS, INSURERS, GENDERS, BLOOD_GROUPS, STATUSES,
  ALERT_TYPES, DOC_TYPES, RELATIONS,
  FIRST_NAMES_M, FIRST_NAMES_F, LAST_NAMES, TIMELINE_TYPES,
} from "../constants/patientConstants";
import { randomFrom, randomInt, randomDate, calcAge } from "../utils/patientUtils";

function generateTimeline(i) {
  const count = randomInt(2, 8);
  const timeline = [];
  let tDate = new Date(randomDate(new Date(2023, 0, 1), new Date(2024, 0, 1)));
  for (let t = 0; t < count; t++) {
    const ev = randomFrom(TIMELINE_TYPES);
    timeline.push({
      id: `tl-${i}-${t}`,
      ...ev,
      date: new Date(tDate),
      note:
        ev.type === "note"
          ? randomFrom([
              "Patient reports improved symptoms.",
              "Advised rest and hydration.",
              "Follow-up in 2 weeks.",
              "Referred to specialist.",
            ])
          : null,
      doctor: randomFrom(DOCTORS),
    });
    tDate = new Date(tDate.getTime() + randomInt(5, 60) * 24 * 60 * 60 * 1000);
  }
  return timeline.sort((a, b) => a.date - b.date);
}

function generateDocuments(i) {
  return Array.from({ length: randomInt(0, 4) }, (_, d) => ({
    id: `doc-${i}-${d}`,
    type: randomFrom(DOC_TYPES),
    uploaded: randomDate(new Date(2023, 0, 1), new Date(2025, 5, 1)),
    size: `${randomInt(100, 5000)} KB`,
  }));
}

function generateNotes(i) {
  return Array.from({ length: randomInt(0, 3) }, (_, n) => ({
    id: `note-${i}-${n}`,
    text: randomFrom([
      "Prefers evening appointments",
      "Wheelchair assistance required",
      "Insurance approval needed",
      "Speaks only Hindi",
      "VIP — contact Dr. Sharma directly",
      "Sensitive to penicillin",
    ]),
    pinned: Math.random() > 0.7,
    date: randomDate(new Date(2024, 0, 1), new Date(2025, 5, 1)),
  }));
}

function generateFamily(i, lastName) {
  if (Math.random() <= 0.5) return [];
  return Array.from({ length: randomInt(1, 2) }, (_, f) => ({
    id: `fam-${i}-${f}`,
    name: `${randomFrom([...FIRST_NAMES_M, ...FIRST_NAMES_F])} ${lastName}`,
    relation: randomFrom(RELATIONS),
    patientId: `CLN-${String(randomInt(1000, 9999)).padStart(5, "0")}`,
  }));
}

export function generatePatients(count = 120) {
  return Array.from({ length: count }, (_, i) => {
    const gender     = randomFrom(GENDERS);
    const firstName  = randomFrom(gender === "Male" ? FIRST_NAMES_M : FIRST_NAMES_F);
    const lastName   = randomFrom(LAST_NAMES);
    const dob        = randomDate(new Date(1950, 0, 1), new Date(2010, 0, 1));
    const alerts     = Array.from({ length: randomInt(0, 3) }, () => randomFrom(ALERT_TYPES))
                         .filter((v, idx, arr) => arr.indexOf(v) === idx);
    const status          = randomFrom(STATUSES);
    const lastVisit       = randomDate(new Date(2024, 0, 1), new Date(2025, 5, 1));
    const nextAppt        = Math.random() > 0.4
                              ? randomDate(new Date(2025, 5, 1), new Date(2025, 11, 31))
                              : null;
    const insurer         = randomFrom(INSURERS);
    const insuranceExpiry = randomDate(new Date(2025, 0, 1), new Date(2027, 0, 1));
    const followUpDate    = status === "Follow-Up Due"
                              ? randomDate(new Date(2025, 5, 1), new Date(2025, 8, 1))
                              : null;

    const insuranceStatus =
      insurer === "None"                   ? "None"
      : insuranceExpiry < new Date()       ? "Expired"
      : insuranceExpiry < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? "Expiring"
      : "Active";

    return {
      id:        `CLN-${String(i + 1001).padStart(5, "0")}`,
      firstName, lastName,
      name:      `${firstName} ${lastName}`,
      dob:       dob.toISOString().split("T")[0],
      age:       calcAge(dob),
      gender,
      bloodGroup:  randomFrom(BLOOD_GROUPS),
      phone:       `+91 ${randomInt(7, 9)}${String(randomInt(100000000, 999999999))}`,
      email:       `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 99)}@email.com`,
      address:     `${randomInt(1, 200)}, ${randomFrom(["MG Road", "Park Street", "Link Road", "SV Nagar", "Bandra West"])}, Mumbai`,
      nationality: "Indian",

      emergencyName:     `${randomFrom([...FIRST_NAMES_M, ...FIRST_NAMES_F])} ${lastName}`,
      emergencyRelation: randomFrom(RELATIONS),
      emergencyPhone:    `+91 ${randomInt(7, 9)}${String(randomInt(100000000, 999999999))}`,

      insurer,
      policyNumber:    insurer !== "None" ? `POL-${String(randomInt(100000, 999999))}` : null,
      insuranceExpiry: insurer !== "None" ? insuranceExpiry.toISOString().split("T")[0] : null,
      insuranceStatus,

      allergies:   alerts.includes("Allergy") ? randomFrom(["Penicillin", "Sulfa drugs", "Aspirin", "Latex"]) : "",
      conditions:  alerts.filter((a) => a !== "Allergy"),
      medications: alerts.includes("Diabetic") ? ["Metformin 500mg"] : [],
      alerts,

      status,
      doctor:          randomFrom(DOCTORS),
      lastVisit:       lastVisit.toISOString().split("T")[0],
      nextAppointment: nextAppt ? nextAppt.toISOString().split("T")[0] : null,

      followUpDate:     followUpDate ? followUpDate.toISOString().split("T")[0] : null,
      followUpReason:   followUpDate ? randomFrom(["Post-surgery check", "Medication review", "Lab results review", "General follow-up"]) : null,
      followUpStaff:    followUpDate ? randomFrom(DOCTORS) : null,
      followUpPriority: followUpDate ? randomFrom(["High", "Medium", "Low"]) : null,

      followUpStatus:   followUpDate ? randomFrom(["Pending", "Called", "No Answer"]) : null,
      callAttempts:     followUpDate ? randomInt(0, 3) : 0,
      lastContacted:    followUpDate && Math.random() > 0.45
                          ? randomDate(new Date(2025, 3, 1), new Date(2025, 5, 30)).toISOString().split("T")[0]
                          : null,
      followUpNotes:    followUpDate ? randomFrom([
                          "Left voicemail, awaiting callback.",
                          "Patient confirmed appointment.",
                          "Family member contacted — will pass on message.",
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
    };
  });
}

// Singleton — generated once, imported everywhere
export const ALL_PATIENTS = generatePatients(120);

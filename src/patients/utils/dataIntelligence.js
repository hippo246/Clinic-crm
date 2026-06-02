// ─── DATA INTELLIGENCE ─────────────────────────────────────────────────────────────
// Advanced data analysis: duplicate detection, ownership tracking, confidence scores

/**
 * Calculate duplicate confidence score between two patients
 * Returns score (0-100) and match details
 */
export function calculateDuplicateConfidence(patient1, patient2) {
  let score = 0;
  const matches = [];

  // Name matching (high weight)
  const nameSimilarity = calculateNameSimilarity(patient1.name, patient2.name);
  if (nameSimilarity > 0.7) {
    score += 35;
    matches.push({ field: "name", weight: 35, value: nameSimilarity });
  }

  // Phone matching (very high weight)
  if (patient1.phone && patient2.phone && patient1.phone === patient2.phone) {
    score += 40;
    matches.push({ field: "phone", weight: 40, value: 1.0 });
  }

  // DOB matching (high weight)
  if (patient1.dob && patient2.dob && patient1.dob === patient2.dob) {
    score += 25;
    matches.push({ field: "dob", weight: 25, value: 1.0 });
  }

  // Email matching (medium weight)
  if (patient1.email && patient2.email && patient1.email === patient2.email) {
    score += 20;
    matches.push({ field: "email", weight: 20, value: 1.0 });
  }

  // Address matching (medium weight)
  if (patient1.address && patient2.address) {
    const addressSimilarity = calculateStringSimilarity(patient1.address, patient2.address);
    if (addressSimilarity > 0.6) {
      score += 15;
      matches.push({ field: "address", weight: 15, value: addressSimilarity });
    }
  }

  // Emergency contact matching (medium weight)
  if (patient1.emergencyPhone && patient2.emergencyPhone && 
      patient1.emergencyPhone === patient2.emergencyPhone) {
    score += 15;
    matches.push({ field: "emergencyPhone", weight: 15, value: 1.0 });
  }

  // Age matching (low weight, already covered by DOB)
  if (patient1.age && patient2.age && patient1.age === patient2.age) {
    score += 5;
    matches.push({ field: "age", weight: 5, value: 1.0 });
  }

  // Gender matching (low weight)
  if (patient1.gender && patient2.gender && patient1.gender === patient2.gender) {
    score += 5;
    matches.push({ field: "gender", weight: 5, value: 1.0 });
  }

  return {
    score: Math.min(100, score),
    level: getConfidenceLevel(Math.min(100, score)),
    matches,
    recommendation: getDuplicateRecommendation(Math.min(100, score)),
  };
}

/**
 * Calculate name similarity using Levenshtein distance
 */
function calculateNameSimilarity(name1, name2) {
  if (!name1 || !name2) return 0;
  
  const n1 = name1.toLowerCase().replace(/\s/g, "");
  const n2 = name2.toLowerCase().replace(/\s/g, "");
  
  if (n1 === n2) return 1.0;
  
  const distance = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  
  return 1 - (distance / maxLen);
}

/**
 * Calculate general string similarity
 */
function calculateStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1.0;
  
  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  
  return 1 - (distance / maxLen);
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],
          dp[i][j - 1],
          dp[i - 1][j - 1]
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Get confidence level from score
 */
function getConfidenceLevel(score) {
  if (score >= 85) return "Very High";
  if (score >= 70) return "High";
  if (score >= 50) return "Medium";
  if (score >= 30) return "Low";
  return "Very Low";
}

/**
 * Get duplicate recommendation based on score
 */
function getDuplicateRecommendation(score) {
  if (score >= 85) return "Strong candidate for merge - review immediately";
  if (score >= 70) return "Likely duplicate - requires review";
  if (score >= 50) return "Possible duplicate - manual review recommended";
  if (score >= 30) return "Low confidence - may be different patients";
  return "No action needed";
}

/**
 * Find potential duplicates for a patient
 */
export function findPotentialDuplicates(patient, allPatients, threshold = 50) {
  const duplicates = [];

  for (const other of allPatients) {
    if (other.id === patient.id) continue;

    const confidence = calculateDuplicateConfidence(patient, other);
    
    if (confidence.score >= threshold) {
      duplicates.push({
        patient: other,
        ...confidence,
      });
    }
  }

  // Sort by confidence score descending
  return duplicates.sort((a, b) => b.score - a.score);
}

/**
 * Track data ownership for a patient
 * Returns ownership information by role
 */
export function getDataOwnership(patient) {
  const ownership = {
    primaryManager: null,
    reception: {
      canEdit: ["phone", "email", "address", "emergencyName", "emergencyPhone", "emergencyRelation"],
      canView: ["phone", "email", "address", "emergencyName", "emergencyPhone", "emergencyRelation", "doctor", "status"],
      lastUpdated: null,
    },
    doctor: {
      canEdit: ["allergies", "conditions", "medications", "alerts", "notes"],
      canView: ["allergies", "conditions", "medications", "alerts", "notes", "timeline"],
      lastUpdated: null,
    },
    admin: {
      canEdit: ["*"], // All fields
      canView: ["*"], // All fields
      lastUpdated: null,
    },
  };

  // Determine primary manager based on doctor assignment
  if (patient.doctor) {
    ownership.primaryManager = {
      role: "doctor",
      name: patient.doctor,
      since: patient.lastVisit || patient.created,
    };
  }

  return ownership;
}

/**
 * Calculate patient record quality score (separate from data quality)
 * Focuses on completeness, verification, and freshness
 */
export function calculateRecordQualityScore(patient) {
  let score = 100;
  const factors = [];

  // Completeness factors
  const requiredFields = [
    { field: "phone", weight: 10, present: !!patient.phone },
    { field: "email", weight: 5, present: !!patient.email },
    { field: "dob", weight: 15, present: !!patient.dob },
    { field: "gender", weight: 8, present: !!patient.gender },
    { field: "address", weight: 10, present: !!patient.address },
    { field: "bloodGroup", weight: 5, present: !!patient.bloodGroup },
    { field: "emergencyContact", weight: 15, present: !!(patient.emergencyName && patient.emergencyPhone) },
  ];

  requiredFields.forEach(({ field, weight, present }) => {
    if (!present) {
      score -= weight;
      factors.push({ type: "missing", field, impact: weight });
    }
  });

  // Verification factors
  if (!patient.phoneVerified) {
    score -= 8;
    factors.push({ type: "unverified", field: "phone", impact: 8 });
  }
  if (!patient.idVerified) {
    score -= 10;
    factors.push({ type: "unverified", field: "id", impact: 10 });
  }
  if (!patient.consentSigned) {
    score -= 12;
    factors.push({ type: "unverified", field: "consent", impact: 12 });
  }
  if (patient.insurer && patient.insurer !== "None" && !patient.insuranceVerified) {
    score -= 8;
    factors.push({ type: "unverified", field: "insurance", impact: 8 });
  }

  // Freshness factors
  if (patient.lastVisit) {
    const daysSinceLastVisit = Math.floor((new Date() - new Date(patient.lastVisit)) / (1000 * 60 * 60 * 24));
    if (daysSinceLastVisit > 365) {
      score -= 15;
      factors.push({ type: "stale", field: "lastVisit", impact: 15, days: daysSinceLastVisit });
    } else if (daysSinceLastVisit > 180) {
      score -= 8;
      factors.push({ type: "stale", field: "lastVisit", impact: 8, days: daysSinceLastVisit });
    }
  } else {
    score -= 20;
    factors.push({ type: "missing", field: "lastVisit", impact: 20 });
  }

  // Document completeness
  if (!patient.documentsComplete) {
    score -= 10;
    factors.push({ type: "incomplete", field: "documents", impact: 10 });
  }

  // Duplicate risk (would need to check against other patients)
  // This is a placeholder - actual implementation would require database query
  // factors.push({ type: "duplicate", field: "potential_duplicate", impact: 0 });

  return {
    score: Math.max(0, score),
    level: getRecordQualityLevel(Math.max(0, score)),
    factors,
    recommendations: getQualityRecommendations(factors),
  };
}

/**
 * Get record quality level
 */
function getRecordQualityLevel(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Poor";
  return "Critical";
}

/**
 * Get quality improvement recommendations
 */
function getQualityRecommendations(factors) {
  const recommendations = [];

  factors.forEach(factor => {
    switch (factor.type) {
      case "missing":
        recommendations.push(`Add missing ${factor.field}`);
        break;
      case "unverified":
        recommendations.push(`Verify ${factor.field}`);
        break;
      case "stale":
        recommendations.push(`Update ${factor.field} - last updated ${factor.days} days ago`);
        break;
      case "incomplete":
        recommendations.push(`Complete ${factor.field}`);
        break;
    }
  });

  return recommendations;
}

/**
 * Calculate overall patient database health score
 */
export function calculateDatabaseHealth(patients) {
  if (!patients || patients.length === 0) {
    return { score: 0, level: "No Data", metrics: {} };
  }

  let totalQualityScore = 0;
  let staleCount = 0;
  let missingConsentCount = 0;
  let missingEmergencyContactCount = 0;
  let duplicateRisks = 0;

  patients.forEach(patient => {
    const quality = calculateRecordQualityScore(patient);
    totalQualityScore += quality.score;

    if (patient.lastVisit) {
      const daysSince = Math.floor((new Date() - new Date(patient.lastVisit)) / (1000 * 60 * 60 * 24));
      if (daysSince > 540) staleCount++; // 18 months
    }

    if (!patient.consentSigned) missingConsentCount++;
    if (!patient.emergencyName || !patient.emergencyPhone) missingEmergencyContactCount++;
  });

  // Estimate duplicate risks (simplified)
  duplicateRisks = Math.floor(patients.length * 0.02); // Assume 2% potential duplicates

  const avgQuality = totalQualityScore / patients.length;
  const healthScore = avgQuality - 
    (staleCount / patients.length) * 10 -
    (missingConsentCount / patients.length) * 8 -
    (missingEmergencyContactCount / patients.length) * 5 -
    (duplicateRisks / patients.length) * 3;

  return {
    score: Math.max(0, Math.round(healthScore)),
    level: getRecordQualityLevel(Math.max(0, healthScore)),
    metrics: {
      totalPatients: patients.length,
      averageQuality: Math.round(avgQuality),
      staleRecords: staleCount,
      missingConsent: missingConsentCount,
      missingEmergencyContact: missingEmergencyContactCount,
      potentialDuplicates: duplicateRisks,
      activePatients: patients.filter(p => p.status === "Active").length,
      highRiskPatients: patients.filter(p => 
        (p.alerts || []).some(a => ["Allergy", "Heart Condition", "Pregnancy", "High Risk"].includes(a))
      ).length,
    },
  };
}

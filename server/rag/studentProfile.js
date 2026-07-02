export function mergeStudentProfileForChat({ user, studentProfile, clientProfile = {} }) {
  const testScores =
    studentProfile?.testScores && typeof studentProfile.testScores === "object" ? studentProfile.testScores : {};
  const preferences =
    studentProfile?.preferences && typeof studentProfile.preferences === "object"
      ? studentProfile.preferences
      : {};

  return {
    name:
      clientProfile.name ||
      (user ? `${user.firstName} ${user.lastName}`.trim() : null),
    role: user?.role ?? clientProfile.role ?? null,
    plan: user?.plan ?? clientProfile.plan ?? null,
    grade:
      clientProfile.grade ||
      (studentProfile?.graduationYear ? `Class of ${studentProfile.graduationYear}` : null),
    graduationYear: clientProfile.graduationYear ?? studentProfile?.graduationYear ?? null,
    focus:
      clientProfile.focus ||
      studentProfile?.targetMajors?.slice(0, 3).join(", ") ||
      null,
    majors: clientProfile.majors ?? studentProfile?.targetMajors ?? [],
    targetMajors: clientProfile.targetMajors ?? studentProfile?.targetMajors ?? [],
    location: clientProfile.location ?? studentProfile?.location ?? preferences.location ?? null,
    gpa: clientProfile.gpa ?? (studentProfile?.gpa != null ? Number(studentProfile.gpa) : null),
    sat: clientProfile.sat ?? testScores.sat ?? testScores.SAT ?? null,
    act: clientProfile.act ?? testScores.act ?? testScores.ACT ?? null,
    budget: clientProfile.budget ?? preferences.budget ?? clientProfile.financialAidNotes ?? null,
    financialAidNotes: clientProfile.financialAidNotes ?? preferences.budget ?? null,
    activities:
      clientProfile.activities ??
      clientProfile.extracurricularActivities ??
      preferences.activities ??
      [],
    extracurricularActivities:
      clientProfile.extracurricularActivities ??
      clientProfile.activities ??
      preferences.activities ??
      [],
    colleges: clientProfile.colleges ?? clientProfile.savedColleges ?? preferences.colleges ?? [],
    savedColleges: clientProfile.savedColleges ?? clientProfile.colleges ?? preferences.colleges ?? []
  };
}

function studentFirstName(name) {
  return (name || "").trim().split(/\s+/)[0] || "Student";
}

/**
 * Parent chat tabs: different mentors → one tab per mentor (mentor name).
 * Same mentor for multiple children → tabs use student names so conversations stay distinct.
 */
export function applyParentThreadLabels(threads) {
  if (!threads?.length) return [];

  const byMentor = new Map();
  for (const thread of threads) {
    const mentorKey = thread.mentorId || "unknown";
    if (!byMentor.has(mentorKey)) byMentor.set(mentorKey, []);
    byMentor.get(mentorKey).push(thread);
  }

  const labeled = threads.map((thread) => {
    const group = byMentor.get(thread.mentorId || "unknown") || [thread];
    const sharedMentor = group.length > 1;
    const mentorName = thread.mentorName || thread.label || "Mentor";
    const studentName = thread.studentName || "Student";
    const studentFirst = studentFirstName(studentName);

    if (sharedMentor) {
      const otherChildren = group
        .filter((row) => row.studentId !== thread.studentId)
        .map((row) => studentFirstName(row.studentName))
        .filter(Boolean);
      const sharedNote = otherChildren.length
        ? ` · same mentor as ${otherChildren.join(" & ")}`
        : "";

      return {
        ...thread,
        label: mentorName,
        sublabel: `Mentor for ${studentName}${sharedNote}`,
        tabLabel: studentName,
        tabSublabel: mentorName,
        sharedMentor,
        sharedMentorStudentNames: group.map((row) => row.studentName).filter(Boolean)
      };
    }

    return {
      ...thread,
      label: mentorName,
      sublabel: `${studentFirst}'s mentor`,
      tabLabel: mentorName,
      tabSublabel: `${studentFirst}'s mentor`,
      sharedMentor: false,
      sharedMentorStudentNames: [studentName]
    };
  });

  return labeled.sort((a, b) => {
    const mentorCmp = (a.mentorName || a.label || "").localeCompare(b.mentorName || b.label || "");
    if (mentorCmp !== 0) return mentorCmp;
    return (a.studentName || "").localeCompare(b.studentName || "");
  });
}

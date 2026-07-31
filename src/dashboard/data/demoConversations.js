/**
 * Demo direct-message threads — students see mentor only; mentors see assigned students only.
 */

const DEMO_SLUGS = {
  mentor: "demo-mentor-asim",
  jordanEssay: "demo-student-jordan-essay",
  jordanPlus: "demo-student-jordan-plus",
  jordanPro: "demo-student-jordan-pro",
  jordan: "demo-student-jordan-essay"
};

function daysAgo(n, hour = 14, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function hoursAgo(h, minute = 0) {
  const d = new Date();
  d.setHours(d.getHours() - h, minute, 0, 0);
  return d.toISOString();
}

function them(id, body, createdAt) {
  return { id, sender: "them", senderId: "them", body, text: body, createdAt, status: undefined };
}

function me(id, body, createdAt, status, deliveredAt = null, readAt = null) {
  return { id, sender: "me", senderId: "me", body, text: body, createdAt, status, deliveredAt, readAt };
}

const MENTOR_PARTICIPANT = {
  id: DEMO_SLUGS.mentor,
  name: "Asim Yoonas",
  role: "Mentor",
  context: "Georgia Tech · CS",
  status: "Active today",
  online: true,
  avatarUrl: "/media/mentors/asim-yoonas.png"
};

function studentParticipant(name, grade, major, id) {
  return { id, name, role: "Student", context: `${grade} · ${major}`, status: "Active recently", online: false };
}

/** @param {'student' | 'mentor'} viewerRole */
export function getDemoConversations(viewerRole, studentKey = "jordan") {
  const jordanEssay = studentParticipant("Jordan — Essay Support", "11th grade", "Computer Science", DEMO_SLUGS.jordanEssay);
  const jordanPlus = studentParticipant("Jordan — Plus", "11th grade", "Computer Science", DEMO_SLUGS.jordanPlus);
  const jordanPro = studentParticipant("Jordan — Pro", "11th grade", "Computer Science", DEMO_SLUGS.jordanPro);

  const mentorThreadEssay = {
    id: `conv-mentor-${DEMO_SLUGS.jordanEssay}`,
    participant: jordanEssay,
    lastActivity: hoursAgo(2),
    unread: 1,
    nextZoomUrl: "https://zoom.us/j/1234567890",
    messages: [
      them("m-e1", "Can we review my Brown supplemental prompts this week?", hoursAgo(2)),
      me("m-e2", "Yes — that uses one Essay Support review credit for the full set.", hoursAgo(1, 8), "read", hoursAgo(1, 8), hoursAgo(1, 9))
    ]
  };

  const mentorThreadPlus = {
    id: `conv-mentor-${DEMO_SLUGS.jordanPlus}`,
    participant: jordanPlus,
    lastActivity: hoursAgo(5),
    unread: 0,
    nextZoomUrl: "https://zoom.us/j/1234567891",
    messages: [
      them("m-p1", "I have 1 flexible session remaining this month — can we book college list strategy?", hoursAgo(5)),
      me("m-p2", "Absolutely. Let's use that session for reach/target/likely balance.", hoursAgo(4, 20), "delivered", hoursAgo(4, 21))
    ]
  };

  const mentorThreadPro = {
    id: `conv-mentor-${DEMO_SLUGS.jordanPro}`,
    participant: jordanPro,
    lastActivity: daysAgo(1, 9, 0),
    unread: 0,
    nextZoomUrl: "https://zoom.us/j/1234567892",
    messages: [
      them("m-r1", "I'd like to use a Pro session for interview prep.", daysAgo(1, 9, 0)),
      me("m-r2", "Perfect — you still have 3 of 4 sessions remaining this month.", daysAgo(1, 8, 30), "delivered", daysAgo(1, 8, 32))
    ]
  };

  const studentThread = {
    id: `conv-mentor-${DEMO_SLUGS.jordan}`,
    participant: MENTOR_PARTICIPANT,
    lastActivity: hoursAgo(2),
    unread: 1,
    nextZoomUrl: "https://zoom.us/j/1234567890",
    messages: [
      them("s1", "Hi Jordan — let's refine your next application priority.", daysAgo(2, 16, 0)),
      me("s2", "Sounds good. I'll prepare questions before our check-in.", daysAgo(2, 16, 20), "read", daysAgo(2, 16, 21), daysAgo(2, 16, 22)),
      them("s3", "Looking forward to it.", hoursAgo(2))
    ]
  };

  if (viewerRole === "mentor") {
    return [mentorThreadEssay, mentorThreadPlus, mentorThreadPro]
      .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
  }

  return [studentThread];
}

export function conversationsToInbox(conversations) {
  return conversations.map((c) => ({
    id: c.id,
    from: c.participant.name,
    role: c.participant.role,
    preview: c.messages[c.messages.length - 1]?.body || c.messages[c.messages.length - 1]?.text || "",
    time: formatRelative(c.lastActivity),
    unread: c.unread > 0,
    unreadCount: c.unread
  }));
}

function formatRelative(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

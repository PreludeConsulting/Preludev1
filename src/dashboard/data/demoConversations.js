/**
 * Demo direct-message threads — students see mentor only; mentors see assigned students only.
 */

const DEMO_SLUGS = {
  mentor: "demo-mentor-maya",
  jordan: "demo-student-jordan",
  alex: "demo-student-alex"
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
  name: "Maya Patel",
  role: "Mentor",
  context: "Georgia Tech · CS",
  status: "Active today",
  online: true
};

function studentParticipant(name, grade, major, id) {
  return { id, name, role: "Student", context: `${grade} · ${major}`, status: "Active recently", online: false };
}

/** @param {'student' | 'mentor'} viewerRole */
export function getDemoConversations(viewerRole, studentKey = "jordan") {
  const jordan = studentParticipant("Jordan Lee", "11th grade", "Computer Science", DEMO_SLUGS.jordan);
  const alex = studentParticipant("Alex Kim", "12th grade", "Economics", DEMO_SLUGS.alex);

  const jordanThread = {
    id: `conv-${DEMO_SLUGS.jordan}`,
    participant: jordan,
    lastActivity: hoursAgo(2),
    unread: 1,
    nextZoomUrl: "https://zoom.us/j/1234567890",
    messages: [
      them("j1", "Hi Jordan — great progress on your college list last session.", daysAgo(2, 16, 5)),
      me("j2", "Thank you! I moved Northeastern to target and added one more likely school.", daysAgo(2, 16, 12), "read", daysAgo(2, 16, 13), daysAgo(2, 16, 14)),
      them("j3", "Perfect. Before Thursday, skim the Georgia Tech supplemental prompts.", daysAgo(1, 10, 0)),
      me("j4", "Will do. Can we review my reach school essay angle on Thursday?", daysAgo(1, 10, 8), "delivered", daysAgo(1, 10, 9)),
      them("j5", "Absolutely — bring a rough outline for paragraph 2.", hoursAgo(5)),
      them("j6", "Can we review my Georgia Tech supplemental prompt on Thursday?", hoursAgo(2))
    ]
  };

  const alexThread = {
    id: `conv-${DEMO_SLUGS.alex}`,
    participant: alex,
    lastActivity: daysAgo(1, 9, 0),
    unread: 0,
    nextZoomUrl: "https://zoom.us/j/9876543210",
    messages: [
      them("a1", "Alex — please send your scholarship shortlist before our next Zoom.", daysAgo(3, 15, 0)),
      me("a2", "Uploaded an updated list with three merit options.", daysAgo(2, 11, 0), "read", daysAgo(2, 11, 2), daysAgo(2, 11, 5)),
      me("a3", "I uploaded my updated scholarship list — let me know what you think.", daysAgo(1, 9, 0), "sent", daysAgo(1, 9, 1))
    ]
  };

  const mentorThreadJordan = {
    id: `conv-mentor-${DEMO_SLUGS.jordan}`,
    participant: jordan,
    lastActivity: hoursAgo(2),
    unread: 1,
    nextZoomUrl: "https://zoom.us/j/1234567890",
    messages: [
      them("m-j1", "Can we review my Georgia Tech supplemental prompt on Thursday?", hoursAgo(2)),
      me("m-j2", "Yes — send your draft tonight if you can.", hoursAgo(1, 8), "read", hoursAgo(1, 8), hoursAgo(1, 9))
    ]
  };

  const mentorThreadAlex = {
    id: `conv-mentor-${DEMO_SLUGS.alex}`,
    participant: alex,
    lastActivity: daysAgo(1, 8, 0),
    unread: 0,
    nextZoomUrl: "https://zoom.us/j/9876543210",
    messages: [
      them("m-a1", "I uploaded my updated scholarship list — let me know what you think.", daysAgo(1, 8, 0)),
      me("m-a2", "Received — I'll review before our next session.", daysAgo(1, 7, 30), "delivered", daysAgo(1, 7, 32))
    ]
  };

  const mentorThreadJordanStudent = {
    id: `conv-mentor-${DEMO_SLUGS.jordan}`,
    participant: MENTOR_PARTICIPANT,
    lastActivity: hoursAgo(2),
    unread: 1,
    nextZoomUrl: "https://zoom.us/j/1234567890",
    messages: [
      them("s1", "Hi Jordan — let's refine your reach schools on Thursday.", daysAgo(2, 16, 0)),
      me("s2", "Sounds good. I'll update my college list tiers tonight.", daysAgo(2, 16, 20), "read", daysAgo(2, 16, 21), daysAgo(2, 16, 22)),
      them("s3", "Great progress on your college list — let's refine your reach schools on Thursday.", hoursAgo(2))
    ]
  };

  const mentorThreadAlexStudent = {
    id: `conv-mentor-${DEMO_SLUGS.alex}`,
    participant: MENTOR_PARTICIPANT,
    lastActivity: daysAgo(1, 8, 0),
    unread: 0,
    nextZoomUrl: "https://zoom.us/j/9876543210",
    messages: [
      them("s4", "Please send your scholarship shortlist before our next Zoom session.", daysAgo(1, 8, 0)),
      me("s5", "Working on it — I'll share the doc tomorrow morning.", daysAgo(1, 7, 30), "delivered", daysAgo(1, 7, 32))
    ]
  };

  if (viewerRole === "mentor") {
    return [mentorThreadJordan, mentorThreadAlex].sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
  }

  return [studentKey === "alex" ? mentorThreadAlexStudent : mentorThreadJordanStudent];
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

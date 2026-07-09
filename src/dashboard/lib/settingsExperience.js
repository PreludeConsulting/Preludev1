const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidParentInviteEmail(email) {
  return EMAIL_RE.test(String(email || "").trim());
}

export function canSubmitParentInvite({ email, loading = false }) {
  return !loading && isValidParentInviteEmail(email);
}

export function getDisplaySettings() {
  return [
    {
      id: "density",
      type: "select",
      label: "Layout density",
      description: "Comfortable adds breathing room; compact fits more on screen.",
      options: [
        { value: "comfortable", label: "Comfortable" },
        { value: "compact", label: "Compact" }
      ]
    },
    {
      id: "reduceMotion",
      type: "toggle",
      label: "Reduce motion",
      description: "Minimize dashboard animation and movement."
    },
    {
      id: "interfaceSounds",
      type: "toggle",
      label: "Interface sounds",
      description: "Play subtle sounds for successful dashboard actions."
    },
    {
      id: "hapticFeedback",
      type: "toggle",
      label: "Haptic feedback",
      description: "Use light vibration on supported mobile devices."
    }
  ];
}

const ESSENTIAL_NOTIFICATIONS = [
  {
    id: "emailUpdates",
    label: "Product & account emails",
    description: "Important product, billing, and account updates."
  },
  {
    id: "securityAlerts",
    label: "Security alerts",
    description: "Password, login, and trusted-device changes."
  },
  {
    id: "meetingReminders",
    label: "Meeting reminders",
    description: "Reminders before mentor sessions."
  }
];

const STUDENT_PROGRESS_NOTIFICATIONS = [
  {
    id: "deadlineReminders",
    label: "Deadline reminders",
    description: "Admissions, scholarship, and task deadline nudges."
  },
  {
    id: "mentorMessages",
    label: "Mentor messages",
    description: "Alerts when a mentor sends a message."
  },
  {
    id: "weeklyDigest",
    label: "Progress digest",
    description: "A short summary of upcoming work and progress."
  }
];

export function getNotificationGroups(role = "student") {
  const progressTitle = role === "parent" ? "Student progress" : "Student progress";
  return [
    {
      id: "essential",
      title: "Essential notifications",
      items: ESSENTIAL_NOTIFICATIONS
    },
    {
      id: "progress",
      title: progressTitle,
      items: STUDENT_PROGRESS_NOTIFICATIONS
    },
    {
      id: "quiet",
      title: "Quiet hours",
      items: [
        {
          id: "quietHoursEnabled",
          label: "Quiet hours",
          description: "Pause non-urgent notifications during a set window."
        }
      ]
    }
  ];
}

export function getIntegrationCards(integrations = {}, options = {}) {
  const available = Boolean(options.integrationsAvailable);
  return [
    {
      id: "googleCalendar",
      label: "Google Calendar",
      purpose: "Sync Prelude meetings and deadlines to your calendar.",
      connected: Boolean(integrations.googleCalendar?.connected),
      status: integrations.googleCalendar?.connected ? "Connected" : available ? "Disconnected" : "Setup required",
      actionLabel: integrations.googleCalendar?.connected ? "Disconnect" : available ? "Connect Google Calendar" : "Coming soon",
      available,
      unavailableNote: "Calendar OAuth is not configured for this deployment yet."
    },
    {
      id: "zoom",
      label: "Zoom",
      purpose: "Use mentor-provided meeting links and scheduling context.",
      connected: Boolean(integrations.zoom?.connected),
      status: integrations.zoom?.connected ? "Connected" : available ? "Disconnected" : "Setup required",
      actionLabel: integrations.zoom?.connected ? "Disconnect" : available ? "Connect Zoom Account" : "Coming soon",
      available,
      unavailableNote: "Zoom account OAuth is not available yet. Meetings still support pasted Zoom links."
    }
  ];
}

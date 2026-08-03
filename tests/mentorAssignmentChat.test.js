import { describe, expect, it, vi } from "vitest";

describe("mentor assignment chat helpers", () => {
  it("creates one conversation and reactivates on duplicate assign", async () => {
    const calls = [];
    const admin = {
      rpc: vi.fn(async (name, args) => {
        calls.push({ name, args });
        if (name === "ensure_mentor_student_chat_thread") {
          return {
            data: {
              id: "thread-1",
              chat_type: "mentor_student",
              mentor_id: args.p_mentor_id,
              student_id: args.p_student_id,
              deactivated_at: null
            },
            error: null
          };
        }
        return { data: 1, error: null };
      }),
      from: vi.fn()
    };

    const { syncAssignedMentorStudentChat } = await import("../server/lib/mentorAssignmentChat.js");
    const first = await syncAssignedMentorStudentChat(admin, {
      studentId: "student-1",
      mentorId: "mentor-1"
    });
    const second = await syncAssignedMentorStudentChat(admin, {
      studentId: "student-1",
      mentorId: "mentor-1"
    });

    expect(first.id).toBe("thread-1");
    expect(second.id).toBe("thread-1");
    expect(admin.rpc).toHaveBeenCalledTimes(2);
    expect(admin.rpc.mock.calls[0][0]).toBe("ensure_mentor_student_chat_thread");
  });

  it("deactivates former mentor chats on remove", async () => {
    const admin = {
      rpc: vi.fn(async () => ({ data: 2, error: null })),
      from: vi.fn()
    };
    const { deactivateStudentMentorChats } = await import("../server/lib/mentorAssignmentChat.js");
    const result = await deactivateStudentMentorChats(admin, { studentId: "student-1" });
    expect(result.count).toBe(1);
    expect(admin.rpc).toHaveBeenCalledWith("deactivate_student_mentor_chats", {
      p_student_id: "student-1",
      p_except_mentor_id: null
    });
  });
});

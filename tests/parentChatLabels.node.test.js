import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyParentThreadLabels } from "../src/lib/parentChatLabels.js";

describe("applyParentThreadLabels", () => {
  it("labels separate mentor tabs when children have different mentors", () => {
    const labeled = applyParentThreadLabels([
      {
        id: "t1",
        mentorId: "m1",
        studentId: "s1",
        mentorName: "Asim Yoonas",
        studentName: "Jordan Lee"
      },
      {
        id: "t2",
        mentorId: "m2",
        studentId: "s2",
        mentorName: "Chris Nguyen",
        studentName: "Alex Kim"
      }
    ]);

    assert.equal(labeled.find((row) => row.studentName === "Jordan Lee")?.tabLabel, "Asim Yoonas");
    assert.equal(labeled.find((row) => row.studentName === "Alex Kim")?.tabLabel, "Chris Nguyen");
  });

  it("uses student names on tabs when children share the same mentor", () => {
    const labeled = applyParentThreadLabels([
      {
        id: "t1",
        mentorId: "m1",
        studentId: "s1",
        mentorName: "Asim Yoonas",
        studentName: "Jordan Lee"
      },
      {
        id: "t2",
        mentorId: "m1",
        studentId: "s2",
        mentorName: "Asim Yoonas",
        studentName: "Alex Kim"
      }
    ]);

    const jordan = labeled.find((row) => row.studentName === "Jordan Lee");
    const alex = labeled.find((row) => row.studentName === "Alex Kim");
    assert.equal(jordan?.tabLabel, "Jordan Lee");
    assert.equal(alex?.tabLabel, "Alex Kim");
    assert.equal(jordan?.tabSublabel, "Asim Yoonas");
    assert.equal(jordan?.sharedMentor, true);
  });
});

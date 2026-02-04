import { describe, expect, it } from "vitest";
import {
  getProfile,
  setProfile,
  updateProfileField,
} from "../lib/store/profileStore";

describe("profileStore", () => {
  it("updates profile fields", () => {
    const sessionId = "test-session";
    setProfile(sessionId, {
      name: "Acme",
      industry: "Logistics",
      description: "",
      aiMaturityLevel: "medium",
      aiUsage: "",
      goals: "",
    });

    const updated = updateProfileField(sessionId, "goals", "Scale AI");
    expect(updated.goals).toBe("Scale AI");

    const stored = getProfile(sessionId);
    expect(stored.name).toBe("Acme");
    expect(stored.aiMaturityLevel).toBe("medium");
  });
});

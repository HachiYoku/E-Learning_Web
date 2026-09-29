import { describe, expect, it } from "vitest";
import { normalizeUser } from "./userService.js";

describe("normalizeUser", () => {
  it("normalizes uploaded avatars without creating a remote fallback", () => {
    const user = normalizeUser({ _id: "user-1", name: "Nok", email: "nok@example.test", avatar: "https://res.cloudinary.com/example/image/upload/avatar.jpg" });
    expect(user.avatar).toBe("https://res.cloudinary.com/example/image/upload/avatar.jpg");
  });

  it("leaves avatar empty when no uploaded avatar exists", () => {
    const user = normalizeUser({ _id: "user-1", name: "Nok", email: "nok@example.test" });
    expect(user.avatar).toBe("");
    expect(JSON.stringify(user)).not.toMatch(/ui-avatars\.com/);
  });
});

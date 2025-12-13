import { describe, expect, it } from "vitest";
import { resolveChatId } from "./resolve-chat-id";

const PROVISIONAL_ID = "provisional-uuid-123";

describe("resolveChatId", () => {
  describe("shared routes (/share/:id)", () => {
    it("returns chat for /share/:id", () => {
      expect(
        resolveChatId({
          pathname: "/share/abc-123",
          provisionalId: PROVISIONAL_ID,
        })
      ).toEqual({
        id: "abc-123",
        type: "chat",
        isPersisted: true,
      });
    });

    it("handles share with complex id", () => {
      expect(
        resolveChatId({
          pathname: "/share/abc-123-def-456",
          provisionalId: PROVISIONAL_ID,
        })
      ).toEqual({
        id: "abc-123-def-456",
        type: "chat",
        isPersisted: true,
      });
    });
  });

  describe("project routes (/project/:projectId...)", () => {
    it("returns provisional for /project/:projectId (no chat)", () => {
      expect(
        resolveChatId({
          pathname: "/project/proj-123",
          provisionalId: PROVISIONAL_ID,
        })
      ).toEqual({
        id: PROVISIONAL_ID,
        type: "provisional",
        isPersisted: false,
      });
    });

    it("returns chat type for /project/:projectId/chat/:chatId", () => {
      expect(
        resolveChatId({
          pathname: "/project/proj-123/chat/chat-456",
          provisionalId: PROVISIONAL_ID,
        })
      ).toEqual({
        id: "chat-456",
        type: "chat",
        isPersisted: true,
      });
    });
  });

  describe("chat routes (/chat/:id)", () => {
    it("returns chat type for /chat/:id", () => {
      expect(
        resolveChatId({
          pathname: "/chat/chat-789",
          provisionalId: PROVISIONAL_ID,
        })
      ).toEqual({
        id: "chat-789",
        type: "chat",
        isPersisted: true,
      });
    });
  });

  describe("root and fallback", () => {
    it("returns provisional for /", () => {
      expect(
        resolveChatId({ pathname: "/", provisionalId: PROVISIONAL_ID })
      ).toEqual({
        id: PROVISIONAL_ID,
        type: "provisional",
        isPersisted: false,
      });
    });

    it("returns provisional for null pathname", () => {
      expect(
        resolveChatId({ pathname: null, provisionalId: PROVISIONAL_ID })
      ).toEqual({
        id: PROVISIONAL_ID,
        type: "provisional",
        isPersisted: false,
      });
    });

    it("returns provisional for unknown routes", () => {
      expect(
        resolveChatId({
          pathname: "/settings",
          provisionalId: PROVISIONAL_ID,
        })
      ).toEqual({
        id: PROVISIONAL_ID,
        type: "provisional",
        isPersisted: false,
      });
    });
  });
});

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { signIn } from "@/actions";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { createSession } from "@/lib/auth";

const mockUser = { id: "user-1", email: "test@example.com", password: "hashed" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signIn", () => {
  test("returns error when email is missing", async () => {
    const result = await signIn("", "password123");
    expect(result).toEqual({ success: false, error: "Email and password are required" });
  });

  test("returns error when password is missing", async () => {
    const result = await signIn("test@example.com", "");
    expect(result).toEqual({ success: false, error: "Email and password are required" });
  });

  test("returns error when user does not exist", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await signIn("nobody@example.com", "password123");
    expect(result).toEqual({ success: false, error: "Invalid credentials" });
  });

  test("returns error when password is incorrect", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const result = await signIn("test@example.com", "wrongpassword");
    expect(result).toEqual({ success: false, error: "Invalid credentials" });
  });

  test("returns success and creates session when credentials are valid", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await signIn("test@example.com", "correctpassword");

    expect(result).toEqual({ success: true });
    expect(createSession).toHaveBeenCalledWith(mockUser.id, mockUser.email);
  });

  test("returns error when an unexpected exception is thrown", async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("DB down"));

    const result = await signIn("test@example.com", "password123");
    expect(result).toEqual({ success: false, error: "An error occurred during sign in" });
  });
});

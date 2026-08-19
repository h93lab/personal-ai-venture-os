import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const listProjects = vi.fn();
const insertProject = vi.fn();
const updateProject = vi.fn();
const deleteProject = vi.fn();
const listIdeas = vi.fn();
const insertIdea = vi.fn();
const updateIdea = vi.fn();
const deleteIdea = vi.fn();
vi.mock("./db", () => ({ listProjects, insertProject, updateProject, deleteProject, listIdeas, insertIdea, updateIdea, deleteIdea }));
const { appRouter } = await import("./routers");

function context(): TrpcContext {
  return { user: { id: 55, openId: "domain-user", name: "Domain User", email: "domain@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("persistent domain CRUD", () => {
  it("lists projects and creates them for the authenticated owner", async () => {
    listProjects.mockResolvedValue([]);
    insertProject.mockResolvedValue(12);
    const caller = appRouter.createCaller(context());
    expect(await caller.projects.list()).toEqual([]);
    expect(await caller.projects.create({ title: "Pocket Quest", type: "لعبة", status: "فكرة", progress: 0 })).toEqual({ id: 12 });
    expect(insertProject).toHaveBeenCalledWith(expect.objectContaining({ userId: 55, title: "Pocket Quest" }));
  });

  it("creates and updates ideas with the authenticated owner", async () => {
    insertIdea.mockResolvedValue(9);
    const caller = appRouter.createCaller(context());
    expect(await caller.ideas.create({ title: "فكرة", category: "تطبيق", status: "تحتاج تقييم" })).toEqual({ id: 9 });
    await caller.ideas.update({ id: 9, data: { score: 80 } });
    expect(updateIdea).toHaveBeenCalledWith(55, 9, { score: 80 });
  });
});

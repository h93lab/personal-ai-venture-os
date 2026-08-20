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
const listDiscoverySignals = vi.fn();
const insertDiscoverySignal = vi.fn();
const updateDiscoverySignal = vi.fn();
const deleteDiscoverySignal = vi.fn();
const listCompetitors = vi.fn();
const insertCompetitor = vi.fn();
const updateCompetitor = vi.fn();
const deleteCompetitor = vi.fn();
vi.mock("./db", () => ({ listProjects, insertProject, updateProject, deleteProject, listIdeas, insertIdea, updateIdea, deleteIdea, listDiscoverySignals, insertDiscoverySignal, updateDiscoverySignal, deleteDiscoverySignal, listCompetitors, insertCompetitor, updateCompetitor, deleteCompetitor }));
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

  it("lists, creates, updates, and deletes discovery signals for the authenticated owner", async () => {
    listDiscoverySignals.mockResolvedValue([{ id: 3, userId: 55, title: "إشارة", type: "تطبيق", score: 70 }]);
    insertDiscoverySignal.mockResolvedValue(14);
    const caller = appRouter.createCaller(context());
    expect(await caller.discovery.list()).toHaveLength(1);
    expect(await caller.discovery.create({ title: "إشارة جديدة", type: "تطبيق", score: 80 })).toEqual({ id: 14 });
    await caller.discovery.update({ id: 14, data: { status: "reviewed" } });
    await caller.discovery.delete({ id: 14 });
    expect(insertDiscoverySignal).toHaveBeenCalledWith(expect.objectContaining({ userId: 55, title: "إشارة جديدة" }));
    expect(updateDiscoverySignal).toHaveBeenCalledWith(55, 14, { status: "reviewed" });
    expect(deleteDiscoverySignal).toHaveBeenCalledWith(55, 14);
  });

  it("lists, creates, updates, and deletes competitors for the authenticated owner", async () => {
    listCompetitors.mockResolvedValue([{ id: 4, userId: 55, name: "Competitor", category: "تطبيق", threatLevel: 65 }]);
    insertCompetitor.mockResolvedValue(18);
    const caller = appRouter.createCaller(context());
    expect(await caller.competitors.list()).toHaveLength(1);
    expect(await caller.competitors.create({ name: "منافس جديد", category: "لعبة", threatLevel: 70 })).toEqual({ id: 18 });
    await caller.competitors.update({ id: 18, data: { status: "reviewed" } });
    await caller.competitors.delete({ id: 18 });
    expect(insertCompetitor).toHaveBeenCalledWith(expect.objectContaining({ userId: 55, name: "منافس جديد" }));
    expect(updateCompetitor).toHaveBeenCalledWith(55, 18, { status: "reviewed" });
    expect(deleteCompetitor).toHaveBeenCalledWith(55, 18);
  });

  it("creates and updates ideas with the authenticated owner", async () => {
    insertIdea.mockResolvedValue(9);
    const caller = appRouter.createCaller(context());
    expect(await caller.ideas.create({ title: "فكرة", category: "تطبيق", status: "تحتاج تقييم" })).toEqual({ id: 9 });
    await caller.ideas.update({ id: 9, data: { score: 80 } });
    expect(updateIdea).toHaveBeenCalledWith(55, 9, { score: 80 });
  });
});

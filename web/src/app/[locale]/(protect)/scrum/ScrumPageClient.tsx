"use client";

import {useEffect, useMemo, useState} from "react";
import {ScrumBoard, type AppName, type Card, type ScrumStatus} from "@/modules/scrum/components/ScrumBoard";
import {ScrumOverviewCards} from "@/modules/scrum/components/ScrumOverviewCards";
import {
  createEpic,
  createStory,
  getScrumEpics,
  type ScrumEpic,
  type TaskTestItem,
  updateStory,
  updateTask
} from "@/modules/scrum/scrumClient";

type AppFilter = "ALL" | AppName;
type AgentFilter = "ALL" | string;

const appFilterOptions: Array<{value: AppFilter; label: string}> = [
  {value: "ALL", label: "Todas"},
  {value: "WEB", label: "Web"},
  {value: "API-CORE", label: "API"},
  {value: "MOBILE", label: "Mobile"}
];

const statusOrder: ScrumStatus[] = ["To Do", "In Progress", "In Review", "Done"];

function getStatusLabel(status: ScrumStatus) {
  if (status === "To Do") return "Pendiente";
  if (status === "In Progress") return "En proceso";
  if (status === "In Review") return "En revision";
  return "Done";
}

function mapPriority(priority: "P0" | "P1" | "P2"): Card["priority"] {
  if (priority === "P0") return "High";
  if (priority === "P1") return "Medium";
  return "Low";
}

function mapStatus(status: "Backlog" | "Ready" | "InProgress" | "InReview" | "Done" | "Blocked"): ScrumStatus {
  if (status === "InProgress") return "In Progress";
  if (status === "InReview") return "In Review";
  if (status === "Done") return "Done";
  return "To Do";
}

function mapTaskToBoardStatus(taskStatus: "ToDo" | "InProgress" | "Done", tests: TaskTestItem[]): ScrumStatus {
  if (taskStatus === "Done") return "Done";
  if (taskStatus === "ToDo") return "To Do";
  const checkedCount = tests.filter((test) => test.done).length;
  if (checkedCount > 0) return "In Review";
  return "In Progress";
}

function mapStoryStatus(status: ScrumStatus): "Backlog" | "Ready" | "InProgress" | "InReview" | "Done" | "Blocked" {
  if (status === "In Progress") return "InProgress";
  if (status === "In Review") return "InReview";
  if (status === "Done") return "Done";
  return "Backlog";
}

function mapTaskStatusFromBoard(status: ScrumStatus): "ToDo" | "InProgress" | "Done" {
  if (status === "Done") return "Done";
  if (status === "To Do") return "ToDo";
  return "InProgress";
}

function toCard(epics: ScrumEpic[]): Card[] {
  return epics.flatMap((epic) =>
    epic.stories.flatMap((story) => {
      if (story.tasks.length === 0) {
        return [
          {
            taskId: `NO-TASK-${story.id}`,
            id: story.id.slice(0, 10).toUpperCase(),
            storyId: story.id,
            title: story.title,
            label: story.module.toUpperCase(),
            app: story.app,
            status: mapStatus(story.status),
            priority: mapPriority(story.priority),
            points: story.points,
            assignee: "Sin asignar",
            notes: story.notes ?? "",
            requiredTests: story.requiredTests ?? [],
            taskTests: []
          }
        ];
      }

      return story.tasks.map((task) => ({
        taskId: task.id,
        id: task.id.slice(0, 10).toUpperCase(),
        storyId: story.id,
        title: `${story.title} · ${task.title}`,
        label: story.module.toUpperCase(),
        app: story.app,
        status: mapTaskToBoardStatus(task.status, task.tests ?? []),
        priority: mapPriority(story.priority),
        points: story.points,
        assignee: task.ownerRole ?? "Sin asignar",
        notes: story.notes ?? "",
        requiredTests: story.requiredTests ?? [],
        taskTests: task.tests ?? []
      }));
    })
  );
}

function aggregateStoryStatus(cards: Card[], storyId: string): ScrumStatus {
  const storyCards = cards.filter((card) => card.storyId === storyId);
  if (storyCards.length === 0) return "To Do";
  if (storyCards.every((card) => card.status === "Done")) return "Done";
  if (storyCards.some((card) => card.status === "In Review")) return "In Review";
  if (storyCards.some((card) => card.status === "In Progress" || card.status === "Done")) return "In Progress";
  return "To Do";
}

export function ScrumPageClient() {
  const [selectedApp, setSelectedApp] = useState<AppFilter>("ALL");
  const [selectedAgent, setSelectedAgent] = useState<AgentFilter>("ALL");
  const [epics, setEpics] = useState<ScrumEpic[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadScrumData() {
    const data = await getScrumEpics();
    setEpics(data);
    setCards(toCard(data));
    setError(null);
  }

  async function refresh() {
    setIsLoading(true);
    try {
      await loadScrumData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar el modulo Scrum.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    getScrumEpics()
      .then((data) => {
        if (!active) return;
        setEpics(data);
        setCards(toCard(data));
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "No fue posible cargar el modulo Scrum.");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const agentFilterOptions = useMemo(() => {
    const uniqueAgents = Array.from(new Set(cards.map((card) => card.assignee).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return [{value: "ALL", label: "Todos"}, ...uniqueAgents.map((agent) => ({value: agent, label: agent}))];
  }, [cards]);

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const appMatch = selectedApp === "ALL" || card.app === selectedApp;
      const agentMatch = selectedAgent === "ALL" || card.assignee === selectedAgent;
      return appMatch && agentMatch;
    });
  }, [selectedApp, selectedAgent, cards]);

  const completedPoints = filteredCards.filter((card) => card.status === "Done").reduce((sum, card) => sum + card.points, 0);
  const totalPoints = filteredCards.reduce((sum, card) => sum + card.points, 0);
  const progress = totalPoints === 0 ? 0 : Math.round((completedPoints / totalPoints) * 100);
  const pendingCount = filteredCards.filter((card) => card.status === "To Do").length;
  const activeCount = filteredCards.filter((card) => card.status === "In Progress").length;
  const reviewCount = filteredCards.filter((card) => card.status === "In Review").length;
  const doneCount = filteredCards.filter((card) => card.status === "Done").length;

  const selectedLabel = appFilterOptions.find((option) => option.value === selectedApp)?.label ?? "Todas";
  const selectedAgentLabel = agentFilterOptions.find((option) => option.value === selectedAgent)?.label ?? "Todos";

  async function handleCreateEpic() {
    const title = window.prompt("Titulo del epic:");
    if (!title) return;
    const description = window.prompt("Descripcion del epic:", "Nuevo epic Scrum") ?? "Nuevo epic Scrum";
    await createEpic({
      title,
      description,
      priority: "P1",
      status: "Backlog"
    });
    await refresh();
  }

  async function handleCreateStory() {
    if (epics.length === 0) {
      window.alert("Primero crea un epic.");
      return;
    }
    const epicId = window.prompt("Epic ID para la historia:", epics[0].id);
    if (!epicId) return;
    const title = window.prompt("Titulo de la historia:");
    if (!title) return;
    await createStory({
      epicId,
      title,
      userStory: `Como usuario quiero ${title.toLowerCase()} para mejorar el flujo Scrum.`,
      app: selectedApp === "ALL" ? "WEB" : selectedApp,
      module: "scrum",
      priority: "P1",
      status: "Backlog",
      points: 3
    });
    await refresh();
  }

  async function handleMoveCard(storyId: string, taskId: string | null, status: ScrumStatus) {
    const previous = cards;
    const nextCards = cards.map((card) => {
      if (taskId) {
        return card.taskId === taskId ? {...card, status} : card;
      }
      return card.storyId === storyId ? {...card, status} : card;
    });
    setCards(nextCards);
    try {
      if (taskId) {
        await updateTask(taskId, {status: mapTaskStatusFromBoard(status)});
      }
      await updateStory(storyId, {status: mapStoryStatus(aggregateStoryStatus(nextCards, storyId))});
      setError(null);
    } catch {
      setCards(previous);
      setError("No fue posible actualizar el estado de la tarea.");
    }
  }

  async function handleSaveNotes(storyId: string, notes: string) {
    const previous = cards;
    setCards((current) => current.map((card) => (card.storyId === storyId ? {...card, notes} : card)));
    try {
      await updateStory(storyId, {notes});
    } catch {
      setCards(previous);
      setError("No fue posible guardar la nota de la historia.");
    }
  }

  async function handleToggleTaskTest(storyId: string, taskId: string, tests: TaskTestItem[]) {
    const previous = cards;
    const checkedCount = tests.filter((test) => test.done).length;
    const allChecked = tests.length > 0 && checkedCount === tests.length;

    let nextBoardStatus: ScrumStatus = "In Progress";
    if (allChecked) nextBoardStatus = "Done";
    else if (checkedCount > 0) nextBoardStatus = "In Review";

    const nextTaskStatus: "ToDo" | "InProgress" | "Done" = allChecked ? "Done" : checkedCount > 0 ? "InProgress" : "ToDo";

    const nextCards = cards.map((item) => (item.taskId === taskId ? {...item, taskTests: tests, status: nextBoardStatus} : item));
    setCards(nextCards);
    try {
      await updateTask(taskId, {tests, status: nextTaskStatus});
      await updateStory(storyId, {status: mapStoryStatus(aggregateStoryStatus(nextCards, storyId))});
      setError(null);
    } catch (err) {
      setCards(previous);
      setError(err instanceof Error ? err.message : "No fue posible guardar el checklist de pruebas.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f5f7] p-4 text-slate-900 md:p-6">
      <section className="mx-auto max-w-[1400px]">
        <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">sell-Ai / SCRUM</p>
              <h1 className="mt-1 text-2xl font-bold">Project Board</h1>
              <p className="text-sm text-slate-600">Sprint activo - Scrum Master: Integration Scrum Orchestrator</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Filtrar por app</span>
                <div className="relative">
                  <select
                    className="min-w-[180px] appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    value={selectedApp}
                    onChange={(event) => setSelectedApp(event.target.value as AppFilter)}
                  >
                    {appFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">v</span>
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Filtrar por agente</span>
                <div className="relative">
                  <select
                    className="min-w-[220px] appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    value={selectedAgent}
                    onChange={(event) => setSelectedAgent(event.target.value as AgentFilter)}
                  >
                    {agentFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">v</span>
                </div>
              </label>
              <button
                type="button"
                onClick={() => void handleCreateEpic()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                + Epic
              </button>
              <button
                type="button"
                onClick={() => void handleCreateStory()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                + Story
              </button>
              <div className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Sprint Progress {progress}%</div>
            </div>
          </div>
        </header>

        {isLoading ? <p className="mt-4 text-sm text-slate-600">Cargando board Scrum...</p> : null}
        {error ? <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p> : null}

        <ScrumOverviewCards
          selectedLabel={`${selectedLabel} / ${selectedAgentLabel}`}
          totalPoints={totalPoints}
          pendingCount={pendingCount}
          activeCount={activeCount}
          reviewCount={reviewCount}
          doneCount={doneCount}
        />

        <ScrumBoard
          cards={filteredCards}
          statusOrder={statusOrder}
          getStatusLabel={getStatusLabel}
          onMoveCard={(storyId, taskId, status) => void handleMoveCard(storyId, taskId, status)}
          onSaveNotes={(storyId, notes) => void handleSaveNotes(storyId, notes)}
          onToggleTaskTest={(storyId, taskId, tests) => void handleToggleTaskTest(storyId, taskId, tests)}
        />
      </section>
    </main>
  );
}

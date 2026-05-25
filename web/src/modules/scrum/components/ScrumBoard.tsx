import {useMemo, useState} from "react";
import type {TaskTestItem} from "@/modules/scrum/scrumClient";

export type AppName = "WEB" | "API-CORE" | "MOBILE";
export type ScrumStatus = "To Do" | "In Progress" | "In Review" | "Done";

export type Card = {
  taskId: string | null;
  id: string;
  storyId: string;
  title: string;
  label: string;
  app: AppName;
  status: ScrumStatus;
  priority: "High" | "Medium" | "Low";
  points: number;
  assignee: string;
  notes: string;
  requiredTests: string[];
  taskTests: TaskTestItem[];
};

type ScrumBoardProps = {
  cards: Card[];
  statusOrder: ScrumStatus[];
  getStatusLabel: (status: ScrumStatus) => string;
  onMoveCard: (storyId: string, taskId: string | null, status: ScrumStatus) => void;
  onSaveNotes: (storyId: string, notes: string) => void;
  onToggleTaskTest: (storyId: string, taskId: string, tests: TaskTestItem[]) => void;
};

function priorityClass(priority: Card["priority"]) {
  if (priority === "High") return "bg-rose-100 text-rose-700";
  if (priority === "Medium") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export function ScrumBoard({
  cards,
  statusOrder,
  getStatusLabel,
  onMoveCard,
  onSaveNotes,
  onToggleTaskTest
}: ScrumBoardProps) {
  const [editingStory, setEditingStory] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return statusOrder.map((status) => ({
      status,
      cards: cards.filter((card) => card.status === status)
    }));
  }, [cards, statusOrder]);

  return (
    <section className="mt-4 grid gap-4 xl:grid-cols-4">
      {grouped.map((column) => (
        <article
          key={column.status}
          className="rounded-xl border border-slate-200 bg-slate-50/75 p-3"
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            const taskId = event.dataTransfer.getData("taskId");
            const storyId = event.dataTransfer.getData("storyId");
            if (!storyId) return;
            onMoveCard(storyId, taskId || null, column.status);
            setDraggingTaskId(null);
          }}
        >
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">{getStatusLabel(column.status)}</h2>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">{column.cards.length}</span>
          </header>

          <div className="space-y-3">
            {column.cards.map((card) => {
              const draft = notesDraft[card.storyId] ?? card.notes ?? "";
              const isEditing = editingStory === card.storyId;
              return (
                <div
                  key={`${card.storyId}-${card.taskId ?? "no-task"}`}
                  className={`rounded-xl border bg-white p-3 shadow-sm ${draggingTaskId === card.taskId ? "border-slate-400" : "border-slate-200"}`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("storyId", card.storyId);
                    if (card.taskId) {
                      event.dataTransfer.setData("taskId", card.taskId);
                    }
                    setDraggingTaskId(card.taskId);
                  }}
                  onDragEnd={() => {
                    setDraggingTaskId(null);
                  }}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.id}</p>
                      <h3 className="mt-1 text-sm font-semibold leading-5 text-slate-900">{card.title}</h3>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityClass(card.priority)}`}>
                      {card.priority}
                    </span>
                  </div>

                  <div className="mb-2 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium">{card.label}</span>
                    <span>{card.app}</span>
                    <span>{card.points} pts</span>
                    <span>{card.assignee}</span>
                  </div>

                  <label className="mb-2 block text-xs font-semibold text-slate-600">Mover estado</label>
                  <select
                    value={card.status}
                    onChange={(event) => onMoveCard(card.storyId, card.taskId, event.target.value as ScrumStatus)}
                    className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
                  >
                    {statusOrder.map((status) => (
                      <option key={status} value={status}>
                        {getStatusLabel(status)}
                      </option>
                    ))}
                  </select>

                  <div className="mb-3 rounded-lg border border-slate-200 p-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist de pruebas</p>
                    {card.requiredTests.length > 0 ? (
                      <ul className="mb-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                        {card.requiredTests.map((test) => (
                          <li key={test}>{test}</li>
                        ))}
                      </ul>
                    ) : null}

                    {card.taskId && card.taskTests.length > 0 ? (
                      <div className="space-y-1">
                        {card.taskTests.map((test) => (
                          <label key={test.id} className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={test.done}
                              onChange={(event) => {
                                const next = card.taskTests.map((item) =>
                                  item.id === test.id ? {...item, done: event.target.checked} : item
                                );
                                onToggleTaskTest(card.storyId, card.taskId!, next);
                              }}
                            />
                            {test.label}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Sin task tests asociados.</p>
                    )}
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</p>
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={draft}
                          onChange={(event) =>
                            setNotesDraft((current) => ({
                              ...current,
                              [card.storyId]: event.target.value
                            }))
                          }
                          className="min-h-[72px] w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onSaveNotes(card.storyId, draft);
                              setEditingStory(null);
                            }}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNotesDraft((current) => ({...current, [card.storyId]: card.notes ?? ""}));
                              setEditingStory(null);
                            }}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setNotesDraft((current) => ({...current, [card.storyId]: card.notes ?? ""}));
                          setEditingStory(card.storyId);
                        }}
                        className="w-full rounded-lg border border-dashed border-slate-300 px-2 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                      >
                        {card.notes?.trim() ? card.notes : "Agregar nota..."}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      ))}
    </section>
  );
}

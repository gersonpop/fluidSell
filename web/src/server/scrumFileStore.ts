import {readFile, writeFile} from "node:fs/promises";

type ScrumEpicStatus = "Backlog" | "Ready" | "InProgress" | "InReview" | "Done" | "Blocked";
type ScrumPriority = "P0" | "P1" | "P2";

export type ScrumEpic = {
  id: string;
  title: string;
  description: string;
  priority: ScrumPriority;
  status: ScrumEpicStatus;
};

export type ScrumStory = {
  id: string;
  epicId: string;
  title: string;
  userStory: string;
  app: "WEB" | "API-CORE" | "MOBILE";
  module: string;
  priority: ScrumPriority;
  status: ScrumEpicStatus;
  points: number;
  decisionRecordIds: string[];
  acceptanceCriteria: string[];
  requiredTests: string[];
  notes: string;
  updatedAt: string;
};

type TaskTestItem = {
  id: string;
  label: string;
  done: boolean;
};

export type ScrumTask = {
  id: string;
  storyId: string;
  title: string;
  ownerRole: string;
  status: "ToDo" | "InProgress" | "Done";
  tests: TaskTestItem[];
  updatedAt: string;
};

export type ScrumDb = {
  epics: ScrumEpic[];
  stories: ScrumStory[];
  tasks: ScrumTask[];
};

const scrumDbPath = `${process.cwd()}/../.scrum/scrum-db.json`;

async function readScrumDb() {
  const raw = await readFile(scrumDbPath, "utf8");
  return JSON.parse(raw) as ScrumDb;
}

async function writeScrumDb(next: ScrumDb) {
  await writeFile(scrumDbPath, JSON.stringify(next, null, 2));
}

export async function getScrumEpicsWithStories() {
  const db = await readScrumDb();
  const storiesByEpic = new Map<string, Array<ScrumStory & {tasks: ScrumTask[]}>>();

  for (const story of db.stories) {
    const tasks = db.tasks.filter((task) => task.storyId === story.id);
    const current = storiesByEpic.get(story.epicId) ?? [];
    current.push({...story, tasks});
    storiesByEpic.set(story.epicId, current);
  }

  return db.epics.map((epic) => ({
    ...epic,
    stories: storiesByEpic.get(epic.id) ?? []
  }));
}

function nextId(prefix: string, existingIds: string[]) {
  const max = existingIds
    .map((id) => {
      const parts = id.split("-");
      return Number(parts.at(-1));
    })
    .filter((value) => Number.isFinite(value))
    .reduce((acc, value) => Math.max(acc, value), 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export async function createEpic(input: Pick<ScrumEpic, "title" | "description" | "priority" | "status">) {
  const db = await readScrumDb();
  const id = nextId("EPIC", db.epics.map((epic) => epic.id));
  const epic: ScrumEpic = {id, ...input};
  db.epics.push(epic);
  await writeScrumDb(db);
  return epic;
}

export async function createStory(
  input: Pick<ScrumStory, "epicId" | "title" | "userStory" | "app" | "module" | "priority" | "status" | "points">
) {
  const db = await readScrumDb();
  const id = nextId("STORY", db.stories.map((story) => story.id));
  const now = new Date().toISOString();
  const story: ScrumStory = {
    id,
    ...input,
    decisionRecordIds: [],
    acceptanceCriteria: [],
    requiredTests: [],
    notes: "",
    updatedAt: now
  };
  db.stories.push(story);

  const taskId = nextId("TASK", db.tasks.map((task) => task.id));
  const task: ScrumTask = {
    id: taskId,
    storyId: id,
    title: `Checklist inicial para ${input.title}`,
    ownerRole: "Backend Engineer",
    status: "ToDo",
    tests: [
      {id: "T1", label: "Definir criterio de implementacion", done: false},
      {id: "T2", label: "Validar caso principal", done: false}
    ],
    updatedAt: now
  };
  db.tasks.push(task);

  await writeScrumDb(db);
  return story;
}

export async function updateStory(storyId: string, patch: Partial<ScrumStory>) {
  const db = await readScrumDb();
  const index = db.stories.findIndex((story) => story.id === storyId);
  if (index === -1) throw new Error("Story no encontrada");
  db.stories[index] = {
    ...db.stories[index],
    ...patch,
    updatedAt: new Date().toISOString()
  };
  await writeScrumDb(db);
  return db.stories[index];
}

export async function updateTask(taskId: string, patch: Partial<ScrumTask>) {
  const db = await readScrumDb();
  const index = db.tasks.findIndex((task) => task.id === taskId);
  if (index === -1) throw new Error("Task no encontrada");
  db.tasks[index] = {
    ...db.tasks[index],
    ...patch,
    updatedAt: new Date().toISOString()
  };
  await writeScrumDb(db);
  return db.tasks[index];
}

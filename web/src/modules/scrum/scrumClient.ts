export type ScrumStatusRaw = "Backlog" | "Ready" | "InProgress" | "InReview" | "Done" | "Blocked";
export type ScrumPriority = "P0" | "P1" | "P2";
export type AppName = "WEB" | "API-CORE" | "MOBILE";

export type TaskTestItem = {
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
};

export type ScrumStory = {
  id: string;
  epicId: string;
  title: string;
  userStory: string;
  app: AppName;
  module: string;
  priority: ScrumPriority;
  status: ScrumStatusRaw;
  points: number;
  notes?: string;
  requiredTests?: string[];
  tasks: ScrumTask[];
};

export type ScrumEpic = {
  id: string;
  title: string;
  description: string;
  priority: ScrumPriority;
  status: ScrumStatusRaw;
  stories: ScrumStory[];
};

async function request<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const fallback = `Request failed: ${response.status}`;
    try {
      const body = (await response.json()) as {message?: string};
      throw new Error(body.message ?? fallback);
    } catch {
      throw new Error(fallback);
    }
  }

  return (await response.json()) as T;
}

export async function getScrumEpics() {
  const data = await request<{epics: ScrumEpic[]}>("/api/v1/scrum/epics");
  return data.epics;
}

export async function createEpic(input: Pick<ScrumEpic, "title" | "description" | "priority" | "status">) {
  const data = await request<{epic: ScrumEpic}>("/api/v1/scrum/epics", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return data.epic;
}

export async function createStory(input: {
  epicId: string;
  title: string;
  userStory: string;
  app: AppName;
  module: string;
  priority: ScrumPriority;
  status: ScrumStatusRaw;
  points: number;
}) {
  const {epicId, ...payload} = input;
  const data = await request<{story: ScrumStory}>(`/api/v1/scrum/epics/${epicId}/stories`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return data.story;
}

export async function updateStory(storyId: string, patch: Partial<ScrumStory>) {
  const data = await request<{story: ScrumStory}>(`/api/v1/scrum/stories/${storyId}`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
  return data.story;
}

export async function updateTask(taskId: string, patch: Partial<ScrumTask>) {
  const data = await request<{task: ScrumTask}>(`/api/v1/scrum/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
  return data.task;
}

import { existsSync, readFileSync } from "node:fs";
import type {
  AgentInteractiveResponse,
  AgentPriorityResponse,
  InteractiveOption,
} from "@workspace/db";

type Language = "ar" | "en";
type Factor = "deadline" | "importance" | "impact";
type KnowledgeRecord = { id: string; category: string; concept: string; content: string; source: { name: string; type: string; url: string } };
type FlowStep = { id: string; message: string; options?: Array<{ id: string; label: string; value: string }>; allow_free_text?: boolean; next_action: string };
type Flow = { id: string; trigger: string; knowledge_concepts?: string[]; steps: FlowStep[] };
type FlowDocument = {
  agent_rules: { max_options_per_question: number };
  flows: Flow[];
  priority_scoring: {
    scale: { min: number; max: number };
    factors: Array<{ id: Factor; label: string; description: string; score_guide: Record<string, string> }>;
  };
  final_response_template: { message: string; buttons: Array<{ id: string; label: string; next_action: string }> };
};

export type FlowTask = {
  task: string;
  deadline?: number;
  importance?: number;
  impact?: number;
  priorityScore?: number;
  priority?: number;
  reason?: string;
  nextStep?: string;
};

export type InteractiveState = {
  version: 1;
  semanticExtractionVersion?: 1;
  branch?: string;
  stepIndex: number;
  language: Language;
  tasks: FlowTask[];
  taskIndex: number;
  factorIndex: number;
  phase: "branch" | "count" | "task_list" | "task_name" | "small_step" | "time_category" | "overwhelm_category" | "factors" | "tie" | "complete" | "edit_task" | "edit_factor" | "edit_value";
  awaitingTie?: { taskIndexes: number[] };
  tieOrder?: number[];
  tieResolvedTasks?: string[];
};

function dataUrl(fileName: string): URL {
  const candidates = [
    new URL(`./data/${fileName}`, import.meta.url),
    new URL(`../../data/${fileName}`, import.meta.url),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`ADHD AgentX data asset is missing: ${fileName}`);
  return found;
}

const flowDocument = JSON.parse(readFileSync(dataUrl("adhd-agentx-interactive-flows.json"), "utf8")) as FlowDocument;
const knowledgeBase = JSON.parse(readFileSync(dataUrl("adhd-agentx-knowledge.json"), "utf8")) as KnowledgeRecord[];
const flowById = new Map(flowDocument.flows.map((flow) => [flow.id, flow]));

export function assertFlowAssetsLoaded(): { knowledgeRecords: number; flowCount: number } {
  return { knowledgeRecords: knowledgeBase.length, flowCount: flowDocument.flows.length };
}

const english: Record<string, string> = {
  start_01: "What would you like help with most right now?",
  many_tasks_01: "Okay, let’s sort them one at a time. About how many tasks do you have?",
  many_tasks_02: "Write your tasks, even if there are several, and I’ll sort them with you.",
  cant_start_01: "Let’s make it smaller. What task are you trying to start?",
  cant_start_02: "What is the closest thing you could do in the next 5–15 minutes?",
  time_01: "What do you need help remembering the timing for?",
  time_02: "When is the appointment or latest time to complete it?",
  overwhelmed_01: "That’s okay. We do not need to solve everything now. What feels most pressing?",
  overwhelmed_02: "Let’s choose one starting point. Which has the closest deadline or biggest impact?",
};
const optionEnglish: Record<string, string> = {
  many_tasks: "I have many tasks", cant_start: "I cannot get started", time: "I forget dates and time", overwhelmed: "I feel scattered",
  one_to_three: "1–3", four_to_six: "4–6", seven_plus: "7 or more",
  open_prepare: "Open and prepare only", first_step: "Take the first step", not_sure: "I’m not sure",
  deadline: "A due date", appointment: "An appointment", task: "A task", routine: "A daily routine",
  today: "Today", tomorrow: "Tomorrow", this_week: "This week", no_deadline: "No deadline",
  work_study: "Study / work", personal: "Personal matters", appointments: "Appointments and commitments", everything: "Everything together",
  urgent: "It has a close deadline", important: "It is very important", small_easy: "Something small I can start",
  start_first: "Start priority 1", edit_priorities: "Edit priorities", review_priorities: "Review priorities",
};

const knowledgeEnglish: Record<string, string> = {
  adhd_006: "Executive-function and self-regulation challenges can make planning and organizing more difficult.",
  adhd_007: "Helpful approaches to time blindness include reminders and making time visible.",
  adhd_008: "Research on task initiation supports reducing a difficult task into smaller steps.",
};

function localizedText(step: FlowStep, language: Language) {
  return language === "en" ? english[step.id] ?? step.message : step.message;
}

function localizedOptions(step: FlowStep, language: Language): InteractiveOption[] {
  return (step.options ?? []).slice(0, flowDocument.agent_rules.max_options_per_question).map((option) => ({
    id: option.id,
    value: option.value,
    label: language === "en" ? optionEnglish[option.id] ?? option.label : option.label,
  }));
}

function responseForStep(step: FlowStep, state: InteractiveState, knowledgeConcepts?: string[]): AgentInteractiveResponse {
  const knowledgeRecord = knowledgeConcepts
    ?.map((concept) => knowledgeBase.find((record) => record.concept === concept))
    .find(Boolean);
  const context = knowledgeRecord
    ? state.language === "ar"
      ? knowledgeRecord.content
      : knowledgeEnglish[knowledgeRecord.id]
    : undefined;
  return {
    type: "interactive",
    message: context
      ? state.language === "ar"
        ? `${localizedText(step, state.language)}\n\nسياق داعم: ${context}`
        : `${localizedText(step, state.language)}\n\nHelpful context: ${context}`
      : localizedText(step, state.language),
    options: localizedOptions(step, state.language),
    allowFreeText: step.allow_free_text ?? localizedOptions(step, state.language).length === 0,
    nextAction: "ask",
  };
}

function priorityReason(task: FlowTask, language: Language): string {
  const deadline = language === "en"
    ? task.deadline === 5 ? "Due today or overdue"
      : task.deadline === 4 ? "Due within two days"
        : task.deadline === 3 ? "Due this week"
          : task.deadline === 2 ? "Due within two weeks"
            : "No close deadline"
    : task.deadline === 5 ? "موعدها اليوم أو متأخرة"
      : task.deadline === 4 ? "موعدها خلال يومين"
        : task.deadline === 3 ? "موعدها هذا الأسبوع"
          : task.deadline === 2 ? "موعدها خلال أسبوعين"
            : "ليس لها موعد قريب";
  const importance = language === "en"
    ? task.importance === 5 ? "extremely important"
      : task.importance === 4 ? "very important"
        : task.importance === 3 ? "moderately important"
          : "lower importance"
    : task.importance === 5 ? "ومهمّة جدًا"
      : task.importance === 4 ? "ومهمّة بدرجة كبيرة"
        : task.importance === 3 ? "ومتوسطة الأهمية"
          : "وأهميتها أقل";
  const impact = (task.impact ?? 1) >= 4
    ? language === "en" ? " with a high impact if delayed" : " وتأثير تأخيرها مرتفع"
    : "";
  return language === "en"
    ? `${deadline}; ${importance}${impact}.`
    : `${deadline} ${importance}${impact}.`;
}

function priorityNextStep(task: FlowTask, language: Language): string {
  return language === "en"
    ? `Open what you need for “${task.task}” and work for 10 minutes.`
    : `افتح ما تحتاجه لمهمة «${task.task}» واعمل عليها لمدة ١٠ دقائق.`;
}

function initialState(language: Language): InteractiveState {
  return { version: 1, semanticExtractionVersion: 1, stepIndex: 0, language, tasks: [], taskIndex: 0, factorIndex: 0, phase: "branch" };
}

export function parseTasks(text: string): string[] {
  return text
    .split(/[\n,،;؛|•]+/)
    .map((item) => item.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function shouldExtractActionableTasks(
  state: InteractiveState,
  input: { message?: string; hasOption: boolean },
): boolean {
  if (input.hasOption) return false;
  const message = input.message?.trim() ?? "";
  if (!message) return false;
  if (state.phase === "task_list") return true;
  if (
    state.semanticExtractionVersion === 1 ||
    state.branch !== "many_tasks" ||
    (state.phase !== "factors" && state.phase !== "complete")
  ) {
    return false;
  }
  if (/^[1-5١-٥]$/.test(message)) return false;
  const separatorSignal = /[\n,،;؛|•]/.test(message);
  const arabicConjunctionSignals = message.match(/(?:^|\s)و[\u0600-\u06ff]+/g)?.length ?? 0;
  const englishConjunctionSignals = message.match(/\band\b/gi)?.length ?? 0;
  return separatorSignal || arabicConjunctionSignals >= 2 || englishConjunctionSignals >= 2;
}

function factorPrompt(state: InteractiveState): AgentInteractiveResponse {
  const factor = flowDocument.priority_scoring.factors[state.factorIndex]!;
  const arabicGuide: Record<Factor, Record<string, string>> = {
    deadline: { "5": "اليوم أو متأخر", "4": "خلال يومين", "3": "خلال ٣–٧ أيام", "2": "خلال أسبوعين" },
    importance: { "5": "مهم جدًا", "4": "مهم للغاية", "3": "متوسط الأهمية", "2": "أهمية منخفضة" },
    impact: { "5": "تأثير سلبي كبير", "4": "تأثير مرتفع", "3": "تأثير متوسط", "2": "تأثير منخفض" },
  };
  const options: InteractiveOption[] = Object.entries(factor.score_guide)
    .filter(([value]) => Number(value) >= 2)
    .sort(([a], [b]) => Number(b) - Number(a))
    .slice(0, flowDocument.agent_rules.max_options_per_question)
    .map(([value, label]) => ({
    id: `${factor.id}_${value}`,
    value,
    label: state.language === "en" ? label : (arabicGuide[factor.id][value] ?? `درجة ${value}`),
  }));
  const task = state.tasks[state.taskIndex]!.task;
  const label = state.language === "en" ? factor.label : factor.id === "deadline" ? "الموعد" : factor.id === "importance" ? "الأهمية" : "التأثير";
  const message = state.language === "en"
    ? `For “${task}”, how would you rate its ${label.toLowerCase()}? Choose 2–5, or type 1 for the lowest rating.`
    : `بالنسبة إلى «${task}»، كيف تقيّم ${label}؟ اختر من ٢ إلى ٥، أو اكتب ١ لأقل درجة.`;
  return { type: "interactive", message, options, allowFreeText: true, nextAction: "ask" };
}

function priorityResponse(state: InteractiveState): AgentPriorityResponse {
  const template = flowDocument.final_response_template;
  const resolved = state.tieResolvedTasks ?? [];
  const sorted = [...state.tasks].sort((a, b) =>
    (b.priorityScore ?? 0) - (a.priorityScore ?? 0) ||
    (b.deadline ?? 0) - (a.deadline ?? 0) ||
    (resolved.indexOf(a.task) === -1 ? Number.MAX_SAFE_INTEGER : resolved.indexOf(a.task)) -
    (resolved.indexOf(b.task) === -1 ? Number.MAX_SAFE_INTEGER : resolved.indexOf(b.task)),
  );
  const items = sorted.map((task, index) => ({
    priority: index + 1,
    task: task.task,
    reason: priorityReason(task, state.language),
    nextStep: priorityNextStep(task, state.language),
    priorityScore: task.priorityScore,
  }));
  sorted.forEach((task, index) => {
    task.priority = index + 1;
    task.reason = priorityReason(task, state.language);
    task.nextStep = priorityNextStep(task, state.language);
  });
  return {
    type: "priority_list",
    message: state.language === "en" ? "Here are your priorities, from highest to lowest:" : template.message,
    items,
    options: template.buttons.map((button) => ({ id: button.id, value: button.next_action, label: state.language === "en" ? optionEnglish[button.id] ?? "Start priority 1" : button.label })),
    nextAction: "start_task",
  };
}

function tieResponse(state: InteractiveState, indexes: number[]): AgentInteractiveResponse {
  const options = indexes.slice(0, flowDocument.agent_rules.max_options_per_question).map((index) => ({
    id: `tie_${index}`,
    value: String(index),
    label: state.tasks[index]!.task,
  }));
  return {
    type: "interactive",
    message: state.language === "en"
      ? "These tasks have the same score and deadline. Which feels more important to you?"
      : "لهاتين المهمتين النتيجة والموعد نفسيهما. أيهما أهم بالنسبة لك؟",
    options,
    allowFreeText: false,
    nextAction: "ask",
  };
}

function rankOrAskTie(state: InteractiveState): AgentInteractiveResponse | AgentPriorityResponse {
  const resolved = new Set(state.tieResolvedTasks ?? []);
  const ordered = state.tasks
    .filter((task) => !resolved.has(task.task))
    .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0) || (b.deadline ?? 0) - (a.deadline ?? 0));
  const unresolved = ordered.findIndex((task, index) => {
    const next = ordered[index + 1];
    return next && task.priorityScore === next.priorityScore && task.deadline === next.deadline;
  });
  if (unresolved >= 0) {
    const tiedScore = ordered[unresolved]!.priorityScore;
    const tiedDeadline = ordered[unresolved]!.deadline;
    const taskIndexes = state.tasks
      .map((task, index) => ({ task, index }))
      .filter(({ task }) => task.priorityScore === tiedScore && task.deadline === tiedDeadline && !resolved.has(task.task))
      .map(({ index }) => index);
    state.awaitingTie = { taskIndexes };
    return tieResponse(state, taskIndexes);
  }
  return priorityResponse(state);
}

function editTaskResponse(state: InteractiveState): AgentInteractiveResponse {
  const rankedTasks = state.tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => (a.task.priority ?? Number.MAX_SAFE_INTEGER) - (b.task.priority ?? Number.MAX_SAFE_INTEGER));
  return {
    type: "interactive",
    message: state.language === "en"
      ? "Which priority would you like to edit?"
      : "أي أولوية تريد تعديلها؟",
    options: rankedTasks.map(({ task, index }) => ({
      id: `edit_task_${index}`,
      value: String(index),
      label: state.language === "en"
        ? `Priority ${task.priority}: ${task.task}`
        : `الأولوية ${task.priority}: ${task.task}`,
    })),
    allowFreeText: false,
    nextAction: "ask",
  };
}

function editFactorResponse(state: InteractiveState): AgentInteractiveResponse {
  const task = state.tasks[state.taskIndex]!;
  const labels: Record<Factor, { en: string; ar: string }> = {
    deadline: { en: "Deadline", ar: "الموعد" },
    importance: { en: "Importance", ar: "الأهمية" },
    impact: { en: "Impact", ar: "التأثير" },
  };
  return {
    type: "interactive",
    message: state.language === "en"
      ? `What would you like to edit for “${task.task}”?`
      : `ما الذي تريد تعديله في «${task.task}»؟`,
    options: flowDocument.priority_scoring.factors.map((factor, index) => ({
      id: `edit_factor_${factor.id}`,
      value: String(index),
      label: labels[factor.id][state.language],
    })),
    allowFreeText: false,
    nextAction: "ask",
  };
}

function finalAction(state: InteractiveState, action: string): AgentInteractiveResponse | AgentPriorityResponse {
  const buttons = flowDocument.final_response_template.buttons;
  const startAction = buttons.find((button) => button.next_action === "start_priority_1")?.next_action;
  const reviewAction = buttons.find((button) => button.next_action === "review_priorities")?.next_action;
  const editAction = buttons.find((button) => button.next_action === "edit_priorities")?.next_action;
  const priority = [...state.tasks].sort((a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER))[0];

  if (action === startAction && priority) {
    return {
      type: "interactive",
      message: state.language === "en"
        ? `Let’s begin with Priority 1: ${priority.task}.\n\nNext step: ${priority.nextStep ?? `Start with one small step on ${priority.task}.`}`
        : `لنبدأ بالأولوية ١: ${priority.task}.\n\nالخطوة التالية: ${priority.nextStep ?? `ابدأ بخطوة صغيرة واحدة في ${priority.task}.`}`,
      options: [],
      allowFreeText: true,
      nextAction: "start_task",
    };
  }
  if (action === reviewAction) return priorityResponse(state);
  if (action === editAction) {
    state.phase = "edit_task";
    return editTaskResponse(state);
  }
  return priorityResponse(state);
}

export function readInteractiveState(value: unknown, language: Language): InteractiveState {
  if (!value || typeof value !== "object") return initialState(language);
  const candidate = value as Partial<InteractiveState>;
  if (
    candidate.version !== 1 ||
    (candidate.language !== "ar" && candidate.language !== "en") ||
    !Number.isInteger(candidate.stepIndex) ||
    !Array.isArray(candidate.tasks) ||
    !Number.isInteger(candidate.taskIndex) ||
    !Number.isInteger(candidate.factorIndex) ||
    typeof candidate.phase !== "string"
  ) {
    return initialState(language);
  }
  return { ...candidate, language, tasks: candidate.tasks as FlowTask[] } as InteractiveState;
}

export function startInteractiveFlow(language: Language): { state: InteractiveState; response: AgentInteractiveResponse } {
  const state = initialState(language);
  const step = flowById.get("start")!.steps[0]!;
  return { state, response: responseForStep(step, state) };
}

export function startNewOrganizeConversation(language: Language): {
  state: InteractiveState;
  response: AgentInteractiveResponse;
} {
  const state = initialState(language);
  const flow = flowById.get("many_tasks")!;
  state.branch = "many_tasks";
  state.stepIndex = 1;
  state.phase = "task_list";
  return { state, response: responseForStep(flow.steps[1]!, state) };
}

export function advanceInteractiveFlow(
  previous: InteractiveState,
  input: { message: string; value?: string; optionId?: string; extractedTasks?: string[] },
  language: Language,
): { state: InteractiveState; response: AgentInteractiveResponse | AgentPriorityResponse } {
  const state = { ...previous, language, tasks: previous.tasks.map((task) => ({ ...task })) };
  const value = input.value ?? input.optionId ?? input.message.trim();

  if (input.extractedTasks?.length && state.phase !== "task_list") {
    state.semanticExtractionVersion = 1;
    state.branch = "many_tasks";
    state.stepIndex = 1;
    state.tasks = input.extractedTasks.map((task) => ({ task }));
    state.taskIndex = 0;
    state.factorIndex = 0;
    state.phase = "factors";
    state.awaitingTie = undefined;
    state.tieOrder = undefined;
    state.tieResolvedTasks = undefined;
    return { state, response: factorPrompt(state) };
  }

  if (state.awaitingTie) {
    const selected = Number(value);
    if (!state.awaitingTie.taskIndexes.includes(selected)) return { state, response: tieResponse(state, state.awaitingTie.taskIndexes) };
    const selectedTask = state.tasks[selected]!;
    state.tieOrder = [...(state.tieOrder ?? []), selected];
    state.tieResolvedTasks = [...(state.tieResolvedTasks ?? []), selectedTask.task];
    state.tasks = [selectedTask, ...state.tasks.filter((_, index) => index !== selected)];
    state.awaitingTie = undefined;
    return { state, response: rankOrAskTie(state) };
  }

  if (state.phase === "edit_task") {
    const selected = Number(value);
    if (!Number.isInteger(selected) || !state.tasks[selected]) {
      return { state, response: editTaskResponse(state) };
    }
    state.taskIndex = selected;
    state.phase = "edit_factor";
    return { state, response: editFactorResponse(state) };
  }

  if (state.phase === "edit_factor") {
    const selected = Number(value);
    if (!Number.isInteger(selected) || !flowDocument.priority_scoring.factors[selected]) {
      return { state, response: editFactorResponse(state) };
    }
    state.factorIndex = selected;
    state.phase = "edit_value";
    return { state, response: factorPrompt(state) };
  }

  if (state.phase === "edit_value") {
    const factor = flowDocument.priority_scoring.factors[state.factorIndex]!;
    const numeric = Number(value);
    if (!Object.keys(factor.score_guide).includes(String(numeric)) || numeric < 1 || numeric > 5) {
      return { state, response: factorPrompt(state) };
    }
    state.tasks[state.taskIndex]![factor.id] = numeric;
    const task = state.tasks[state.taskIndex]!;
    task.priorityScore = (task.deadline ?? 0) + (task.importance ?? 0) + (task.impact ?? 0);
    state.awaitingTie = undefined;
    state.tieOrder = undefined;
    state.tieResolvedTasks = undefined;
    state.phase = "complete";
    return { state, response: rankOrAskTie(state) };
  }

  if (state.phase === "complete") {
    return { state, response: finalAction(state, value) };
  }

  if (state.phase === "branch" && !state.branch) {
    state.branch = value;
    const flow = flowById.get(value);
    if (!flow) return { state, response: startInteractiveFlow(language).response };
    if (value === "many_tasks") state.phase = "count";
    else if (value === "cant_start") state.phase = "task_name";
    else if (value === "time") state.phase = "time_category";
    else state.phase = "overwhelm_category";
    return { state, response: responseForStep(flow.steps[0]!, state, flow.knowledge_concepts) };
  }

  const flow = state.branch ? flowById.get(state.branch) : undefined;
  if (!flow) return { state, response: startInteractiveFlow(language).response };
  const currentStep = flow.steps[state.stepIndex]!;

  if (state.phase === "count") {
    if (!currentStep.options?.some((option) => option.value === value)) return { state, response: responseForStep(currentStep, state) };
    state.stepIndex = 1;
    state.phase = "task_list";
    return { state, response: responseForStep(flow.steps[1]!, state) };
  }
  if (state.phase === "task_list") {
    const parsedTasks = input.extractedTasks ?? parseTasks(input.message);
    if (!parsedTasks.length) return { state, response: responseForStep(currentStep, state) };
    state.semanticExtractionVersion = 1;
    state.tasks = parsedTasks.map((task) => ({ task }));
    state.taskIndex = 0;
    state.factorIndex = 0;
    state.phase = "factors";
    return { state, response: factorPrompt(state) };
  }

  if (state.phase === "task_name") {
    const task = input.message.trim();
    if (!task) return { state, response: { type: "interactive", message: state.language === "en" ? "Please name the task so I do not have to guess." : "اكتب اسم المهمة حتى لا أخمّن عنك.", options: [], allowFreeText: true, nextAction: "ask" } };
    state.tasks = [{ task }];
    state.taskIndex = 0;
    state.factorIndex = 0;
    if (state.branch === "cant_start") {
      state.phase = "small_step";
      state.stepIndex = 1;
      return { state, response: responseForStep(flow.steps[1]!, state, flow.knowledge_concepts) };
    }
    state.phase = "factors";
    return { state, response: factorPrompt(state) };
  }

  if (state.phase === "small_step") {
    if (!currentStep.options?.some((option) => option.value === value)) return { state, response: responseForStep(currentStep, state, flow.knowledge_concepts) };
    state.phase = "factors";
    return { state, response: factorPrompt(state) };
  }

  if (state.phase === "time_category") {
    if (!currentStep.options?.some((option) => option.value === value)) return { state, response: responseForStep(currentStep, state, flow.knowledge_concepts) };
    state.phase = "task_name";
    state.stepIndex = 1;
    return { state, response: { type: "interactive", message: state.language === "en" ? "What is the task or commitment name? I need it before I prioritize." : "ما اسم المهمة أو الالتزام؟ أحتاج الاسم قبل ترتيب الأولويات.", options: [], allowFreeText: true, nextAction: "ask" } };
  }

  if (state.phase === "overwhelm_category") {
    if (state.stepIndex === 0) {
      if (!currentStep.options?.some((option) => option.value === value)) return { state, response: responseForStep(currentStep, state, flow.knowledge_concepts) };
      state.stepIndex = 1;
      return { state, response: responseForStep(flow.steps[1]!, state, flow.knowledge_concepts) };
    }
    if (!currentStep.options?.some((option) => option.value === value)) return { state, response: responseForStep(currentStep, state, flow.knowledge_concepts) };
    state.phase = "task_name";
    return { state, response: { type: "interactive", message: state.language === "en" ? "What is the task name? I need it before I prioritize." : "ما اسم المهمة؟ أحتاج الاسم قبل ترتيب الأولويات.", options: [], allowFreeText: true, nextAction: "ask" } };
  }

  if (state.phase !== "factors") return { state, response: factorPrompt(state) };

  const factor = flowDocument.priority_scoring.factors[state.factorIndex]!;
  const allowed = Object.keys(factor.score_guide);
  const numeric = Number(value);
  if (!allowed.includes(String(numeric)) || numeric < 1 || numeric > 5) {
    return { state, response: factorPrompt(state) };
  }
  state.tasks[state.taskIndex]![factor.id] = numeric;
  if (state.factorIndex < 2) {
    state.factorIndex += 1;
    return { state, response: factorPrompt(state) };
  }
  state.tasks[state.taskIndex]!.priorityScore = (state.tasks[state.taskIndex]!.deadline ?? 0) + (state.tasks[state.taskIndex]!.importance ?? 0) + (state.tasks[state.taskIndex]!.impact ?? 0);
  if (state.taskIndex < state.tasks.length - 1) {
    state.taskIndex += 1;
    state.factorIndex = 0;
    return { state, response: factorPrompt(state) };
  }
  for (const task of state.tasks) task.priorityScore ??= 3;
  state.phase = "complete";
  return { state, response: rankOrAskTie(state) };
}
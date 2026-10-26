import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceInteractiveFlow,
  assertFlowAssetsLoaded,
  parseTasks,
  shouldExtractActionableTasks,
  startInteractiveFlow,
  startNewOrganizeConversation,
  type InteractiveState,
} from "./interactive-flow.ts";

function choose(state: InteractiveState, value: string, message = value) {
  return advanceInteractiveFlow(state, { value, message }, "en");
}

function scoreTask(state: InteractiveState, deadline = "5", importance = "4", impact = "3") {
  let result = choose(state, "many_tasks");
  result = choose(result.state, "1_3");
  result = advanceInteractiveFlow(result.state, { message: "Submit report" }, "en");
  result = choose(result.state, deadline);
  result = choose(result.state, importance);
  return choose(result.state, impact);
}

test("loads both JSON assets from source runtime location", () => {
  const loaded = assertFlowAssetsLoaded();
  assert.equal(loaded.knowledgeRecords, 30);
  assert.equal(loaded.flowCount, 5);
});

test("starts a new organize conversation directly at semantic task entry", () => {
  const started = startNewOrganizeConversation("ar");
  assert.equal(started.state.phase, "task_list");
  assert.equal(started.state.branch, "many_tasks");
  assert.deepEqual(started.state.tasks, []);
  assert.equal(started.response.type, "interactive");
  assert.equal(started.response.allowFreeText, true);
});

test("parses newline, bullet, and numbered tasks", () => {
  assert.deepEqual(parseTasks("1. Submit report\n- Send email\n• Organize files"), [
    "Submit report",
    "Send email",
    "Organize files",
  ]);
});

test("splits Arabic tasks on same-line list separators without splitting task words", () => {
  assert.deepEqual(
    parseTasks("إنهاء تقرير المشروع، إرسال البريد الإلكتروني؛ ترتيب ملفات المكتب"),
    ["إنهاء تقرير المشروع", "إرسال البريد الإلكتروني", "ترتيب ملفات المكتب"],
  );
  assert.deepEqual(parseTasks("إنهاء تقرير المشروع"), ["إنهاء تقرير المشروع"]);
});

test("scores three same-line Arabic tasks as separate priorities", () => {
  let result = advanceInteractiveFlow(
    startInteractiveFlow("ar").state,
    { value: "many_tasks", message: "عندي مهام كثيرة" },
    "ar",
  );
  result = advanceInteractiveFlow(result.state, { value: "1_3", message: "١–٣" }, "ar");
  result = advanceInteractiveFlow(
    result.state,
    { message: "إنهاء المشروع، إرسال البريد؛ ترتيب الملفات" },
    "ar",
  );

  assert.deepEqual(result.state.tasks.map((task) => task.task), [
    "إنهاء المشروع",
    "إرسال البريد",
    "ترتيب الملفات",
  ]);

  for (const value of ["5", "5", "5", "4", "4", "3", "2", "2", "2"]) {
    result = advanceInteractiveFlow(result.state, { value, message: value }, "ar");
  }

  assert.equal(result.response.type, "priority_list");
  assert.deepEqual(
    result.state.tasks.map(({ task, priorityScore, priority }) => ({ task, priorityScore, priority })),
    [
      { task: "إنهاء المشروع", priorityScore: 15, priority: 1 },
      { task: "إرسال البريد", priorityScore: 11, priority: 2 },
      { task: "ترتيب الملفات", priorityScore: 6, priority: 3 },
    ],
  );
});

test("scores semantically extracted Arabic tasks without punctuation separators", () => {
  const naturalArabicInput = "عندي هاكثون وأبي أجهز العرض وأرسل السي في وأخلص المشروع";
  let result = advanceInteractiveFlow(
    startInteractiveFlow("ar").state,
    { value: "many_tasks", message: "عندي مهام كثيرة" },
    "ar",
  );
  result = advanceInteractiveFlow(result.state, { value: "1_3", message: "١–٣" }, "ar");
  result = advanceInteractiveFlow(
    result.state,
    {
      message: naturalArabicInput,
      extractedTasks: ["تجهيز العرض", "إرسال السيرة الذاتية", "إنهاء المشروع"],
    },
    "ar",
  );

  assert.deepEqual(
    result.state.tasks.map((task) => task.task),
    ["تجهيز العرض", "إرسال السيرة الذاتية", "إنهاء المشروع"],
  );

  for (const value of ["5", "5", "5", "4", "4", "3", "2", "2", "2"]) {
    result = advanceInteractiveFlow(result.state, { value, message: value }, "ar");
  }

  assert.equal(result.response.type, "priority_list");
  if (result.response.type !== "priority_list") return;
  assert.deepEqual(
    result.response.items.map(({ priority, task }) => ({ priority, task })),
    [
      { priority: 1, task: "تجهيز العرض" },
      { priority: 2, task: "إرسال السيرة الذاتية" },
      { priority: 3, task: "إنهاء المشروع" },
    ],
  );
});

test("upgrades a legacy many-task conversation without resetting its stored input", () => {
  const legacyState: InteractiveState = {
    version: 1,
    branch: "many_tasks",
    stepIndex: 1,
    language: "ar",
    tasks: [{ task: "عندي هاكثون وأبي أجهز العرض وأرسل السي في وأخلص المشروع" }],
    taskIndex: 0,
    factorIndex: 0,
    phase: "factors",
  };
  const naturalArabicInput = "عندي هاكثون وأبي أجهز العرض وأرسل السي في وأخلص المشروع";

  assert.equal(
    shouldExtractActionableTasks(legacyState, { message: naturalArabicInput, hasOption: false }),
    true,
  );
  assert.equal(
    shouldExtractActionableTasks(legacyState, { message: "5", hasOption: false }),
    false,
  );

  const result = advanceInteractiveFlow(
    legacyState,
    {
      message: naturalArabicInput,
      extractedTasks: ["تجهيز العرض", "إرسال السي في", "إنهاء المشروع"],
    },
    "ar",
  );

  assert.equal(result.state.semanticExtractionVersion, 1);
  assert.equal(result.state.phase, "factors");
  assert.deepEqual(
    result.state.tasks.map((task) => task.task),
    ["تجهيز العرض", "إرسال السي في", "إنهاء المشروع"],
  );
  assert.deepEqual(legacyState.tasks, [
    { task: "عندي هاكثون وأبي أجهز العرض وأرسل السي في وأخلص المشروع" },
  ]);
});

test("starts each JSON branch without inventing a task", () => {
  for (const branch of ["many_tasks", "cant_start", "time", "overwhelmed"]) {
    const started = choose(startInteractiveFlow("en").state, branch);
    assert.ok(started.response.type === "interactive");
    assert.equal(started.state.tasks.length, 0);
  }
});

test("time and overwhelmed branches request a real task name before scoring", () => {
  let time = choose(startInteractiveFlow("en").state, "time");
  time = choose(time.state, "deadline");
  assert.equal(time.state.phase, "task_name");
  assert.equal(time.state.tasks.length, 0);
  let overwhelmed = choose(startInteractiveFlow("en").state, "overwhelmed");
  overwhelmed = choose(overwhelmed.state, "work_study");
  overwhelmed = choose(overwhelmed.state, "important");
  assert.equal(overwhelmed.state.phase, "task_name");
  assert.equal(overwhelmed.state.tasks.length, 0);
});

test("offers 5,4,3,2 and accepts free-text score 1", () => {
  const result = scoreTask(startInteractiveFlow("en").state, "1", "4", "3");
  assert.equal(result.state.tasks[0]?.deadline, 1);
  assert.equal(result.state.tasks[0]?.priorityScore, 8);
});

test("invalid factor input repeats the same factor", () => {
  let result = choose(startInteractiveFlow("en").state, "many_tasks");
  result = choose(result.state, "1_3");
  result = advanceInteractiveFlow(result.state, { message: "Submit report" }, "en");
  const invalid = advanceInteractiveFlow(result.state, { message: "not a score" }, "en");
  assert.equal(invalid.state.factorIndex, 0);
  assert.equal(invalid.state.tasks[0]?.deadline, undefined);
});

test("sorts by score and uses deadline as the tie-break", () => {
  let result = choose(startInteractiveFlow("en").state, "many_tasks");
  result = choose(result.state, "1_3");
  result = advanceInteractiveFlow(result.state, { message: "Later task\nToday task" }, "en");
  for (const value of ["4", "4", "3", "5", "3", "3"]) result = choose(result.state, value);
  assert.equal(result.response.type, "priority_list");
  if (result.response.type === "priority_list") assert.equal(result.response.items[0]?.task, "Today task");
});

test("asks once to resolve equal score and deadline ties, then persists the choice in ranking", () => {
  let result = choose(startInteractiveFlow("en").state, "many_tasks");
  result = choose(result.state, "1_3");
  result = advanceInteractiveFlow(result.state, { message: "First task\nSecond task" }, "en");
  for (const value of ["3", "3", "3", "3", "3", "3"]) result = choose(result.state, value);
  assert.equal(result.response.type, "interactive");
  if (result.response.type === "interactive") {
    const selected = result.response.options[1]!;
    result = advanceInteractiveFlow(result.state, { value: selected.value, optionId: selected.id, message: selected.label }, "en");
  }
  assert.equal(result.response.type, "priority_list");
  if (result.response.type === "priority_list") assert.equal(result.response.items[0]?.task, "Second task");
});

test("final template actions start priority one without reopening factor scoring", () => {
  const result = scoreTask(startInteractiveFlow("en").state);
  assert.equal(result.response.type, "priority_list");
  if (result.response.type !== "priority_list") return;
  const startButton = result.response.options.find((option) => option.value === "start_priority_1")!;
  const started = advanceInteractiveFlow(
    result.state,
    { value: startButton.value, optionId: startButton.id, message: startButton.label },
    "en",
  );
  assert.equal(started.response.type, "interactive");
  assert.equal(started.state.factorIndex, 2);
  assert.equal(started.state.phase, "complete");
  if (started.response.type === "interactive") {
    assert.equal(started.response.options.length, 0);
    assert.match(started.response.message, /Next step/);
    assert.doesNotMatch(started.response.message, /score|priority_score|15/);
  }
});

test("final review and edit actions come from the JSON template", () => {
  const result = scoreTask(startInteractiveFlow("en").state);
  assert.equal(result.response.type, "priority_list");
  if (result.response.type !== "priority_list") return;
  const review = result.response.options.find((option) => option.value === "review_priorities")!;
  const reviewed = advanceInteractiveFlow(result.state, { value: review.value, message: review.label }, "en");
  assert.equal(reviewed.response.type, "priority_list");
  const edit = result.response.options.find((option) => option.value === "edit_priorities")!;
  const edited = advanceInteractiveFlow(result.state, { value: edit.value, message: edit.label }, "en");
  assert.equal(edited.response.type, "interactive");
  if (edited.response.type === "interactive") assert.equal(edited.response.options.length, 1);
});

test("edits any ranked task factor and redisplays the full recalculated ranking", () => {
  let result = choose(startInteractiveFlow("en").state, "many_tasks");
  result = choose(result.state, "1_3");
  result = advanceInteractiveFlow(result.state, { message: "First task\nSecond task\nThird task" }, "en");
  for (const value of ["5", "5", "5", "5", "3", "3", "4", "3", "3"]) {
    result = choose(result.state, value);
  }

  assert.equal(result.response.type, "priority_list");
  if (result.response.type !== "priority_list") return;
  const edit = result.response.options.find((option) => option.value === "edit_priorities")!;
  result = advanceInteractiveFlow(result.state, { value: edit.value, message: edit.label }, "en");

  assert.equal(result.response.type, "interactive");
  if (result.response.type !== "interactive") return;
  assert.deepEqual(
    result.response.options.map((option) => option.label),
    ["Priority 1: First task", "Priority 2: Second task", "Priority 3: Third task"],
  );

  const thirdTask = result.response.options[2]!;
  result = advanceInteractiveFlow(
    result.state,
    { value: thirdTask.value, optionId: thirdTask.id, message: thirdTask.label },
    "en",
  );
  assert.equal(result.response.type, "interactive");
  if (result.response.type !== "interactive") return;
  assert.deepEqual(result.response.options.map((option) => option.label), ["Deadline", "Importance", "Impact"]);

  const impact = result.response.options.find((option) => option.label === "Impact")!;
  result = advanceInteractiveFlow(
    result.state,
    { value: impact.value, optionId: impact.id, message: impact.label },
    "en",
  );
  result = advanceInteractiveFlow(result.state, { value: "5", message: "5" }, "en");

  assert.equal(result.response.type, "priority_list");
  if (result.response.type !== "priority_list") return;
  assert.deepEqual(
    result.response.items.map(({ priority, task }) => ({ priority, task })),
    [
      { priority: 1, task: "First task" },
      { priority: 2, task: "Third task" },
      { priority: 3, task: "Second task" },
    ],
  );
  assert.equal(result.response.items.length, 3);
});

const STORAGE_KEY = "daily-task-dashboard-dark-v2";
const DB_NAME = "daily-task-attachments";
const DB_STORE = "files";

const state = {
  tasks: loadTasks(),
  filter: "all",
  editingId: null,
  pendingAttachment: null,
};

const el = {
  todayDate: document.querySelector("#todayDate"),
  tomorrowDate: document.querySelector("#tomorrowDate"),
  headerDate: document.querySelector("#headerDate"),
  pageDate: document.querySelector("#pageDate"),
  taskCount: document.querySelector("#taskCount"),
  lists: {
    emi: document.querySelector("#emiList"),
    tomorrow: document.querySelector("#tomorrowList"),
    due: document.querySelector("#dueList"),
    daily: document.querySelector("#dailyList"),
  },
  empty: {
    emi: document.querySelector("#emiEmpty"),
    tomorrow: document.querySelector("#tomorrowEmpty"),
    due: document.querySelector("#dueEmpty"),
    daily: document.querySelector("#dailyEmpty"),
  },
  dialog: document.querySelector("#taskDialog"),
  form: document.querySelector("#taskForm"),
  taskId: document.querySelector("#taskId"),
  taskName: document.querySelector("#taskName"),
  taskSection: document.querySelector("#taskSection"),
  taskDate: document.querySelector("#taskDate"),
  attachment: document.querySelector("#taskAttachment"),
  attachmentHelp: document.querySelector("#attachmentHelp"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogEyebrow: document.querySelector("#dialogEyebrow"),
  toast: document.querySelector("#toast"),
};

function localDateISO(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function shiftedDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateISO(date);
}

function formatDate(dateString, options = { weekday: "short", month: "short", day: "numeric" }) {
  if (!dateString) return "No date";
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, options).format(new Date(year, month - 1, day));
}

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : seedTasks();
  } catch {
    return seedTasks();
  }
}

function seedTasks() {
  return [
    { id: crypto.randomUUID(), name: "EMI Payment", section: "emi", date: shiftedDate(0), completed: false, attachmentName: null },
    { id: crypto.randomUUID(), name: "EMI Excel Upload", section: "tomorrow", date: shiftedDate(1), completed: false, attachmentName: null },
    { id: crypto.randomUUID(), name: "Upcoming EMI", section: "due", date: shiftedDate(3), completed: false, attachmentName: null },
    { id: crypto.randomUUID(), name: "Review daily reports", section: "daily", date: shiftedDate(0), completed: false, attachmentName: null },
    { id: crypto.randomUUID(), name: "Upload Excel file", section: "daily", date: shiftedDate(0), completed: false, attachmentName: null },
    { id: crypto.randomUUID(), name: "Check pending work", section: "daily", date: shiftedDate(0), completed: false, attachmentName: null },
    { id: crypto.randomUUID(), name: "Update task status", section: "daily", date: shiftedDate(0), completed: false, attachmentName: null },
  ];
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function syncScheduledSections() {
  const today = shiftedDate(0);
  const tomorrow = shiftedDate(1);
  state.tasks.forEach(task => {
    if (task.section === "emi" && task.date !== today) task.section = task.date === tomorrow ? "tomorrow" : "due";
    if (task.section === "tomorrow" && task.date !== tomorrow) task.section = task.date === today ? "emi" : "due";
  });
  saveTasks();
}

function render() {
  syncScheduledSections();
  const today = shiftedDate(0);
  const tomorrow = shiftedDate(1);
  el.todayDate.textContent = formatDate(today, { weekday: "long", month: "short", day: "numeric" });
  el.tomorrowDate.textContent = formatDate(tomorrow, { weekday: "long", month: "short", day: "numeric" });
  el.headerDate.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  el.pageDate.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  ["emi", "tomorrow", "due", "daily"].forEach(section => {
    let tasks = state.tasks.filter(task => task.section === section);
    if (section === "due") tasks.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
    if (section === "daily" && state.filter !== "all") tasks = tasks.filter(task => state.filter === "completed" ? task.completed : !task.completed);
    el.lists[section].replaceChildren(...tasks.map(createTaskRow));
    el.empty[section].style.display = tasks.length ? "none" : "block";
  });

  const dailyTasks = state.tasks.filter(task => task.section === "daily");
  const pending = dailyTasks.filter(task => !task.completed).length;
  el.taskCount.textContent = `${pending} pending · ${dailyTasks.length} total`;
}

function createTaskRow(task) {
  const li = document.createElement("li");
  li.className = "task-item";
  li.dataset.id = task.id;
  if (task.completed) li.classList.add("completed");
  const overdue = task.section === "due" && task.date && task.date < shiftedDate(0) && !task.completed;
  if (overdue) li.classList.add("overdue");

  const checkLabel = document.createElement("label");
  checkLabel.className = "check-control";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", `Mark ${task.name} ${task.completed ? "pending" : "complete"}`);
  checkbox.addEventListener("change", () => toggleTask(task.id));
  const customCheck = document.createElement("span");
  customCheck.className = "custom-check";
  checkLabel.append(checkbox, customCheck);

  const content = document.createElement("div");
  content.className = "task-content";
  const name = document.createElement("span");
  name.className = "task-name";
  name.textContent = task.name;
  const meta = document.createElement("span");
  meta.className = "task-meta";
  if (task.date) {
    const dateText = document.createElement("span");
    dateText.textContent = overdue ? `Overdue · ${formatDate(task.date)}` : formatDate(task.date);
    if (overdue) dateText.className = "overdue-label";
    meta.append(dateText);
  }
  if (task.attachmentName) {
    const fileButton = document.createElement("button");
    fileButton.type = "button";
    fileButton.className = "attachment-link";
    fileButton.textContent = `↧ ${task.attachmentName}`;
    fileButton.addEventListener("click", () => downloadAttachment(task));
    meta.append(fileButton);
  }
  content.append(name);
  if (meta.childNodes.length) content.append(meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(actionButton("Edit", "✎", () => openTaskDialog(task.section, task.id)), actionButton("Delete", "×", () => deleteTask(task.id), true));
  li.append(checkLabel, content, actions);
  return li;
}

function actionButton(label, symbol, handler, danger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `task-action${danger ? " delete-action" : ""}`;
  button.textContent = symbol;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.addEventListener("click", handler);
  return button;
}

function openTaskDialog(section = "daily", id = null) {
  state.editingId = id;
  state.pendingAttachment = null;
  const task = state.tasks.find(item => item.id === id);
  el.form.reset();
  el.taskId.value = id || "";
  el.taskName.value = task?.name || "";
  el.taskSection.value = task?.section || section;
  el.taskDate.value = task?.date || defaultDateForSection(section);
  el.dialogTitle.textContent = task ? "Edit task" : "Add task";
  el.dialogEyebrow.textContent = task ? "UPDATE ITEM" : "NEW ITEM";
  el.attachmentHelp.textContent = task?.attachmentName ? `Current: ${task.attachmentName}` : ".xls or .xlsx · optional";
  el.dialog.showModal();
  requestAnimationFrame(() => el.taskName.focus());
}

function defaultDateForSection(section) {
  if (section === "tomorrow") return shiftedDate(1);
  if (section === "due") return shiftedDate(7);
  return shiftedDate(0);
}

function closeTaskDialog() {
  el.dialog.close();
  state.pendingAttachment = null;
}

async function submitTask(event) {
  event.preventDefault();
  const name = el.taskName.value.trim();
  if (!name) return;
  const existing = state.tasks.find(task => task.id === state.editingId);
  const id = existing?.id || crypto.randomUUID();
  const file = el.attachment.files[0];
  const task = {
    id,
    name,
    section: el.taskSection.value,
    date: el.taskDate.value || defaultDateForSection(el.taskSection.value),
    completed: existing?.completed || false,
    attachmentName: file?.name || existing?.attachmentName || null,
  };

  if (existing) Object.assign(existing, task);
  else state.tasks.push(task);
  if (file) await putAttachment(id, file);
  saveTasks();
  closeTaskDialog();
  render();
  showToast(existing ? "Task updated" : "Task added");
}

function toggleTask(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  render();
}

async function deleteTask(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task || !confirm(`Delete “${task.name}”?`)) return;
  state.tasks = state.tasks.filter(item => item.id !== id);
  saveTasks();
  await deleteAttachment(id);
  render();
  showToast("Task deleted");
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.toast.classList.remove("show"), 1800);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, mode);
    const request = operation(transaction.objectStore(DB_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

function putAttachment(id, file) { return withStore("readwrite", store => store.put(file, id)); }
function deleteAttachment(id) { return withStore("readwrite", store => store.delete(id)).catch(() => {}); }

async function downloadAttachment(task) {
  try {
    const file = await withStore("readonly", store => store.get(task.id));
    if (!file) throw new Error("Missing file");
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = task.attachmentName || "attachment.xlsx";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    showToast("Attachment could not be found");
  }
}

document.querySelectorAll("[data-add]").forEach(button => button.addEventListener("click", () => openTaskDialog(button.dataset.add)));
document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
  state.filter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach(item => item.classList.toggle("active", item === button));
  render();
}));
el.taskSection.addEventListener("change", () => { if (!state.editingId) el.taskDate.value = defaultDateForSection(el.taskSection.value); });
el.attachment.addEventListener("change", () => { el.attachmentHelp.textContent = el.attachment.files[0]?.name || ".xls or .xlsx · optional"; });
el.form.addEventListener("submit", submitTask);
document.querySelector("#closeDialog").addEventListener("click", closeTaskDialog);
document.querySelector("#cancelDialog").addEventListener("click", closeTaskDialog);
el.dialog.addEventListener("click", event => { if (event.target === el.dialog) closeTaskDialog(); });

render();


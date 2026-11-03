import { workWords } from './data.js';

export const MAX_ACTIVITY_ENTRIES = 3650;
export const MAX_WORKSPACE_TASKS = 100;
export const MAX_TASK_TEXT_LENGTH = 120;
const dayPattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const activityTypePriority = { edit: 1, create: 2, import: 3 };
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });

function validDay(value) {
  if (typeof value !== 'string' || !dayPattern.test(value) || value.startsWith('0000-')) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Explicit dates only; never infer dates from human labels such as "刚刚". */
export function toActivityDate(value) {
  if (validDay(value)) return value;
  if (typeof value !== 'string' || !timestampPattern.test(value) || !validDay(value.slice(0, 10))) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const parts = Object.fromEntries(dayFormatter.formatToParts(parsed).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function activeWorkspaceWorks(works = []) {
  return (Array.isArray(works) ? works : []).filter(work => work && typeof work === 'object' && !work.deletedAt);
}

/** Snapshot totals, not historical/monthly writing production. */
export function workspaceSnapshotStats(works = []) {
  const active = activeWorkspaceWorks(works);
  return active.reduce((stats, work) => {
    const chapters = (Array.isArray(work.chapters) ? work.chapters : []).filter(chapter => chapter && !chapter.deletedAt);
    stats.works += 1;
    stats.chapters += chapters.length;
    stats.words += workWords({ chapters: chapters.map(chapter => ({ text: typeof chapter.text === 'string' ? chapter.text : '' })) });
    return stats;
  }, { works: 0, chapters: 0, words: 0 });
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.workId !== 'string' || !entry.workId || entry.workId.length > 200) return null;
  const at = entry.at ?? entry.date;
  const date = toActivityDate(at);
  const type = entry.type ?? 'edit';
  if (!date || !Object.hasOwn(activityTypePriority, type)) return null;
  // One daily marker per work. Repeated saves update its time
  // without pretending keystrokes represent additional writing days or words.
  const id = `activity:${encodeURIComponent(entry.workId)}:${date}`;
  return { id, workId: entry.workId, at: validDay(at) ? at : new Date(at).toISOString(), type };
}

/** Pure: callers supply the actual timestamp only after a real work mutation. */
export function recordWorkspaceActivity(previous = [], entry) {
  const incoming = normalizeEntry(entry);
  if (!incoming) return Array.isArray(previous) ? previous : [];
  const byId = new Map();
  for (const candidate of [...(Array.isArray(previous) ? previous : []), incoming]) {
    const normalized = normalizeEntry(candidate);
    if (!normalized) continue;
    const existing = byId.get(normalized.id);
    if (!existing) byId.set(normalized.id, normalized);
    else {
      const latest = normalized.at >= existing.at ? normalized : existing;
      const type = activityTypePriority[normalized.type] > activityTypePriority[existing.type] ? normalized.type : existing.type;
      byId.set(normalized.id, { ...latest, type });
    }
  }
  return [...byId.values()].sort((left, right) => right.at.localeCompare(left.at) || left.id.localeCompare(right.id)).slice(0, MAX_ACTIVITY_ENTRIES);
}

/** Recorded activity and known work dates remain distinguishable in the UI. */
export function buildWorkspaceActivityDays(works = [], activity = []) {
  const active = activeWorkspaceWorks(works);
  const workIds = new Set(active.map(work => work.id).filter(id => typeof id === 'string'));
  const days = new Map();
  const row = date => {
    if (!days.has(date)) days.set(date, { date, recorded: new Set(), known: new Set() });
    return days.get(date);
  };
  for (const entry of Array.isArray(activity) ? activity : []) {
    const normalized = normalizeEntry(entry);
    if (normalized && workIds.has(normalized.workId)) row(toActivityDate(normalized.at)).recorded.add(normalized.workId);
  }
  for (const work of active) {
    if (typeof work.id !== 'string') continue;
    for (const value of [work.createdAt, work.updatedAt]) {
      const date = toActivityDate(value);
      if (date && !row(date).recorded.has(work.id)) row(date).known.add(work.id);
    }
  }
  return [...days.values()].map(day => ({
    date: day.date,
    recordedWorks: day.recorded.size,
    knownWorks: day.known.size,
    totalWorks: new Set([...day.recorded, ...day.known]).size,
  })).sort((left, right) => left.date.localeCompare(right.date));
}

function monthParts(month) {
  if (typeof month !== 'string' || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || month.startsWith('0000-')) throw new TypeError('A calendar month must use YYYY-MM.');
  return month.split('-').map(Number);
}

export function shiftWorkspaceMonth(month, offset) {
  const [year, number] = monthParts(month);
  if (!Number.isInteger(offset)) throw new TypeError('Month offset must be an integer.');
  const absolute = year * 12 + number - 1 + offset;
  if (absolute < 12 || absolute >= 10_000 * 12) return month;
  return `${String(Math.floor(absolute / 12)).padStart(4, '0')}-${String(absolute % 12 + 1).padStart(2, '0')}`;
}

/** Monday-first month grid. Empty cells have no dates and no activity. */
export function workspaceCalendarCells(month, activityDays = []) {
  monthParts(month);
  const first = new Date(`${month}-01T12:00:00Z`);
  const leading = (first.getUTCDay() + 6) % 7;
  const end = new Date(first);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  const byDate = new Map((Array.isArray(activityDays) ? activityDays : []).map(day => [day.date, day]));
  return Array.from({ length: 42 }, (_, index) => {
    const number = index - leading + 1;
    if (number < 1 || number > end.getUTCDate()) return null;
    const date = `${month}-${String(number).padStart(2, '0')}`;
    const activity = byDate.get(date);
    return { date, day: number, recordedWorks: activity?.recordedWorks || 0, knownWorks: activity?.knownWorks || 0 };
  });
}

export function normalizeWorkspaceTasks(tasks = []) {
  const seen = new Set();
  return (Array.isArray(tasks) ? tasks : []).filter(task => {
    if (!task || typeof task.id !== 'string' || !task.id || seen.has(task.id) || typeof task.text !== 'string' || !task.text.trim() || task.text.trim().length > MAX_TASK_TEXT_LENGTH) return false;
    seen.add(task.id);
    return true;
  }).slice(0, MAX_WORKSPACE_TASKS).map(task => ({ ...task, text: task.text.trim(), done: task.done === true }));
}

import { ack, fetchIncidents } from './api.js?v=a2cc839';

const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const list = document.querySelector('[data-testid="incident-list"]');
const error = document.querySelector('[data-testid="error"]');
const confirmBox = document.querySelector('[data-testid="confirm"]');
const confirmText = confirmBox.querySelector('.confirm-text');
const confirmAck = document.querySelector('[data-testid="confirm-ack"]');
const confirmCancel = document.querySelector('[data-testid="confirm-cancel"]');
const ackedIds = new Set();
const pendingIds = new Set();
let confirmingId = null;

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'short',
  timeStyle: 'medium',
});

// Rows are keyed by incident id and kept in the DOM: a refresh only inserts new rows and updates the
// action cell in place. It never removes or rebuilds an existing row (R1 without losing what on-call sees).
const rowsById = new Map();

function createRow(incident) {
  const row = document.createElement('li');
  row.dataset.testid = 'incident-row';
  row.dataset.id = incident.id;
  row.className = `row ${incident.severity}`;

  const id = document.createElement('span');
  id.className = 'id';
  id.textContent = incident.id;

  const severity = document.createElement('span');
  severity.className = 'sev';
  severity.textContent = incident.severity;

  const summary = document.createElement('span');
  summary.className = 'what';
  summary.textContent = `${incident.service} · ${incident.region} · ${incident.summary}`;

  const time = document.createElement('time');
  time.dateTime = incident.openedAt;
  time.textContent = timeFormatter.format(new Date(incident.openedAt));

  const action = document.createElement('span');
  action.className = 'action';

  row.append(id, severity, summary, time, action);
  return row;
}

function updateAction(row, incidentId) {
  const action = row.querySelector('.action');
  const state = ackedIds.has(incidentId) ? 'acked' : pendingIds.has(incidentId) ? 'pending' : 'ready';
  if (action.dataset.state === state) return;
  action.dataset.state = state;
  if (state === 'acked') {
    const mark = document.createElement('span');
    mark.dataset.testid = 'acked';
    mark.className = 'acked';
    mark.textContent = 'Acked';
    action.replaceChildren(mark);
    return;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.testid = 'ack';
  button.dataset.id = incidentId;
  button.textContent = state === 'pending' ? 'Acking…' : 'Ack';
  button.disabled = state === 'pending';
  button.addEventListener('click', () => askToConfirm(incidentId));
  action.replaceChildren(button);
}

function render(incidents) {
  const newestFirst = [...incidents].sort(
    (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
  );
  let cursor = list.firstElementChild;
  for (const incident of newestFirst) {
    let row = rowsById.get(incident.id);
    if (!row) {
      row = createRow(incident);
      rowsById.set(incident.id, row);
      list.insertBefore(row, cursor);
    } else if (row === cursor) {
      cursor = cursor.nextElementSibling;
    }
    updateAction(row, incident.id);
  }
  empty.hidden = newestFirst.length > 0;
}

// Product decision (SCHED-4515): Ack asks to confirm, and the confirm names the incident id.
// The id is pinned when the confirm opens, so later refreshes that move rows cannot change it.
function askToConfirm(id) {
  confirmingId = id;
  confirmBox.dataset.id = id;
  confirmText.textContent = `Ack ${id}?`;
  confirmBox.hidden = false;
  confirmAck.focus();
}

function closeConfirm() {
  confirmingId = null;
  delete confirmBox.dataset.id;
  confirmBox.hidden = true;
}

confirmAck.addEventListener('click', () => {
  const id = confirmingId;
  closeConfirm();
  if (id) ackIncident(id);
});
confirmCancel.addEventListener('click', closeConfirm);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !confirmBox.hidden) closeConfirm();
});

async function ackIncident(id) {
  pendingIds.add(id);
  render(currentIncidents);
  try {
    await ack(id);
    ackedIds.add(id);
    error.hidden = true;
  } catch (cause) {
    error.textContent = `Could not acknowledge ${id}. ${cause.message}`;
    error.hidden = false;
  } finally {
    pendingIds.delete(id);
    render(currentIncidents);
  }
}

let currentIncidents = [];
let firstLoad = true;
let refreshInFlight = false;

function mergeIncidents(current, incoming) {
  const byId = new Map(current.map((incident) => [incident.id, incident]));
  for (const incident of incoming) byId.set(incident.id, incident);
  return [...byId.values()];
}

async function refresh() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    const page = await fetchIncidents();
    currentIncidents = mergeIncidents(currentIncidents, page.incidents);
    render(currentIncidents);
    error.hidden = true;
  } catch (cause) {
    error.textContent = `Could not refresh incidents. ${cause.message}`;
    error.hidden = false;
  } finally {
    if (firstLoad) {
      firstLoad = false;
      loader.hidden = true;
    }
    refreshInFlight = false;
  }
}

await refresh();
setInterval(refresh, 2_000);

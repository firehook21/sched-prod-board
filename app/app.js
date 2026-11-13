import { ack, fetchIncidents } from './api.js';

const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const list = document.querySelector('[data-testid="incident-list"]');
const error = document.querySelector('[data-testid="error"]');
const ackedIds = new Set();
const pendingIds = new Set();

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'short',
  timeStyle: 'medium',
});

function incidentRow(incident) {
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
  if (ackedIds.has(incident.id)) {
    const mark = document.createElement('span');
    mark.dataset.testid = 'acked';
    mark.className = 'acked';
    mark.textContent = 'Acked';
    action.append(mark);
  } else {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.testid = 'ack';
    button.textContent = pendingIds.has(incident.id) ? 'Acking…' : 'Ack';
    button.disabled = pendingIds.has(incident.id);
    button.addEventListener('click', () => ackIncident(incident.id));
    action.append(button);
  }

  row.append(id, severity, summary, time, action);
  return row;
}

function render(incidents) {
  const newestFirst = [...incidents].sort(
    (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
  );
  list.replaceChildren(...newestFirst.map(incidentRow));
  empty.hidden = newestFirst.length > 0;
}

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

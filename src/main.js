import './style.css';
import { stageCodes } from './stages.js';

const screen = document.querySelector('.exhibition');
const stages = [...document.querySelectorAll('.stage')];
const announcement = document.querySelector('#stage-announcement');
const connected = screen.dataset.stageEndpoint === 'true';
let busy = false;
let ready = !connected;

requestAnimationFrame(() => requestAnimationFrame(() => screen.classList.add('is-ready')));

function select(stage) {
  for (const card of stages) card.setAttribute('aria-pressed', String(card === stage));
  if (stage) announcement.textContent = `${stage.querySelector('.stage-name').textContent} selected. ${stage.querySelector('.plan').innerText.replace(/\n/g, '. ')}.`;
}

function pending(value, target = null) {
  busy = value;
  screen.setAttribute('aria-busy', String(value));
  const initial = value && !ready && !target;
  announcement.classList.toggle('sr-only', !initial);
  announcement.classList.toggle('loading-status', initial);
  if (initial) announcement.textContent = 'Loading current stage…';
  if (value && target) announcement.textContent = `Updating ${target.querySelector('.stage-name').textContent}…`;
  for (const card of stages) {
    const updating = value && card === target;
    card.disabled = value || !ready;
    card.classList.toggle('is-updating', updating);
    card.setAttribute('aria-busy', String(updating));
    card.querySelector('.current-stage').textContent = updating ? 'Updating…' : 'Current Stage';
  }
}

async function request(method = 'GET', stage) {
  const reply = await fetch('/api/exhibition/' + (method === 'GET' ? 'state' : 'stage'), {
    method, cache: 'no-store', signal: AbortSignal.timeout(15000),
    ...(stage && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_code: stage }) }),
  });
  const data = await reply.json();
  if (!reply.ok) throw new Error(data.error ?? 'The backend could not confirm the stage.');
  const selected = stages.find(card => stageCodes[card.dataset.stage] === data.stage_code);
  if (!selected) throw new Error('The backend returned an unsupported crop stage.');
  ready = true;
  select(selected);
}

async function refresh(notify = false) {
  if (busy || document.hidden) return;
  pending(true);
  try { await request(); }
  catch (error) {
    ready = false;
    select(null);
    announcement.textContent = error.message;
    if (notify) window.alert(error.message);
  } finally { pending(false); }
}

for (const stage of stages) {
  stage.addEventListener('click', async () => {
    if (busy || !ready || stage.getAttribute('aria-pressed') === 'true') return;
    if (!connected) return select(stage);
    pending(true, stage);
    try { await request('PATCH', stageCodes[stage.dataset.stage]); }
    catch (error) {
      // A lost response can follow a saved change; reload authoritative state.
      try { await request(); }
      catch { ready = false; select(null); }
      window.alert(error.message);
    } finally { pending(false); }
  });
}

if (connected) {
  select(null);
  refresh(true);
  setInterval(() => refresh(), 5000);
  document.addEventListener('visibilitychange', () => refresh());
}

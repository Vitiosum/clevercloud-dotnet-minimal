// Kestrel jukebox: each side of each record is a route of Program.cs.
// Pressing a key fetches the route and shows the real HTTP answer: status, headers, body.
'use strict';

// The catalogue. Letters skip I, as on the old jukeboxes.
const RECORDS = [
  { letter: 'A', title: 'Hello, World!', sides: [
    { path: '/plaintext', feature: 'A string becomes text/plain',
      code: 'string Plaintext() => "Hello, World!";\napp.MapGet("/plaintext", Plaintext);' },
    { path: '/json', feature: 'An object becomes JSON',
      code: 'object Json() => new { message = "Hello, World!" };\napp.MapGet("/json", Json).WithTags("json");' },
  ] },
  { letter: 'B', title: 'Who is playing', sides: [
    { path: '/hello/{name}', feature: 'A route parameter, from the dedication card',
      code: 'string SayHello(string name) => $"Hello, {name}!";\napp.MapGet("/hello/{name}", SayHello);' },
    { path: '/env', feature: 'The original home route: the machine that plays',
      code: 'app.MapGet("/env", () => $"""\n    Operating System: {Environment.OSVersion}\n    .NET version: {Environment.Version}\n    Username: {Environment.UserName}\n    Date and Time: {DateTime.Now}\n    """);' },
  ] },
  { letter: 'C', title: 'Route groups', sides: [
    { path: '/outer/outerget', feature: 'MapGroup: a route inside a group',
      code: 'var outer = app.MapGroup("/outer");\nouter.MapGet("/outerget", () => "I\'m nested.");' },
    { path: '/outer/inner/innerget', feature: 'Two endpoint filters wrap the answer',
      code: 'var inner = outer.MapGroup("/inner");\ninner.AddEndpointFilterFactory(…); // "| /inner filter! Tags: …"\ninner.AddEndpointFilterFactory(…); // "| nested filter!"\ninner.MapGet("/innerget", () => "I\'m more nested.");' },
  ] },
  { letter: 'D', title: 'Deep groups, tags', sides: [
    { path: '/outer/inner/group/jukebox/nested/a-side', label: '/outer/…/nested/a-side', feature: 'Four group levels, two route parameters, three tags',
      code: 'var superNested = inner.MapGroup("/group/{groupName}")\n   .MapGroup("/nested/{nestedName}")\n   .WithTags("nested", "more", "tags");\nsuperNested.MapGet("/", (string groupName, string nestedName) =>\n    $"Hello from {groupName}:{nestedName}!");' },
    { path: '/outer/inner/group/clever/nested/cloud', label: '/outer/…/nested/cloud', feature: 'Same route, other parameters',
      code: 'superNested.MapGet("/", (string groupName, string nestedName) =>\n    $"Hello from {groupName}:{nestedName}!");' },
  ] },
  { letter: 'E', title: 'Typed results', sides: [
    { path: '/todo/3', feature: 'Results<Ok<Todo>, NotFound, BadRequest>: 1 to 10 is Ok',
      code: 'app.MapGet("/todo/{id}", Results<Ok<Todo>, NotFound, BadRequest> (int id) => id switch\n{\n    <= 0 => TypedResults.BadRequest(),\n    >= 1 and <= 10 => TypedResults.Ok(new Todo(id, "Walk the dog")),\n    _ => TypedResults.NotFound()\n});' },
    { path: '/todo/0', feature: 'Same handler: 0 or less is BadRequest',
      code: '<= 0 => TypedResults.BadRequest(),' },
  ] },
  { letter: 'F', title: 'Off the charts', sides: [
    { path: '/todo/42', feature: 'Same handler: above 10 is NotFound',
      code: '_ => TypedResults.NotFound()' },
    { path: '/null-result', feature: 'A handler that returns null: the server answers 500',
      code: 'app.MapGet("/null-result", IResult () => null!);' },
  ] },
  { letter: 'G', title: 'Two verbs, one path', sides: [
    { path: '/todos', feature: 'An array becomes a JSON list',
      code: 'app.MapGet("/todos", () => new Todo[] { new Todo(1, "Walk the dog"), new Todo(2, "Come back home") });' },
    { path: '/todos', method: 'POST', body: '{"id":7,"title":"Play it again"}', feature: 'IBindableFromHttpContext: the type binds itself, whatever the body',
      code: 'app.MapPost("/todos", (TodoBindable todo) => todo);\n\npublic static ValueTask<TodoBindable?> BindAsync(HttpContext context, ParameterInfo parameter)\n    => ValueTask.FromResult<TodoBindable?>(new TodoBindable { Id = 1, Title = "I was bound from …" });' },
  ] },
  { letter: 'H', title: 'Problem Details', sides: [
    { path: '/problem/plain', feature: 'Results.Problem with extensions',
      code: '"plain" => Results.Problem(statusCode: 500, extensions: extensions),' },
    { path: '/problem/object', feature: 'Results.Problem from a ProblemDetails object',
      code: '"object" => Results.Problem(new ProblemDetails() { Status = 500, Extensions = { { "traceId", "traceId123" } } }),' },
  ] },
  { letter: 'J', title: 'Validation', sides: [
    { path: '/problem/validation', feature: 'Results.ValidationProblem: field errors, 400',
      code: '"validation" => Results.ValidationProblem(errors, statusCode: 400, extensions: extensions),' },
    { path: '/problem/objectValidation', feature: 'Results.Problem from HttpValidationProblemDetails',
      code: '"objectValidation" => Results.Problem(new HttpValidationProblemDetails(errors) { Status = 400, Extensions = { { "traceId", "traceId123" } } }),' },
  ] },
  { letter: 'K', title: 'Typed validation', sides: [
    { path: '/problem/validationTyped', feature: 'TypedResults.ValidationProblem',
      code: '"validationTyped" => TypedResults.ValidationProblem(errors, extensions: extensions),' },
    { path: '/problem/encore', feature: 'Any other problem type: 404',
      code: '_ => TypedResults.NotFound()' },
  ] },
];

const REASONS = { 200: 'OK', 400: 'Bad Request', 404: 'Not Found', 405: 'Method Not Allowed', 500: 'Internal Server Error' };
const SHOWN_HEADERS = ['content-type', 'content-length', 'server'];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : ms));

const jukebox = $('jukebox');
const readout = $('readout');
const dedication = $('dedication-name');
const selections = new Map(); // "E2" -> { record, side, button }
let playToken = 0;
let endTimer = 0;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value; else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

function dedicatedName() {
  const name = dedication.value.trim();
  return name === '' ? 'Clever' : name;
}

function sideLabel(side) {
  if (side.path === '/hello/{name}') return '/hello/' + dedicatedName();
  return side.label || side.path;
}

function sideUrl(side) {
  if (side.path === '/hello/{name}') return '/hello/' + encodeURIComponent(dedicatedName());
  return side.path;
}

// Title strips: one strip per record, its two sides are the selection keys.
function buildStrips() {
  const strips = $('strips');
  for (const record of RECORDS) {
    const strip = el('div', { class: 'strip' });
    record.sides.forEach((side, i) => {
      const code = record.letter + (i + 1);
      const button = el('button', { class: 'strip__side', type: 'button', 'data-code': code },
        el('span', { class: 'strip__code' }, code),
        el('span', { class: 'strip__path' }, (side.method === 'POST' ? 'POST ' : '') + sideLabel(side)));
      button.setAttribute('aria-label', `${code}: ${side.method || 'GET'} ${sideLabel(side)}`);
      button.addEventListener('click', () => play(code));
      selections.set(code, { record, side, button });
      strip.append(button);
      if (i === 0) strip.append(el('span', { class: 'strip__title' }, record.title));
    });
    strips.append(strip);
  }
}

// The record stack inside the dome, drawn once.
function buildStack() {
  const ns = 'http://www.w3.org/2000/svg';
  const stack = $('stack');
  RECORDS.forEach((record, i) => {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'stack__record');
    g.setAttribute('data-letter', record.letter);
    const x = 130 + i * 12;
    const body = document.createElementNS(ns, 'rect');
    Object.entries({ x, y: 128, width: 8, height: 90, rx: 4, fill: '#15121d', stroke: '#3a3450' }).forEach(([k, v]) => body.setAttribute(k, v));
    const label = document.createElementNS(ns, 'rect');
    Object.entries({ x: x + 1, y: 158, width: 6, height: 30, rx: 2, class: 'stack__label' }).forEach(([k, v]) => label.setAttribute(k, v));
    const letter = document.createElementNS(ns, 'text');
    Object.entries({ x: x + 4, y: 231, 'text-anchor': 'middle', class: 'stack__letter' }).forEach(([k, v]) => letter.setAttribute(k, v));
    letter.textContent = record.letter;
    g.append(body, label, letter);
    stack.append(g);
  });
}

function lampFor(status) {
  if (status >= 500) return '500';
  if (status === 404) return '404';
  if (status >= 400) return '400';
  return '200';
}

function setMarquee(code, text) {
  const marquee = $('marquee');
  marquee.replaceChildren(el('span', { class: 'marquee__code' }, code), el('span', { class: 'marquee__text' }, text));
}

function prettyBody(text, type) {
  if (text === '') return '(empty body)';
  if (type.includes('json')) {
    try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
  }
  return text;
}

async function callRoute(side) {
  const init = { method: side.method || 'GET', cache: 'no-store', headers: {} };
  if (side.body) { init.body = side.body; init.headers['Content-Type'] = 'application/json'; }
  const started = performance.now();
  try {
    const response = await fetch(sideUrl(side), init);
    const text = await response.text();
    return { ok: true, response, text, ms: Math.round(performance.now() - started) };
  } catch (error) {
    return { ok: false, error, ms: Math.round(performance.now() - started) };
  }
}

async function play(code) {
  const selection = selections.get(code);
  if (!selection) return;
  const { record, side, button } = selection;
  const token = ++playToken;
  clearTimeout(endTimer);

  for (const s of selections.values()) s.button.classList.toggle('is-selected', s.button === button);
  for (const r of document.querySelectorAll('.stack__record')) r.classList.toggle('is-out', r.dataset.letter === record.letter);
  const method = side.method || 'GET';
  setMarquee(code, `${method} ${sideLabel(side)}`);

  // The arm lifts, the record goes back, the new one comes out of the stack.
  const answer = callRoute(side);
  jukebox.dataset.phase = 'changing';
  await wait(jukebox.dataset.wasPlaying === 'yes' ? 420 : 120);
  if (token !== playToken) return;
  $('disc-code').textContent = code;
  $('disc-path').textContent = sideLabel(side).length > 16 ? sideLabel(side).slice(0, 15) + '…' : sideLabel(side);
  $('disc-label').setAttribute('fill', code.endsWith('1') ? 'url(#label-a)' : 'url(#label-b)');
  jukebox.dataset.side = code.endsWith('1') ? 'a' : 'b';
  jukebox.dataset.phase = 'loading';
  await wait(650);
  if (token !== playToken) return;
  jukebox.dataset.phase = 'playing';
  jukebox.dataset.wasPlaying = 'yes';

  const result = await answer;
  if (token !== playToken) return;
  render(code, record, side, result);

  // A side lasts thirty seconds, then the arm goes back to its rest.
  endTimer = setTimeout(() => {
    jukebox.dataset.phase = 'idle';
    jukebox.dataset.wasPlaying = 'no';
    for (const r of document.querySelectorAll('.stack__record')) r.classList.remove('is-out');
  }, 30000);
}

function render(code, record, side, result) {
  const method = side.method || 'GET';
  $('r-idle').hidden = true;
  $('r-live').hidden = false;
  $('r-code').textContent = code;
  $('r-verb').textContent = method;
  const path = $('r-path');
  path.textContent = sideUrl(side);
  if (method === 'GET') path.href = sideUrl(side); else path.removeAttribute('href');
  $('r-feature').textContent = `${record.title}: ${side.feature}`;
  $('r-csharp').textContent = side.code;
  $('r-sent-wrap').hidden = !side.body;
  $('r-sent').textContent = side.body || '';

  const headers = $('r-headers');
  headers.replaceChildren();
  if (!result.ok) {
    jukebox.dataset.status = readout.dataset.status = 'error';
    $('r-status').textContent = '---';
    $('r-reason').textContent = 'No answer';
    $('r-body').textContent = `The request did not reach the server (${result.error.message}). Check the network, then press the key again.`;
    setMarquee(code, `${method} ${sideLabel(side)}: no answer`);
    return;
  }

  const { response, text, ms } = result;
  const lamp = lampFor(response.status);
  const kind = { 200: 'ok', 400: 'bad', 404: 'missing', 500: 'error' }[lamp];
  jukebox.dataset.status = readout.dataset.status = kind;
  for (const li of document.querySelectorAll('.lamp')) li.classList.toggle('is-on', li.dataset.lamp === lamp);

  $('r-status').textContent = response.status;
  $('r-reason').textContent = response.statusText || REASONS[response.status] || '';
  const type = response.headers.get('content-type') || '';
  const rows = [['Content-Type', type || '(none)']];
  for (const name of SHOWN_HEADERS.slice(1)) {
    const value = response.headers.get(name);
    if (value) rows.push([name === 'server' ? 'Server' : 'Content-Length', value]);
  }
  rows.push(['Round trip', `${ms} ms`]);
  for (const [name, value] of rows) headers.append(el('div', {}, el('dt', {}, name), el('dd', {}, value)));
  $('r-body').textContent = prettyBody(text, type);
  setMarquee(code, `${method} ${sideLabel(side)}`);
  $('marquee').append(el('span', { class: 'marquee__status' }, String(response.status)));
}

// Keyboard: a letter then a digit plays the selection, as on the jukebox keypad.
let pendingLetter = '';
let pendingTimer = 0;
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toUpperCase();
  if (/^[A-K]$/.test(key) && key !== 'I') {
    pendingLetter = key;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pendingLetter = ''; }, 1500);
  } else if ((key === '1' || key === '2') && pendingLetter) {
    play(pendingLetter + key);
    pendingLetter = '';
  }
});

$('dedication').addEventListener('submit', (event) => {
  event.preventDefault();
  play('B1');
});
dedication.addEventListener('input', () => {
  const { side, button } = selections.get('B1');
  button.querySelector('.strip__path').textContent = sideLabel(side);
  button.setAttribute('aria-label', `B1: GET ${sideLabel(side)}`);
});

// Serial plate: the four lines of GET /env, as the server wrote them.
async function loadSerial() {
  const plate = $('serial');
  try {
    const text = await (await fetch('/env', { cache: 'no-store' })).text();
    plate.replaceChildren();
    for (const line of text.split('\n')) {
      const at = line.indexOf(': ');
      if (at > 0) plate.append(el('div', {}, el('dt', {}, line.slice(0, at)), el('dd', {}, line.slice(at + 2))));
    }
  } catch {
    plate.replaceChildren(el('div', {}, el('dt', {}, 'Serial plate'), el('dd', {}, 'GET /env did not answer')));
  }
}

// Platform card: the seven variables of GET /platform, or "Local" off Clever Cloud.
async function loadPlatform() {
  let vars = {};
  try { vars = await (await fetch('/platform', { cache: 'no-store' })).json(); } catch { /* shown as local */ }
  const onClever = Boolean(vars.APP_ID || vars.CC_APP_NAME);
  for (const dd of document.querySelectorAll('#platform-kv dd')) {
    let value = vars[dd.dataset.var] || '';
    if (dd.dataset.var === 'CC_COMMIT_ID' && value) value = value.slice(0, 7);
    dd.textContent = value || (onClever ? 'not set' : 'Local');
    dd.classList.toggle('is-empty', !value);
  }
  $('instance-text').textContent = onClever ? `Instance ${vars.INSTANCE_NUMBER ?? '0'}` : 'Local';
  $('live-text').textContent = onClever ? 'Live on Clever Cloud' : 'Running locally';
}

buildStrips();
buildStack();
loadSerial();
loadPlatform();

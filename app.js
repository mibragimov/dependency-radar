const analyzeBtn = document.getElementById('analyzeBtn');
const loadSampleBtn = document.getElementById('loadSampleBtn');
const pkgJsonEl = document.getElementById('pkgJson');
const rowsEl = document.getElementById('rows');
const resultsEl = document.getElementById('results');
const metaEl = document.getElementById('meta');
const saveSnapshotBtn = document.getElementById('saveSnapshotBtn');
const snapshotNameEl = document.getElementById('snapshotName');
const snapshotsEl = document.getElementById('snapshots');

const KEY = 'dependency-radar-snapshots-v1';

function loadSample() {
  pkgJsonEl.value = JSON.stringify({
    dependencies: {
      react: '^18.2.0',
      axios: '^1.6.0',
      express: '^4.18.0'
    },
    devDependencies: {
      vite: '^5.0.0',
      eslint: '^8.50.0'
    }
  }, null, 2);
}

function parseSemver(raw) {
  if (!raw) return null;
  const clean = String(raw).replace(/^[^\d]*/, '').split('-')[0];
  const parts = clean.split('.').map(n => Number(n));
  if (parts.some(Number.isNaN)) return null;
  return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0, raw: clean };
}

function semverDelta(current, latest) {
  const c = parseSemver(current);
  const l = parseSemver(latest);
  if (!c || !l) return 'unknown';
  if (l.major > c.major) return 'major';
  if (l.minor > c.minor) return 'minor';
  if (l.patch > c.patch) return 'patch';
  return 'up-to-date';
}

function parseRepoUrl(repo) {
  if (!repo) return null;
  const url = typeof repo === 'string' ? repo : repo.url;
  if (!url) return null;
  const normalized = url.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://');
  const m = normalized.match(/github\.com[/:]([^/]+)\/([^/]+)/i);
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}

function scoreRisk(delta, releaseText) {
  const t = releaseText.toLowerCase();
  let points = 0;
  if (delta === 'major') points += 2;
  if (delta === 'minor') points += 1;
  ['breaking', 'deprecated', 'migration', 'security', 'removed'].forEach(word => {
    if (t.includes(word)) points += 1;
  });

  if (points >= 4) return 'high';
  if (points >= 2) return 'medium';
  return 'low';
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchNpmMeta(pkg) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(pkg)}`;
  const data = await fetchJson(url);
  return {
    latest: data['dist-tags']?.latest,
    repo: parseRepoUrl(data.repository),
    homepage: data.homepage || data.bugs?.url || null
  };
}

async function fetchGithubReleaseClues(repo) {
  if (!repo) return { clues: ['No GitHub repo found'], text: '' };
  try {
    const releases = await fetchJson(`https://api.github.com/repos/${repo}/releases?per_page=5`);
    const text = releases
      .map(r => `${r.name || ''}\n${r.body || ''}`)
      .join('\n')
      .slice(0, 12000);

    const clues = ['breaking', 'migration', 'deprecated', 'security', 'removed']
      .filter(k => text.toLowerCase().includes(k))
      .map(k => `mentions "${k}"`);

    return {
      clues: clues.length ? clues : ['No risky keywords in latest releases'],
      text
    };
  } catch {
    return { clues: ['Could not load releases (rate limit or private repo)'], text: '' };
  }
}

function readDeps(input) {
  const pkg = JSON.parse(input);
  return {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {})
  };
}

function riskPill(risk) {
  const cls = risk === 'high' ? 'risk-high' : risk === 'medium' ? 'risk-med' : 'risk-low';
  return `<span class="risk-pill ${cls}">${risk.toUpperCase()}</span>`;
}

async function analyze() {
  rowsEl.innerHTML = '';
  let deps;
  try {
    deps = readDeps(pkgJsonEl.value);
  } catch (e) {
    alert(`Invalid JSON: ${e.message}`);
    return;
  }

  const names = Object.keys(deps);
  if (!names.length) {
    alert('No dependencies/devDependencies found.');
    return;
  }

  resultsEl.classList.remove('hidden');
  metaEl.textContent = `Analyzing ${names.length} packages...`;

  let done = 0;
  for (const name of names) {
    const current = deps[name];
    const row = document.getElementById('rowTemplate').content.firstElementChild.cloneNode(true);
    row.querySelector('.pkg').textContent = name;
    row.querySelector('.current').textContent = current;
    row.querySelector('.latest').textContent = 'Loading...';
    row.querySelector('.delta').textContent = '-';
    row.querySelector('.risk').textContent = '-';
    row.querySelector('.clues').textContent = '-';
    rowsEl.appendChild(row);

    try {
      const npm = await fetchNpmMeta(name);
      const delta = semverDelta(current, npm.latest);
      const gh = await fetchGithubReleaseClues(npm.repo);
      const risk = scoreRisk(delta, gh.text);

      row.querySelector('.latest').innerHTML = npm.latest
        ? `<a href="https://www.npmjs.com/package/${name}" target="_blank">${npm.latest}</a>`
        : 'unknown';
      row.querySelector('.delta').textContent = delta;
      row.querySelector('.risk').innerHTML = riskPill(risk);
      row.querySelector('.clues').textContent = gh.clues.slice(0, 3).join('; ');
    } catch (e) {
      row.querySelector('.latest').textContent = 'error';
      row.querySelector('.delta').textContent = 'unknown';
      row.querySelector('.risk').innerHTML = riskPill('medium');
      row.querySelector('.clues').textContent = e.message;
    }

    done += 1;
    metaEl.textContent = `Processed ${done}/${names.length} packages`;
  }

  metaEl.textContent = `Done. Analyzed ${names.length} packages.`;
}

function getSnapshots() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

function setSnapshots(snapshots) {
  localStorage.setItem(KEY, JSON.stringify(snapshots));
}

function renderSnapshots() {
  const snapshots = getSnapshots();
  snapshotsEl.innerHTML = '';
  if (!snapshots.length) {
    snapshotsEl.innerHTML = '<li>No saved snapshots yet.</li>';
    return;
  }

  snapshots.forEach((s, idx) => {
    const li = document.createElement('li');
    li.textContent = `${s.name} (${new Date(s.createdAt).toLocaleString()})`;

    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.onclick = () => {
      pkgJsonEl.value = s.content;
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => {
      const items = getSnapshots();
      items.splice(idx, 1);
      setSnapshots(items);
      renderSnapshots();
    };

    li.appendChild(loadBtn);
    li.appendChild(delBtn);
    snapshotsEl.appendChild(li);
  });
}

function saveSnapshot() {
  const name = snapshotNameEl.value.trim();
  if (!name) {
    alert('Please add a snapshot name.');
    return;
  }
  if (!pkgJsonEl.value.trim()) {
    alert('Nothing to save.');
    return;
  }
  const items = getSnapshots();
  items.unshift({ name, content: pkgJsonEl.value, createdAt: Date.now() });
  setSnapshots(items.slice(0, 20));
  snapshotNameEl.value = '';
  renderSnapshots();
}

analyzeBtn.addEventListener('click', analyze);
loadSampleBtn.addEventListener('click', loadSample);
saveSnapshotBtn.addEventListener('click', saveSnapshot);
renderSnapshots();

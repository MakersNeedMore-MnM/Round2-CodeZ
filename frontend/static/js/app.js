/* =========================================
   TwinLearn — Main Application JavaScript
   ========================================= */

const API = '/api';

// ── State ──────────────────────────────────
const state = {
  token: localStorage.getItem('tl_token'),
  user: JSON.parse(localStorage.getItem('tl_user') || 'null'),
  twin: null,
  currentView: 'landing',
  quizState: {
    questions: [],
    currentQ: 0,
    responses: [],
    startTime: 0,
    conceptId: null,
    conceptName: '',
  },
  simState: { conceptId: 5, minutes: 30, days: 14 },
  teacherData: null,
};

// ── API Helpers ────────────────────────────
async function apiGet(path) {
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${state.token}` },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPost(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.token}`,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── Notifications ──────────────────────────
function notify(msg, type = 'info', duration = 3000) {
  const icons = { info: '💡', success: '✅', warning: '⚠️', error: '❌' };
  const n = document.createElement('div');
  n.className = 'notification';
  n.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.body.appendChild(n);
  setTimeout(() => { n.style.animation = 'slideInRight 0.3s ease reverse'; setTimeout(() => n.remove(), 300); }, duration);
}

// ── Router ─────────────────────────────────
function navigate(view) {
  const isApp = !['landing', 'login'].includes(view);
  const shell = document.getElementById('app-shell');
  const sidebar = document.getElementById('app-sidebar');
  const landing = document.getElementById('view-landing');
  const loginView = document.getElementById('view-login');

  if (shell) shell.style.display = isApp ? 'flex' : 'none';
  if (sidebar) sidebar.style.display = isApp ? 'flex' : 'none';
  if (landing) landing.classList.toggle('active', view === 'landing');
  if (loginView) loginView.classList.toggle('active', view === 'login');

  document.querySelectorAll('.view').forEach(v => {
    if (v.id !== 'view-landing' && v.id !== 'view-login') {
      v.classList.remove('active');
    }
  });

  const el = document.getElementById(`view-${view}`);
  if (el) {
    el.classList.add('active');
    el.classList.add('page-enter');
    setTimeout(() => el.classList.remove('page-enter'), 400);
  }
  state.currentView = view;

  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`[data-view="${view}"]`).forEach(n => n.classList.add('active'));

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showApp() {
  if (!state.user) return navigate('login');
  const shell = document.getElementById('app-shell');
  if (shell) shell.style.display = 'flex';
  const role = state.user.role;
  renderSidebar(role);
  if (role === 'student') { navigate('student-home'); loadStudentDashboard(); }
  else if (role === 'teacher') { navigate('teacher-home'); loadTeacherDashboard(); }
  else if (role === 'parent') { navigate('parent-home'); loadParentDashboard(); }
  else if (role === 'admin') { navigate('admin-home'); loadAdminDashboard(); }
}

function fillDemo(email) {
  const emailInput = document.getElementById('login-email');
  const pwdInput = document.getElementById('login-password');
  if (emailInput) emailInput.value = email;
  if (pwdInput) pwdInput.value = 'demo123';
  navigate('login');
  switchAuthTab('signin');
  notify(`Selected persona: ${email}. Click Sign In to continue.`, 'info', 2500);
}

function switchAuthTab(tab) {
  const tabSignin = document.getElementById('tab-btn-signin');
  const tabRegister = document.getElementById('tab-btn-register');
  const signinCard = document.getElementById('auth-signin');
  const registerCard = document.getElementById('auth-register');

  if (tab === 'signin') {
    if (tabSignin) tabSignin.classList.add('active');
    if (tabRegister) tabRegister.classList.remove('active');
    if (signinCard) signinCard.style.display = 'block';
    if (registerCard) registerCard.style.display = 'none';
  } else {
    if (tabSignin) tabSignin.classList.remove('active');
    if (tabRegister) tabRegister.classList.add('active');
    if (signinCard) signinCard.style.display = 'none';
    if (registerCard) registerCard.style.display = 'block';
  }
}

function scrollToFeatures() {
  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
}

// ── Auth ────────────────────────────────────
async function login(email, password) {
  try {
    showLoading('Authenticating...');
    const data = await apiPost('/auth/login', { email, password });
    state.token = data.access_token;
    state.user = data.user;
    localStorage.setItem('tl_token', state.token);
    localStorage.setItem('tl_user', JSON.stringify(state.user));
    hideLoading();
    notify(`Welcome back, ${state.user.name}! 👋`, 'success');
    showApp();
  } catch (e) {
    hideLoading();
    notify('Invalid credentials. Try the demo accounts.', 'error');
  }
}

async function register(email, name, role, password) {
  try {
    showLoading('Creating your account...');
    const data = await apiPost('/auth/register', { email, name, role, password });
    state.token = data.access_token;
    state.user = data.user;
    localStorage.setItem('tl_token', state.token);
    localStorage.setItem('tl_user', JSON.stringify(state.user));
    hideLoading();
    notify(`Welcome to TwinLearn, ${name}! 🎉`, 'success');
    showApp();
  } catch (e) {
    hideLoading();
    notify('Registration failed. Email may already be in use.', 'error');
  }
}

function logout() {
  state.token = null;
  state.user = null;
  state.twin = null;
  localStorage.removeItem('tl_token');
  localStorage.removeItem('tl_user');
  const shell = document.getElementById('app-shell');
  if (shell) shell.style.display = 'none';
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) sidebar.style.display = 'none';
  navigate('landing');
  notify('Logged out successfully.', 'info');
}

// ── Loading ────────────────────────────────
function showLoading(msg = 'Loading...') {
  document.getElementById('loading-screen').style.display = 'flex';
  document.getElementById('loading-msg').textContent = msg;
}
function hideLoading() {
  document.getElementById('loading-screen').style.display = 'none';
}

// ── Sidebar ────────────────────────────────
function renderSidebar(role) {
  const sidebar = document.getElementById('app-sidebar');
  const roleNav = {
    student: [
      { icon: '🏠', label: 'Dashboard', view: 'student-home' },
      { icon: '🧬', label: 'My Twin', view: 'student-twin' },
      { icon: '📚', label: 'Learning Path', view: 'student-path' },
      { icon: '🧠', label: 'Take Quiz', view: 'student-quiz' },
      { icon: '🔮', label: 'Simulation', view: 'student-sim' },
      { icon: '📊', label: 'History', view: 'student-history' },
    ],
    teacher: [
      { icon: '🏠', label: 'Dashboard', view: 'teacher-home' },
      { icon: '👥', label: 'My Class', view: 'teacher-class' },
      { icon: '⚠️', label: 'Alerts', view: 'teacher-alerts' },
    ],
    parent: [
      { icon: '🏠', label: 'Dashboard', view: 'parent-home' },
      { icon: '📈', label: 'Progress', view: 'parent-progress' },
    ],
    admin: [
      { icon: '🏠', label: 'Dashboard', view: 'admin-home' },
      { icon: '👤', label: 'Users', view: 'admin-users' },
      { icon: '📊', label: 'Analytics', view: 'admin-analytics' },
    ],
  };

  const roleColors = { student: '#6366f1', teacher: '#06b6d4', parent: '#10b981', admin: '#a855f7' };
  const roleEmojis = { student: '🎓', teacher: '👩‍🏫', parent: '👨‍👧', admin: '⚙️' };
  const initials = state.user?.name?.split(' ').map(w => w[0]).join('').slice(0,2) || 'U';

  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <div class="logo-icon">🧬</div>
      <div>
        <div style="font-family:var(--font-display);font-weight:800;font-size:1.1rem;">TwinLearn</div>
        <div style="font-size:0.7rem;color:#475569;text-transform:uppercase;letter-spacing:0.1em;">${role}</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section-title">Navigation</div>
      ${(roleNav[role] || []).map(item => `
        <div class="nav-item" data-view="${item.view}" onclick="navigate('${item.view}')">
          <span class="nav-icon">${item.icon}</span>
          <span>${item.label}</span>
        </div>
      `).join('')}
    </nav>
    <div class="sidebar-user">
      <div class="user-card" onclick="logout()">
        <div class="user-avatar">${initials}</div>
        <div>
          <div style="font-size:0.875rem;font-weight:600;">${state.user?.name || 'User'}</div>
          <div style="font-size:0.7rem;color:#475569;">${roleEmojis[role]} ${role} · Sign out</div>
        </div>
      </div>
    </div>
  `;
  sidebar.style.display = 'flex';
  document.getElementById('main-content').style.marginLeft = '260px';
}

// ── STUDENT DASHBOARD ──────────────────────
async function loadStudentDashboard() {
  showLoading('Loading your digital twin...');
  try {
    const data = await apiGet('/student/twin');
    state.twin = data;
    hideLoading();
    renderStudentHome(data);
    renderStudentTwin(data);
    renderStudentPath(data);
    renderStudentSim(data);
    loadStudentHistory();
  } catch(e) {
    hideLoading();
    notify('Failed to load twin data.', 'error');
  }
}

function renderStudentHome(data) {
  const el = document.getElementById('view-student-home');
  const riskColors = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' };
  const riskColor = riskColors[data.twin.overall_risk] || '#64748b';

  el.innerHTML = `
    <div class="topbar">
      <div>
        <h1 style="font-size:1.25rem;font-weight:800;">Welcome back, ${data.student.name.split(' ')[0]} 👋</h1>
        <div class="text-sm text-muted">Your digital twin was last updated ${timeAgo(data.twin.last_updated)}</div>
      </div>
      <div class="flex gap-3 items-center">
        <span class="badge badge-${data.twin.overall_risk === 'low' ? 'success' : data.twin.overall_risk === 'medium' ? 'warning' : 'danger'}">
          ${data.twin.overall_risk === 'low' ? '✅' : '⚠️'} ${data.twin.overall_risk} risk
        </span>
        <button class="btn btn-primary btn-sm" onclick="navigate('student-quiz')">Take Quiz</button>
      </div>
    </div>
    <div class="page-content page-enter">
      <!-- Stats Row -->
      <div class="grid-4 mb-6">
        ${statCard('📊', 'Avg Mastery', `${avgMastery(data.knowledge_graph)}%`, 'primary')}
        ${statCard('💪', 'Confidence', `${data.confidence}%`, 'success')}
        ${statCard('⚡', 'Learning Pace', `${data.pace}%`, 'warning')}
        ${statCard('🎯', 'Motivation', `${data.motivation}%`, data.motivation > 50 ? 'success' : 'danger')}
      </div>

      <div class="grid-2 mb-6">
        <!-- Risk Alerts -->
        <div class="card">
          <div class="section-header">
            <div class="section-title">⚠️ Predictive Risk Alerts</div>
            <span class="badge badge-${data.alerts.length === 0 ? 'success' : 'danger'}">${data.alerts.length} alerts</span>
          </div>
          ${data.alerts.length === 0
            ? `<div class="empty-state"><div class="empty-icon">🎉</div><p>No risks detected!</p></div>`
            : data.alerts.map(a => `
              <div class="alert-card ${a.severity}">
                <div style="font-size:1.5rem;">${a.emoji}</div>
                <div>
                  <div style="font-weight:700;font-size:0.95rem;">${a.concept}</div>
                  <div class="text-sm text-muted">${a.message}</div>
                  <div class="flex gap-2 mt-2">
                    <span class="badge badge-${a.severity === 'critical' ? 'critical' : a.severity === 'high' ? 'danger' : 'warning'}">${a.risk}% risk</span>
                  </div>
                </div>
              </div>`).join('')
          }
        </div>

        <!-- Radar Chart -->
        <div class="card">
          <div class="section-header">
            <div class="section-title">🧬 Twin Profile Radar</div>
          </div>
          <div class="radar-container" id="radar-chart" style="height:260px;"></div>
        </div>
      </div>

      <!-- Recommendations -->
      <div class="card mb-6">
        <div class="section-header">
          <div class="section-title">🤖 AI Recommendations</div>
          <button class="btn btn-ghost btn-sm" onclick="navigate('student-path')">View Full Path →</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
          ${(data.recommendations || []).slice(0,4).map((r,i) => `
            <div class="card" style="padding:16px;cursor:pointer;border-color:${r.risk > 50 ? 'rgba(239,68,68,0.3)' : 'var(--color-border)'};"
                 onclick="startQuiz(${r.id}, '${r.name}')">
              <div class="flex items-center gap-2 mb-2">
                <span style="font-size:1.4rem;">${r.emoji}</span>
                <div>
                  <div style="font-weight:700;font-size:0.9rem;">${r.name}</div>
                  <div class="text-xs text-muted">${r.subject}</div>
                </div>
                <span class="badge badge-${r.risk > 60 ? 'danger' : r.risk > 35 ? 'warning' : 'info'}" style="margin-left:auto;">${r.mastery}%</span>
              </div>
              <div class="progress-bar mb-2"><div class="progress-fill progress-${r.risk > 50 ? 'warning' : 'primary'}" style="width:${r.mastery}%"></div></div>
              <div class="text-xs text-muted">${r.reason}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Retention Curve -->
      <div class="card">
        <div class="section-header">
          <div class="section-title">📉 Memory Retention Curve — Calculus</div>
          <button class="btn btn-ghost btn-sm" onclick="navigate('student-sim')">Run Simulation →</button>
        </div>
        <div id="retention-chart" style="height:200px;"></div>
      </div>
    </div>
  `;
  setTimeout(() => {
    renderRadarChart('radar-chart', data.radar);
    renderRetentionChart('retention-chart', data.retention_curve);
  }, 100);
}

function renderStudentTwin(data) {
  const el = document.getElementById('view-student-twin');
  const kg = data.knowledge_graph;
  el.innerHTML = `
    <div class="topbar">
      <h1 style="font-size:1.25rem;font-weight:800;">🧬 My Digital Twin</h1>
      <span class="badge badge-info">Last synced ${timeAgo(data.twin.last_updated)}</span>
    </div>
    <div class="page-content page-enter">
      <div class="grid-2 mb-6">
        <!-- Twin Stats -->
        <div class="card">
          <div class="section-title mb-4">Twin Dimensions</div>
          ${[
            { label: 'Knowledge Mastery', value: avgMastery(kg), icon: '📖', color: 'primary' },
            { label: 'Confidence Level', value: data.confidence, icon: '💪', color: 'success' },
            { label: 'Learning Pace', value: data.pace, icon: '⚡', color: 'warning' },
            { label: 'Motivation Index', value: data.motivation, icon: '🔥', color: data.motivation > 50 ? 'success' : 'danger' },
          ].map(d => `
            <div class="flex items-center gap-3 mb-4">
              <div class="stat-icon ${d.color}" style="width:36px;height:36px;font-size:16px;">${d.icon}</div>
              <div style="flex:1">
                <div class="flex justify-between mb-1">
                  <span class="text-sm" style="font-weight:600;">${d.label}</span>
                  <span class="text-sm" style="font-weight:800;">${d.value}%</span>
                </div>
                <div class="progress-bar"><div class="progress-fill progress-${d.color}" style="width:${d.value}%"></div></div>
              </div>
            </div>
          `).join('')}

          <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--color-border);">
            <div class="grid-2" style="gap:12px;">
              ${metaTile('🎨', 'Learning Style', capitalize(data.twin.learning_style))}
              ${metaTile('⏱️', 'Attention Span', `${data.twin.attention_span} min`)}
              ${metaTile('🌡️', 'Overall Risk', capitalize(data.twin.overall_risk))}
              ${metaTile('🔄', 'Twin Updated', timeAgo(data.twin.last_updated))}
            </div>
          </div>
        </div>

        <!-- Radar Full -->
        <div class="card">
          <div class="section-title mb-4">Twin Radar</div>
          <div id="radar-twin" style="height:300px;"></div>
        </div>
      </div>

      <!-- Concept Knowledge Map -->
      <div class="card">
        <div class="section-header mb-4">
          <div class="section-title">🗺️ Knowledge Graph</div>
          <div class="text-sm text-muted">Hover over a concept to see details</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
          ${Object.entries(kg).map(([id, mastery]) => {
            const c = conceptById(id, data);
            if (!c) return '';
            const risk = (data.risk_scores || {})[id] || 0;
            const masP = round(mastery * 100);
            const riskP = round(risk * 100);
            return `
              <div class="card" style="padding:16px;border-color:${riskP > 60 ? 'rgba(239,68,68,0.4)' : masP > 80 ? 'rgba(16,185,129,0.4)' : 'var(--color-border)'};">
                <div class="flex items-center gap-2 mb-3">
                  <span style="font-size:1.4rem;">${c.emoji}</span>
                  <div>
                    <div style="font-weight:700;font-size:0.875rem;">${c.name}</div>
                    <div class="text-xs text-muted">${masteryLabel(mastery)}</div>
                  </div>
                </div>
                <div class="progress-bar mb-2"><div class="progress-fill progress-${masP > 80 ? 'success' : masP > 50 ? 'primary' : 'warning'}" style="width:${masP}%"></div></div>
                <div class="flex justify-between text-xs">
                  <span style="color:#64748b;">Mastery</span>
                  <span style="font-weight:700;">${masP}%</span>
                </div>
                ${riskP > 40 ? `<div class="flex justify-between text-xs mt-1"><span style="color:#64748b;">Risk</span><span style="color:${riskP > 65 ? '#ef4444' : '#f59e0b'};font-weight:700;">${riskP}%</span></div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
  setTimeout(() => renderRadarChart('radar-twin', data.radar), 100);
}

function renderStudentPath(data) {
  const el = document.getElementById('view-student-path');
  const path = data.learning_path || [];
  el.innerHTML = `
    <div class="topbar">
      <h1 style="font-size:1.25rem;font-weight:800;">📚 Learning Path</h1>
      <div class="text-sm text-muted">AI-personalized path based on your twin</div>
    </div>
    <div class="page-content page-enter">
      <div class="card mb-6">
        <div class="section-title mb-4">Mathematics Curriculum</div>
        <div style="position:relative;">
          ${path.map((concept, i) => `
            <div class="concept-node ${!concept.unlocked ? 'locked' : concept.completed ? 'completed' : ''}"
                 onclick="${concept.unlocked ? `startQuiz(${concept.id}, '${concept.name}')` : 'notify(\"Complete prerequisites first!\", \"warning\")'}">
              <div style="position:relative;">
                <span class="concept-emoji">${concept.emoji}</span>
                ${concept.completed ? '<span style="position:absolute;top:-4px;right:-4px;font-size:10px;">✅</span>' : ''}
              </div>
              <div class="concept-bar">
                <div class="flex justify-between items-center mb-1">
                  <div style="font-weight:700;font-size:0.9rem;color:${!concept.unlocked ? '#475569' : '#e2e8f0'};">${concept.name}</div>
                  <div class="flex gap-2 items-center">
                    <span class="text-xs text-muted">Difficulty: ${'●'.repeat(Math.ceil(concept.difficulty * 5))}${'○'.repeat(5 - Math.ceil(concept.difficulty * 5))}</span>
                    <span class="badge badge-${concept.completed ? 'success' : concept.mastery > 50 ? 'info' : !concept.unlocked ? 'warning' : 'info'}">${concept.mastery_level}</span>
                  </div>
                </div>
                <div class="progress-bar" style="height:6px;">
                  <div class="progress-fill progress-${concept.completed ? 'success' : concept.mastery > 60 ? 'primary' : 'warning'}" style="width:${concept.mastery}%"></div>
                </div>
                <div class="flex gap-3 mt-1">
                  <span class="text-xs text-muted">${concept.mastery}% mastered</span>
                  ${concept.prerequisites.length > 0 ? `<span class="text-xs text-muted">Requires: ${concept.prerequisites.map(pid => {const pc = path.find(c=>c.id===pid); return pc ? pc.name : pid;}).join(', ')}</span>` : ''}
                </div>
              </div>
              <button class="btn btn-sm ${concept.unlocked ? 'btn-primary' : 'btn-ghost'}"
                      onclick="event.stopPropagation();${concept.unlocked ? `startQuiz(${concept.id}, '${concept.name}')` : ''}">
                ${concept.completed ? 'Review' : concept.unlocked ? 'Practice →' : '🔒'}
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderStudentSim(data) {
  const el = document.getElementById('view-student-sim');
  const kg = data.knowledge_graph || {};
  const conceptOptions = Object.entries(kg).map(([id]) => {
    const c = conceptById(id, data);
    return c ? `<option value="${id}">${c.emoji} ${c.name}</option>` : '';
  }).join('');

  el.innerHTML = `
    <div class="topbar">
      <h1 style="font-size:1.25rem;font-weight:800;">🔮 Simulation Mode</h1>
      <div class="text-sm text-muted">Predict your learning outcomes before they happen</div>
    </div>
    <div class="page-content page-enter">
      <div class="card" style="background:linear-gradient(135deg,rgba(99,102,241,0.08),rgba(168,85,247,0.05));border-color:rgba(99,102,241,0.25);margin-bottom:24px;">
        <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:16px;">
          <span style="font-size:1.5rem;">🔬</span>
          <div>
            <div style="font-weight:700;margin-bottom:4px;">Digital Twin Simulation</div>
            <div class="text-sm text-muted">Your digital twin will project how different study habits change your predicted performance — before you commit to a plan.</div>
          </div>
        </div>
      </div>

      <div class="grid-2 mb-6">
        <div class="card">
          <div class="section-title mb-4">⚙️ Configure Simulation</div>
          <div class="form-group">
            <label class="form-label">Concept</label>
            <select class="form-input" id="sim-concept">${conceptOptions}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Study Time Per Day: <strong id="sim-minutes-label">30 min</strong></label>
            <input type="range" id="sim-minutes" min="5" max="120" value="30" step="5"
              style="width:100%;accent-color:var(--color-primary);"
              oninput="document.getElementById('sim-minutes-label').textContent=this.value+' min'">
          </div>
          <div class="form-group">
            <label class="form-label">Projection Period: <strong id="sim-days-label">14 days</strong></label>
            <input type="range" id="sim-days" min="3" max="60" value="14" step="1"
              style="width:100%;accent-color:var(--color-primary);"
              oninput="document.getElementById('sim-days-label').textContent=this.value+' days'">
          </div>
          <button class="btn btn-primary" style="width:100%;" onclick="runSimulation()">🚀 Run Simulation</button>
        </div>

        <div class="card" id="sim-results">
          <div class="empty-state">
            <div class="empty-icon">🔮</div>
            <p>Configure and run a simulation to see projections</p>
          </div>
        </div>
      </div>

      <div class="card" id="sim-chart-card" style="display:none;">
        <div class="section-title mb-4">📈 Projected Learning Trajectory</div>
        <div id="sim-chart" style="height:280px;"></div>
      </div>
    </div>
  `;
}

async function runSimulation() {
  const conceptId = parseInt(document.getElementById('sim-concept').value);
  const minutes = parseInt(document.getElementById('sim-minutes').value);
  const days = parseInt(document.getElementById('sim-days').value);

  const resultsEl = document.getElementById('sim-results');
  resultsEl.innerHTML = `<div style="display:flex;justify-content:center;padding:40px;"><div class="spinner"></div></div>`;

  try {
    const data = await apiPost('/student/simulate', { concept_id: conceptId, minutes_per_day: minutes, days });
    const s = data.scenarios;
    const expected = s.expected;
    const best = s.best_case;
    const worst = s.worst_case;
    const noStudy = s.no_study;

    resultsEl.innerHTML = `
      <div class="section-title mb-4">📊 ${data.emoji} ${data.concept} — Results</div>
      <div style="font-size:0.8rem;color:#64748b;margin-bottom:16px;">Current mastery: ${data.current_mastery}%</div>

      ${simScenario('🚫 No Study', noStudy.projected_score, noStudy.projected_mastery, '#ef4444')}
      ${simScenario('😰 Worst Case', worst.projected_score, worst.projected_mastery, '#f97316')}
      ${simScenario('📅 Expected', expected.projected_score, expected.projected_mastery, '#6366f1', true)}
      ${simScenario('🌟 Best Case', best.projected_score, best.projected_mastery, '#10b981')}

      <div style="margin-top:16px;padding:12px;background:rgba(99,102,241,0.08);border-radius:var(--radius-md);">
        <div class="text-sm">${data.recommendation}</div>
      </div>
    `;

    document.getElementById('sim-chart-card').style.display = 'block';
    setTimeout(() => renderSimChart('sim-chart', s, days), 100);
  } catch(e) {
    resultsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>Simulation failed</p></div>`;
  }
}

function simScenario(label, score, mastery, color, highlight = false) {
  return `
    <div style="padding:12px;border-radius:var(--radius-md);margin-bottom:8px;border:1px solid ${highlight ? color + '50' : 'transparent'};background:${highlight ? color + '12' : 'transparent'};">
      <div class="flex justify-between items-center mb-1">
        <span style="font-size:0.875rem;font-weight:${highlight ? 700 : 500};">${label}</span>
        <span style="font-size:1.2rem;font-weight:800;color:${color};">${score}%</span>
      </div>
      <div class="progress-bar" style="height:6px;">
        <div style="height:100%;width:${mastery}%;background:${color};border-radius:999px;transition:width 1s ease;"></div>
      </div>
    </div>
  `;
}

// ── QUIZ SYSTEM ────────────────────────────
function startQuiz(conceptId, conceptName) {
  state.quizState = { questions: [], currentQ: 0, responses: [], startTime: Date.now(), conceptId, conceptName };
  navigate('student-quiz');
  loadQuiz(conceptId);
}

async function loadQuiz(conceptId) {
  const el = document.getElementById('view-student-quiz');
  el.innerHTML = `<div class="loading-screen" style="position:relative;height:400px;background:transparent;"><div class="spinner"></div><p class="text-muted">Loading quiz...</p></div>`;
  try {
    const quiz = await apiGet(`/student/quiz/${conceptId}`);
    state.quizState.questions = quiz.questions;
    state.quizState.conceptId = conceptId;
    state.quizState.conceptName = quiz.concept_name;
    state.quizState.currentQ = 0;
    state.quizState.responses = [];
    renderQuizQuestion();
  } catch(e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>Failed to load quiz</p></div>`;
  }
}

function renderQuizQuestion() {
  const el = document.getElementById('view-student-quiz');
  const qs = state.quizState;
  if (qs.currentQ >= qs.questions.length) { submitQuiz(); return; }

  const q = qs.questions[qs.currentQ];
  const progress = ((qs.currentQ) / qs.questions.length) * 100;
  const letters = ['A', 'B', 'C', 'D', 'E'];

  el.innerHTML = `
    <div class="topbar">
      <div class="flex items-center gap-3">
        <button class="btn btn-ghost btn-sm" onclick="navigate('student-home')">← Back</button>
        <div>
          <div style="font-weight:700;">${qs.conceptName} Quiz</div>
          <div class="text-sm text-muted">Question ${qs.currentQ + 1} of ${qs.questions.length}</div>
        </div>
      </div>
    </div>
    <div class="page-content page-enter">
      <div style="max-width:640px;margin:0 auto;">
        <div class="progress-bar mb-6" style="height:6px;">
          <div class="progress-fill progress-primary" style="width:${progress}%;"></div>
        </div>
        <div class="card mb-4" style="padding:32px;">
          <div class="text-sm text-muted mb-4">Question ${qs.currentQ + 1}</div>
          <div style="font-size:1.1rem;font-weight:600;line-height:1.5;margin-bottom:28px;">${q.question}</div>
          <div id="quiz-options">
            ${q.options.map((opt, i) => `
              <div class="quiz-option" id="opt-${i}" onclick="selectOption(${i}, ${q.correct_index})">
                <div class="option-letter">${letters[i]}</div>
                <div>${opt}</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;">
          <button class="btn btn-primary" id="next-btn" style="display:none;" onclick="nextQuestion()">
            ${qs.currentQ + 1 >= qs.questions.length ? 'Submit Quiz 🎯' : 'Next Question →'}
          </button>
        </div>
      </div>
    </div>
  `;
}

let selectedOption = null;
function selectOption(index, correct) {
  if (selectedOption !== null) return;
  selectedOption = index;
  const options = document.querySelectorAll('.quiz-option');
  options[index].classList.add(index === correct ? 'correct' : 'wrong');
  if (index !== correct) options[correct].classList.add('correct');
  options.forEach(o => o.style.pointerEvents = 'none');
  document.getElementById('next-btn').style.display = 'flex';
  state.quizState.responses.push(index === correct);
}

function nextQuestion() {
  selectedOption = null;
  state.quizState.currentQ++;
  renderQuizQuestion();
}

async function submitQuiz() {
  const qs = state.quizState;
  const el = document.getElementById('view-student-quiz');
  el.innerHTML = `<div class="loading-screen" style="position:relative;height:400px;background:transparent;"><div class="spinner"></div><p>Updating your twin...</p></div>`;
  try {
    const timeTaken = Math.floor((Date.now() - qs.startTime) / 1000);
    const result = await apiPost('/student/quiz/submit', {
      concept_id: qs.conceptId,
      responses: qs.responses,
      time_taken_seconds: timeTaken,
    });

    const score = result.score;
    const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

    el.innerHTML = `
      <div class="page-content page-enter" style="max-width:640px;margin:0 auto;padding-top:60px;">
        <div class="card" style="text-align:center;padding:48px;">
          <div style="font-size:4rem;margin-bottom:16px;">${score >= 80 ? '🌟' : score >= 60 ? '👍' : '📚'}</div>
          <h2 style="font-size:2rem;margin-bottom:8px;">Quiz Complete!</h2>
          <div style="font-size:3.5rem;font-weight:900;color:${scoreColor};margin:16px 0;">${score}%</div>
          <div class="text-muted mb-4">${result.correct} / ${result.total} correct</div>

          <div style="background:var(--color-surface-2);border-radius:var(--radius-md);padding:16px;margin-bottom:24px;text-align:left;">
            <div style="font-size:0.875rem;font-weight:600;margin-bottom:8px;">🧬 Twin Updated</div>
            <div class="flex justify-between text-sm">
              <span class="text-muted">New Mastery</span>
              <span style="font-weight:700;color:var(--color-primary-light);">${result.new_mastery}%</span>
            </div>
            <div class="flex justify-between text-sm mt-1">
              <span class="text-muted">Risk Level</span>
              <span style="font-weight:700;color:${result.new_risk > 60 ? '#ef4444' : '#10b981'};">${result.new_risk}%</span>
            </div>
          </div>

          <div style="font-style:italic;color:#94a3b8;margin-bottom:32px;font-size:0.9rem;">${result.feedback}</div>

          <div class="flex gap-3 justify-center">
            <button class="btn btn-secondary" onclick="navigate('student-home');loadStudentDashboard()">📊 Dashboard</button>
            <button class="btn btn-primary" onclick="startQuiz(${qs.conceptId}, '${qs.conceptName}')">🔁 Retry</button>
          </div>
        </div>
      </div>
    `;
  } catch(e) {
    notify('Failed to submit quiz.', 'error');
  }
}

async function loadStudentHistory() {
  const el = document.getElementById('view-student-history');
  el.innerHTML = `<div class="topbar"><h1 style="font-size:1.25rem;font-weight:800;">📊 Quiz History</h1></div>
    <div class="page-content"><div style="display:flex;justify-content:center;padding:40px;"><div class="spinner"></div></div></div>`;
  try {
    const history = await apiGet('/student/history');
    el.innerHTML = `
      <div class="topbar"><h1 style="font-size:1.25rem;font-weight:800;">📊 Quiz History</h1></div>
      <div class="page-content page-enter">
        ${history.length === 0
          ? `<div class="empty-state"><div class="empty-icon">📭</div><p>No quizzes yet. Take your first quiz!</p><button class="btn btn-primary mt-4" onclick="navigate('student-quiz')">Take a Quiz</button></div>`
          : `<div class="card">
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="border-bottom:1px solid var(--color-border);">
                    <th style="text-align:left;padding:12px;font-size:0.8rem;color:#64748b;">CONCEPT</th>
                    <th style="text-align:left;padding:12px;font-size:0.8rem;color:#64748b;">SCORE</th>
                    <th style="text-align:left;padding:12px;font-size:0.8rem;color:#64748b;">RESULT</th>
                    <th style="text-align:left;padding:12px;font-size:0.8rem;color:#64748b;">DATE</th>
                  </tr>
                </thead>
                <tbody>
                  ${history.map(h => `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                      <td style="padding:12px;"><span style="font-size:1.1rem;">${h.emoji}</span> ${h.concept_name}</td>
                      <td style="padding:12px;"><span style="font-weight:800;color:${h.score >= 80 ? '#10b981' : h.score >= 60 ? '#f59e0b' : '#ef4444'}">${h.score}%</span></td>
                      <td style="padding:12px;">${h.correct}/${h.total} correct</td>
                      <td style="padding:12px;color:#64748b;">${new Date(h.date).toLocaleDateString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>
    `;
  } catch(e) {}
}

// ── TEACHER DASHBOARD ──────────────────────
async function loadTeacherDashboard() {
  showLoading('Loading class data...');
  try {
    const data = await apiGet('/teacher/dashboard');
    state.teacherData = data;
    hideLoading();
    renderTeacherHome(data);
    renderTeacherClass(data);
    renderTeacherAlerts(data);
  } catch(e) {
    hideLoading();
    notify('Failed to load teacher data.', 'error');
  }
}

function renderTeacherHome(data) {
  const el = document.getElementById('view-teacher-home');
  el.innerHTML = `
    <div class="topbar">
      <div>
        <h1 style="font-size:1.25rem;font-weight:800;">Welcome, ${data.teacher.name} 👩‍🏫</h1>
        <div class="text-sm text-muted">Class overview & predictive insights</div>
      </div>
    </div>
    <div class="page-content page-enter">
      <div class="grid-4 mb-6">
        ${statCard('👥', 'Students', data.class_size, 'primary')}
        ${statCard('⚠️', 'High Risk', data.high_risk_count, 'danger')}
        ${statCard('✅', 'On Track', data.risk_distribution.low || 0, 'success')}
        ${statCard('📊', 'Medium Risk', (data.risk_distribution.medium || 0), 'warning')}
      </div>

      <!-- Risk Summary -->
      <div class="grid-2 mb-6">
        <div class="card">
          <div class="section-title mb-4">⚠️ Students Needing Attention</div>
          ${data.students.filter(s => ['high','critical'].includes(s.overall_risk)).length === 0
            ? `<div class="empty-state"><div class="empty-icon">🎉</div><p>All students are on track!</p></div>`
            : data.students
              .filter(s => ['high','critical'].includes(s.overall_risk))
              .map(s => `
                <div class="alert-card ${s.overall_risk === 'critical' ? 'critical' : 'high'}" style="margin-bottom:10px;">
                  <div class="user-avatar" style="flex-shrink:0;">${s.name.split(' ').map(w=>w[0]).join('')}</div>
                  <div style="flex:1">
                    <div style="font-weight:700;">${s.name}</div>
                    <div class="text-sm text-muted">Avg: ${s.avg_mastery}% | Confidence: ${s.confidence}%</div>
                    <div class="flex gap-2 mt-1" style="flex-wrap:wrap;">
                      ${s.high_risk_concepts.map(c => `<span class="badge badge-danger">${c.emoji} ${c.name} ${c.risk}%</span>`).join('')}
                    </div>
                  </div>
                  <button class="btn btn-sm btn-secondary" onclick="showStudentDetail(${s.id}, '${s.name}')">View →</button>
                </div>
              `).join('')
          }
        </div>

        <!-- Concept Mastery Heatmap -->
        <div class="card">
          <div class="section-title mb-4">🗺️ Class Concept Mastery</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
            ${Object.entries(data.concept_mastery).map(([name, cm]) => {
              const pct = cm.avg_mastery;
              const bgColor = pct > 70 ? 'rgba(16,185,129,0.6)' : pct > 45 ? 'rgba(245,158,11,0.6)' : 'rgba(239,68,68,0.6)';
              return `
                <div class="heatmap-cell tooltip" style="background:${bgColor};padding:10px;min-height:60px;flex-direction:column;">
                  <span>${cm.emoji}</span>
                  <span style="font-size:0.75rem;">${pct}%</span>
                  <span class="tooltip-text">${name}: ${cm.avg_mastery}% avg, ${cm.struggling_count} struggling</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTeacherClass(data) {
  const el = document.getElementById('view-teacher-class');
  el.innerHTML = `
    <div class="topbar">
      <h1 style="font-size:1.25rem;font-weight:800;">👥 My Class — ${data.class_size} Students</h1>
    </div>
    <div class="page-content page-enter">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
        ${data.students.map(s => `
          <div class="card" style="border-color:${s.overall_risk === 'critical' ? 'rgba(239,68,68,0.4)' : s.overall_risk === 'high' ? 'rgba(245,158,11,0.4)' : 'var(--color-border)'};">
            <div class="flex items-center gap-3 mb-3">
              <div class="user-avatar" style="width:44px;height:44px;font-size:1rem;">${s.name.split(' ').map(w=>w[0]).join('')}</div>
              <div style="flex:1">
                <div style="font-weight:700;">${s.name}</div>
                <div class="text-xs text-muted">${capitalize(s.learning_style)} learner</div>
              </div>
              <span class="badge badge-${s.overall_risk === 'low' ? 'success' : s.overall_risk === 'medium' ? 'warning' : 'danger'}">${s.overall_risk}</span>
            </div>
            <div class="grid-2" style="gap:8px;margin-bottom:12px;">
              ${miniStat('📖', 'Mastery', s.avg_mastery + '%')}
              ${miniStat('💪', 'Confidence', s.confidence + '%')}
            </div>
            ${s.high_risk_concepts.length > 0 ? `
              <div style="margin-bottom:10px;">
                <div class="text-xs text-muted mb-1">At-risk concepts:</div>
                ${s.high_risk_concepts.slice(0,2).map(c => `<span class="badge badge-danger" style="margin-right:4px;">${c.emoji} ${c.name}</span>`).join('')}
              </div>
            ` : ''}
            <button class="btn btn-sm btn-secondary" style="width:100%;" onclick="showStudentDetail(${s.id}, '${s.name}')">View Twin Details →</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderTeacherAlerts(data) {
  const el = document.getElementById('view-teacher-alerts');
  const highRiskStudents = data.students.filter(s => ['high','critical'].includes(s.overall_risk));
  el.innerHTML = `
    <div class="topbar">
      <h1 style="font-size:1.25rem;font-weight:800;">⚠️ Early Warning Alerts</h1>
      <span class="badge badge-danger">${highRiskStudents.length} students at risk</span>
    </div>
    <div class="page-content page-enter">
      ${highRiskStudents.length === 0
        ? `<div class="empty-state" style="padding:80px 24px;"><div class="empty-icon">🎉</div><h3>No alerts right now</h3><p class="text-muted">All students are performing well</p></div>`
        : highRiskStudents.map(s => `
          <div class="card mb-4" style="border-color:${s.overall_risk === 'critical' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'};">
            <div class="flex items-center gap-3 mb-3">
              <div class="user-avatar" style="width:44px;height:44px;background:${s.overall_risk === 'critical' ? 'var(--gradient-danger)' : 'linear-gradient(135deg,#f59e0b,#ef4444)'};">${s.name.split(' ').map(w=>w[0]).join('')}</div>
              <div>
                <div style="font-weight:700;font-size:1rem;">${s.name}</div>
                <div class="text-sm text-muted">${s.alerts_count} concept${s.alerts_count !== 1 ? 's' : ''} flagged by twin predictions</div>
              </div>
              <span class="badge badge-${s.overall_risk === 'critical' ? 'critical' : 'danger'}" style="margin-left:auto;">${s.overall_risk.toUpperCase()}</span>
            </div>
            <div class="flex gap-2 flex-wrap mb-3">
              ${s.high_risk_concepts.map(c => `
                <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-md);padding:8px 12px;font-size:0.85rem;">
                  <span>${c.emoji}</span> <strong>${c.name}</strong> — <span style="color:#ef4444;">${c.risk}% risk</span>
                </div>
              `).join('')}
            </div>
            <div style="background:rgba(99,102,241,0.05);border-radius:var(--radius-md);padding:12px;margin-bottom:12px;">
              <div class="text-sm"><strong>Recommended Action:</strong> Schedule a targeted review session on ${s.high_risk_concepts[0]?.name}. Consider breaking concept into smaller sub-topics.</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="showStudentDetail(${s.id}, '${s.name}')">View Full Twin Analysis →</button>
          </div>
        `).join('')
      }
    </div>
  `;
}

async function showStudentDetail(studentId, name) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal-box"><div style="display:flex;justify-content:center;padding:40px;"><div class="spinner"></div></div></div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });

  try {
    const data = await apiGet(`/teacher/student/${studentId}`);
    modal.querySelector('.modal-box').innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <h3>🧬 ${data.student.name}'s Twin Analysis</h3>
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="grid-2 mb-4">
        ${metaTile('🌡️', 'Overall Risk', capitalize(data.twin.overall_risk))}
        ${metaTile('💪', 'Confidence', data.twin.confidence + '%')}
        ${metaTile('⚡', 'Pace', data.twin.pace + '%')}
        ${metaTile('🎨', 'Style', capitalize(data.twin.learning_style))}
      </div>
      <div class="section-title mb-3">Concept Breakdown</div>
      ${data.concepts.map(c => `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <span style="font-size:1.2rem;">${c.emoji}</span>
          <div style="flex:1">
            <div class="flex justify-between mb-1">
              <span style="font-size:0.875rem;font-weight:600;">${c.name}</span>
              <span class="badge badge-${c.risk > 60 ? 'danger' : c.risk > 35 ? 'warning' : 'success'}">${c.risk}% risk</span>
            </div>
            <div class="progress-bar" style="height:5px;">
              <div class="progress-fill progress-${c.mastery > 70 ? 'success' : c.mastery > 40 ? 'primary' : 'warning'}" style="width:${c.mastery}%"></div>
            </div>
          </div>
          <span style="font-size:0.8rem;font-weight:700;min-width:40px;text-align:right;">${c.mastery}%</span>
        </div>
      `).join('')}
    `;
  } catch(e) { modal.remove(); }
}

// ── PARENT DASHBOARD ───────────────────────
async function loadParentDashboard() {
  showLoading('Loading child\'s data...');
  try {
    const data = await apiGet('/parent/dashboard');
    hideLoading();
    renderParentHome(data);
  } catch(e) {
    hideLoading();
    notify('Failed to load parent data.', 'error');
  }
}

function renderParentHome(data) {
  const el = document.getElementById('view-parent-home');
  const child = data.child;
  el.innerHTML = `
    <div class="topbar">
      <div>
        <h1 style="font-size:1.25rem;font-weight:800;">👨‍👧 ${data.parent.name}'s Dashboard</h1>
        <div class="text-sm text-muted">Monitoring ${child.name}'s learning journey</div>
      </div>
    </div>
    <div class="page-content page-enter">
      <!-- Child Summary -->
      <div class="card mb-6" style="background:linear-gradient(135deg,var(--color-surface),rgba(99,102,241,0.05));border-color:rgba(99,102,241,0.2);">
        <div class="flex items-center gap-4 mb-4">
          <div class="user-avatar" style="width:56px;height:56px;font-size:1.3rem;">${child.name.split(' ').map(w=>w[0]).join('')}</div>
          <div>
            <div style="font-size:1.1rem;font-weight:800;">${child.name}</div>
            <div class="text-sm text-muted">${capitalize(child.learning_style)} learner</div>
          </div>
          <div style="margin-left:auto;">
            <span class="badge badge-${child.overall_risk === 'low' ? 'success' : child.overall_risk === 'medium' ? 'warning' : 'danger'} " style="font-size:0.85rem;padding:6px 14px;">
              ${child.overall_risk === 'low' ? '✅ On Track' : child.overall_risk === 'medium' ? '⚠️ Needs Attention' : '🚨 At Risk'}
            </span>
          </div>
        </div>
        <div class="grid-4">
          ${statCard('📖', 'Avg Mastery', child.avg_mastery + '%', 'primary')}
          ${statCard('💪', 'Confidence', child.confidence + '%', 'success')}
          ${statCard('🔥', 'Motivation', child.motivation + '%', child.motivation > 50 ? 'success' : 'warning')}
          ${statCard('🧪', 'Quizzes (7d)', data.total_quizzes_this_week, 'info')}
        </div>
      </div>

      <div class="grid-2 mb-6">
        <!-- Alerts -->
        <div class="card">
          <div class="section-title mb-4">🔔 Learning Alerts</div>
          ${data.alerts.length === 0
            ? `<div class="empty-state"><div class="empty-icon">🎉</div><p>${child.name} is doing great!</p></div>`
            : data.alerts.map(a => `
              <div class="alert-card ${a.severity}">
                <div style="font-size:1.5rem;">${a.emoji}</div>
                <div>
                  <div style="font-weight:700;">${a.concept}</div>
                  <div class="text-sm text-muted">${a.plain_message}</div>
                  <div style="margin-top:6px;font-size:0.8rem;color:var(--color-primary-light);">💡 ${a.action}</div>
                </div>
              </div>
            `).join('')
          }
        </div>

        <!-- Weekly Activity -->
        <div class="card">
          <div class="section-title mb-4">📅 This Week's Activity</div>
          ${data.weekly_scores.length === 0
            ? `<div class="empty-state"><div class="empty-icon">📭</div><p>No quizzes this week yet</p></div>`
            : `
              <div class="flex items-end gap-4" style="height:120px;align-items:flex-end;margin-bottom:8px;">
                ${data.weekly_scores.map(s => `
                  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                    <div style="font-size:0.7rem;font-weight:700;color:${s.score >= 70 ? '#10b981' : '#ef4444'};">${s.score}%</div>
                    <div style="width:100%;height:${s.score}px;max-height:100px;min-height:4px;background:${s.score >= 70 ? 'var(--gradient-success)' : 'var(--gradient-danger)'};border-radius:4px 4px 0 0;transition:height 1s ease;"></div>
                    <div style="font-size:0.65rem;color:#64748b;">${s.date}</div>
                  </div>
                `).join('')}
              </div>
              <div class="text-sm text-muted" style="text-align:center;">Avg this week: <strong style="color:var(--color-primary-light);">${data.avg_score_this_week}%</strong></div>
            `
          }
        </div>
      </div>
    </div>
  `;
}

// ── ADMIN DASHBOARD ────────────────────────
async function loadAdminDashboard() {
  showLoading('Loading platform data...');
  try {
    const data = await apiGet('/admin/dashboard');
    hideLoading();
    renderAdminHome(data);
    renderAdminUsers(data);
  } catch(e) {
    hideLoading();
    notify('Failed to load admin data.', 'error');
  }
}

function renderAdminHome(data) {
  const el = document.getElementById('view-admin-home');
  el.innerHTML = `
    <div class="topbar">
      <h1 style="font-size:1.25rem;font-weight:800;">⚙️ Admin Dashboard</h1>
      <div class="text-sm text-muted">Platform-wide analytics</div>
    </div>
    <div class="page-content page-enter">
      <div class="grid-4 mb-6">
        ${statCard('👥', 'Total Users', data.stats.total_users, 'primary')}
        ${statCard('🎓', 'Students', data.stats.total_students, 'info')}
        ${statCard('📝', 'Quizzes Taken', data.stats.total_quizzes, 'success')}
        ${statCard('📈', 'Avg Quiz Score', data.stats.avg_quiz_score + '%', 'warning')}
      </div>

      <div class="grid-2 mb-6">
        <!-- Risk Distribution -->
        <div class="card">
          <div class="section-title mb-4">🌡️ Risk Distribution</div>
          ${[
            {label:'Low Risk', key:'low', color:'#10b981'},
            {label:'Medium Risk', key:'medium', color:'#f59e0b'},
            {label:'High Risk', key:'high', color:'#ef4444'},
            {label:'Critical', key:'critical', color:'#dc2626'},
          ].map(r => {
            const count = data.risk_distribution[r.key] || 0;
            const total = data.stats.total_students || 1;
            const pct = Math.round(count / total * 100);
            return `
              <div class="flex items-center gap-3 mb-3">
                <div style="width:100px;font-size:0.8rem;color:#94a3b8;">${r.label}</div>
                <div class="progress-bar" style="flex:1">
                  <div style="height:100%;width:${pct}%;background:${r.color};border-radius:999px;transition:width 1s ease;"></div>
                </div>
                <div style="font-weight:700;font-size:0.9rem;min-width:20px;">${count}</div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Concept Stats -->
        <div class="card">
          <div class="section-title mb-4">📚 Concept Performance</div>
          ${data.concept_stats.map(c => `
            <div class="flex items-center gap-3 mb-2">
              <span style="font-size:1.1rem;">${c.emoji}</span>
              <div style="flex:1">
                <div class="flex justify-between mb-1">
                  <span style="font-size:0.8rem;font-weight:600;">${c.concept}</span>
                  <span style="font-size:0.8rem;font-weight:700;">${c.avg_mastery}%</span>
                </div>
                <div class="progress-bar" style="height:5px;">
                  <div class="progress-fill progress-${c.avg_mastery > 65 ? 'success' : c.avg_mastery > 40 ? 'primary' : 'warning'}" style="width:${c.avg_mastery}%"></div>
                </div>
              </div>
              ${c.struggling > 0 ? `<span class="badge badge-danger">${c.struggling}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderAdminUsers(data) {
  const el = document.getElementById('view-admin-users');
  el.innerHTML = `
    <div class="topbar">
      <h1 style="font-size:1.25rem;font-weight:800;">👤 User Management</h1>
    </div>
    <div class="page-content page-enter">
      <div class="card">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--color-border);">
              <th style="text-align:left;padding:12px;font-size:0.8rem;color:#64748b;">NAME</th>
              <th style="text-align:left;padding:12px;font-size:0.8rem;color:#64748b;">EMAIL</th>
              <th style="text-align:left;padding:12px;font-size:0.8rem;color:#64748b;">ROLE</th>
              <th style="text-align:left;padding:12px;font-size:0.8rem;color:#64748b;">JOINED</th>
            </tr>
          </thead>
          <tbody>
            ${data.users.map(u => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                <td style="padding:12px;">
                  <div class="flex items-center gap-2">
                    <div class="user-avatar" style="width:30px;height:30px;font-size:0.7rem;">${u.name.split(' ').map(w=>w[0]).join('')}</div>
                    ${u.name}
                  </div>
                </td>
                <td style="padding:12px;color:#64748b;">${u.email}</td>
                <td style="padding:12px;"><span class="badge badge-info">${u.role}</span></td>
                <td style="padding:12px;color:#64748b;">${u.joined ? new Date(u.joined).toLocaleDateString() : 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── CHARTS ────────────────────────────────
function renderRadarChart(containerId, radarData) {
  const el = document.getElementById(containerId);
  if (!el || !radarData) return;
  const size = Math.min(el.clientWidth || 280, 280);
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const labels = radarData.map(d => d.dimension);
  const values = radarData.map(d => d.value / 100);
  const n = labels.length;
  const angles = labels.map((_, i) => (i * 2 * Math.PI / n) - Math.PI / 2);

  const toXY = (angle, radius) => [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];

  // Grid rings
  const gridRings = [0.25, 0.5, 0.75, 1.0].map(pct => {
    const pts = angles.map(a => toXY(a, r * pct).join(',')).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(99,102,241,0.12)" stroke-width="1"/>`;
  }).join('');

  // Axes
  const axes = angles.map(a => {
    const [x,y] = toXY(a, r);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(99,102,241,0.2)" stroke-width="1"/>`;
  }).join('');

  // Data polygon
  const dataPoints = angles.map((a, i) => toXY(a, r * values[i]).join(',')).join(' ');

  // Labels
  const labelEls = angles.map((a, i) => {
    const [x, y] = toXY(a, r + 22);
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="#94a3b8" font-size="10" font-family="Inter" font-weight="600">${labels[i]}</text>`;
  }).join('');

  // Value dots
  const dots = angles.map((a, i) => {
    const [x,y] = toXY(a, r * values[i]);
    return `<circle cx="${x}" cy="${y}" r="4" fill="#6366f1"/>`;
  }).join('');

  el.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="max-width:100%">
      ${gridRings}${axes}
      <polygon points="${dataPoints}" fill="rgba(99,102,241,0.2)" stroke="#6366f1" stroke-width="2"/>
      ${dots}
      ${labelEls}
    </svg>
  `;
}

function renderRetentionChart(containerId, curveData) {
  const el = document.getElementById(containerId);
  if (!el || !curveData || curveData.length === 0) return;
  const W = el.clientWidth || 600, H = 180;
  const pad = { top: 16, right: 20, bottom: 30, left: 40 };
  const iW = W - pad.left - pad.right, iH = H - pad.top - pad.bottom;
  const maxDay = curveData[curveData.length-1]?.day || 21;

  const toX = d => pad.left + (d.day / maxDay) * iW;
  const toY = d => pad.top + (1 - d.retention / 100) * iH;

  const pathD = curveData.map((d,i) => `${i===0?'M':'L'}${toX(d)},${toY(d)}`).join(' ');
  const areaD = pathD + ` L${toX(curveData[curveData.length-1])},${pad.top + iH} L${pad.left},${pad.top + iH} Z`;

  // Grid lines
  const gridLines = [25,50,75,100].map(v => {
    const y = pad.top + (1 - v/100) * iH;
    return `<line x1="${pad.left}" y1="${y}" x2="${W-pad.right}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/><text x="${pad.left-5}" y="${y+4}" fill="#475569" font-size="9" text-anchor="end" font-family="Inter">${v}%</text>`;
  }).join('');

  // Day labels
  const dayLabels = [0,7,14,21].filter(d => d <= maxDay).map(d => {
    const x = pad.left + (d / maxDay) * iW;
    return `<text x="${x}" y="${H-8}" fill="#475569" font-size="9" text-anchor="middle" font-family="Inter">Day ${d}</text>`;
  }).join('');

  // Danger zone
  const dangerY = pad.top + (1 - 0.65) * iH;

  el.innerHTML = `
    <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="retGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#6366f1;stop-opacity:0.4"/>
          <stop offset="100%" style="stop-color:#6366f1;stop-opacity:0.02"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <line x1="${pad.left}" y1="${dangerY}" x2="${W-pad.right}" y2="${dangerY}" stroke="rgba(239,68,68,0.4)" stroke-width="1" stroke-dasharray="4,4"/>
      <text x="${W-pad.right-2}" y="${dangerY-4}" fill="rgba(239,68,68,0.7)" font-size="8" text-anchor="end" font-family="Inter">Danger Zone</text>
      <path d="${areaD}" fill="url(#retGrad)"/>
      <path d="${pathD}" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${dayLabels}
    </svg>
  `;
}

function renderSimChart(containerId, scenarios, days) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const W = el.clientWidth || 700, H = 260;
  const pad = { top: 20, right: 20, bottom: 40, left: 50 };
  const iW = W - pad.left - pad.right, iH = H - pad.top - pad.bottom;

  const toX = d => pad.left + (d / days) * iW;
  const toY = v => pad.top + (1 - v / 100) * iH;

  const lines = [
    { data: scenarios.no_study.trajectory, color: '#ef4444', label: 'No Study' },
    { data: scenarios.worst_case.trajectory, color: '#f97316', label: 'Worst Case' },
    { data: scenarios.expected.trajectory, color: '#6366f1', label: 'Expected' },
    { data: scenarios.best_case.trajectory, color: '#10b981', label: 'Best Case' },
  ];

  const paths = lines.map(line => {
    const d = line.data.map((p,i) => `${i===0?'M':'L'}${toX(p.day)},${toY(p.mastery)}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${line.color}" stroke-width="${line.color === '#6366f1' ? 2.5 : 1.5}" stroke-dasharray="${line.color === '#6366f1' ? 'none' : '5,3'}"/>`;
  }).join('');

  const gridLines = [25,50,75,100].map(v => {
    const y = toY(v);
    return `<line x1="${pad.left}" y1="${y}" x2="${W-pad.right}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/><text x="${pad.left-5}" y="${y+4}" fill="#475569" font-size="9" text-anchor="end" font-family="Inter">${v}%</text>`;
  }).join('');

  const dayLabels = [0, Math.floor(days/4), Math.floor(days/2), Math.floor(days*3/4), days].map(d => {
    const x = toX(d);
    return `<text x="${x}" y="${H-10}" fill="#475569" font-size="9" text-anchor="middle" font-family="Inter">Day ${d}</text>`;
  }).join('');

  const legend = lines.map((l, i) => `
    <g transform="translate(${60 + i * 110}, 10)">
      <line x1="0" y1="5" x2="18" y2="5" stroke="${l.color}" stroke-width="2" stroke-dasharray="${l.color === '#6366f1' ? 'none' : '5,3'}"/>
      <text x="22" y="9" fill="#94a3b8" font-size="9" font-family="Inter">${l.label}</text>
    </g>
  `).join('');

  el.innerHTML = `
    <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      ${gridLines}${paths}${dayLabels}
      <g transform="translate(${pad.left}, 0)">${legend}</g>
    </svg>
  `;
}

// ── Utilities ──────────────────────────────
function statCard(icon, label, value, type) {
  return `
    <div class="stat-card ${type}">
      <div class="stat-icon ${type}">${icon}</div>
      <div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>
  `;
}

function metaTile(icon, label, value) {
  return `
    <div style="background:var(--color-surface-2);border-radius:var(--radius-md);padding:12px;text-align:center;">
      <div style="font-size:1.2rem;margin-bottom:4px;">${icon}</div>
      <div style="font-size:0.7rem;color:#64748b;margin-bottom:2px;">${label}</div>
      <div style="font-size:0.875rem;font-weight:700;">${value}</div>
    </div>
  `;
}

function miniStat(icon, label, value) {
  return `
    <div style="background:var(--color-surface-2);border-radius:var(--radius-sm);padding:8px;text-align:center;">
      <div>${icon} <strong>${value}</strong></div>
      <div class="text-xs text-muted">${label}</div>
    </div>
  `;
}

function avgMastery(kg) {
  if (!kg) return 0;
  const vals = Object.values(kg);
  return round(vals.reduce((a,b) => a + (typeof b === 'object' ? b.mastery || 0 : b), 0) / vals.length * 100);
}

function conceptById(id, data) {
  const kg = data.knowledge_graph;
  if (!kg) return null;
  const c = kg[id];
  return c && typeof c === 'object' ? c : null;
}

function masteryLabel(m) {
  if (m >= 0.85) return 'Mastered';
  if (m >= 0.65) return 'Proficient';
  if (m >= 0.40) return 'Developing';
  if (m >= 0.20) return 'Emerging';
  return 'Novice';
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function round(n, d = 1) { return Math.round(n * Math.pow(10, d)) / Math.pow(10, d); }

function timeAgo(isoStr) {
  if (!isoStr) return 'recently';
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

// ── Particles ──────────────────────────────
function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const x = Math.random() * 100;
    const delay = Math.random() * 10;
    const duration = 8 + Math.random() * 12;
    const drift = (Math.random() - 0.5) * 200;
    p.style.cssText = `left:${x}%;animation-delay:${delay}s;animation-duration:${duration}s;--drift:${drift}px;opacity:0;`;
    container.appendChild(p);
  }
}

// ── Init ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initParticles();

  // Restore session
  if (state.token && state.user) {
    showApp();
  } else {
    navigate('landing');
  }

  // Login form
  document.getElementById('login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    await login(email, password);
  });

  // Register form
  document.getElementById('register-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const name = document.getElementById('reg-name').value;
    const role = document.getElementById('reg-role').value;
    const password = document.getElementById('reg-password').value;
    await register(email, name, role, password);
  });
});

// Expose functions globally for inline HTML handlers
window.navigate = navigate;
window.fillDemo = fillDemo;
window.switchAuthTab = switchAuthTab;
window.scrollToFeatures = scrollToFeatures;
window.logout = logout;
window.startQuiz = startQuiz;
window.runSimulation = runSimulation;

/* ============================================
SISTEMA DE DIÁLOGOS CUSTOMIZADOS
============================================ */
function showDialog({type='info', title='', text='', input=false, inputPlaceholder='', defaultValue='', confirmText='OK', cancelText='Cancelar', showCancel=true}) {
return new Promise((resolve) => {
const icons = { info:'ℹ️', success:'✓', warning:'️', danger:'✕', question:'?' };
const overlay = document.getElementById('dialog-overlay');
const content = document.getElementById('dialog-content');
content.innerHTML = `
<div class="dialog-icon ${type}">${icons[type]||'ℹ️'}</div>
<div class="dialog-title">${title}</div>
${text ? `<div class="dialog-text">${text}</div>` : ''}
${input ? `<input type="text" class="dialog-input" id="dialog-input" placeholder="${inputPlaceholder}" value="${defaultValue}">` : ''}
<div class="dialog-actions">
${showCancel ? `<button class="btn btn-secondary" id="dialog-cancel">${cancelText}</button>` : ''}
<button class="btn btn-primary" id="dialog-confirm">${confirmText}</button>
</div>
`;
overlay.classList.add('active');
const inputEl = document.getElementById('dialog-input');
if (input && inputEl) { inputEl.focus(); inputEl.select(); }
const close = (val) => { overlay.classList.remove('active'); resolve(val); };
document.getElementById('dialog-confirm').onclick = () => close(input ? (inputEl?.value || '') : true);
const cancelBtn = document.getElementById('dialog-cancel');
if (cancelBtn) cancelBtn.onclick = () => close(false);
if (input && inputEl) inputEl.addEventListener('keydown', e => { if (e.key==='Enter') close(inputEl.value); });
});
}
const UI = {
alert: (title, text, type='info') => showDialog({type, title, text, showCancel:false}),
confirm: (title, text, type='question') => showDialog({type, title, text, confirmText:'Confirmar', cancelText:'Cancelar'}),
prompt: (title, text, placeholder='', defaultValue='') => showDialog({type:'info', title, text, input:true, inputPlaceholder:placeholder, defaultValue, confirmText:'OK'}),
success: (title, text) => showDialog({type:'success', title, text, showCancel:false}),
error: (title, text) => showDialog({type:'danger', title, text, showCancel:false, confirmText:'Entendi'}),
warning: (title, text) => showDialog({type:'warning', title, text, showCancel:false}),
};
function openModal(id) {
if(id === 'add-assessment-modal') {
document.getElementById('assess-date').valueAsDate = new Date();
populateStudentSelects();
}
if(id === 'add-transaction-modal') {
document.getElementById('trans-due').valueAsDate = new Date();
populateStudentSelects();
}
document.getElementById(id).classList.add('active');
}
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
document.getElementById('generic-modal').addEventListener('click', e => { if (e.target.id==='generic-modal') closeModal('generic-modal'); });
/* ============================================
ESTADO & MOCK DATA
============================================ */
const DB_KEY = 'fitpro_db_v5';
let db = null;
let currentDay = new Date().getDay();
let editingExerciseId = null;
let progressChart = null, weightChart = null;
let timerInterval = null, timerPaused = false, timerSeconds = 0, timerTotal = 0, workoutStart = null;
let quickTimerInterval = null, quickTimerSeconds = 60, quickTimerTotal = 60, quickTimerRunning = false;
let libFilter = 'all';
let calendarDate = new Date();
let workoutMode = 'plan';
let currentExecution = null;
let clipboardExercise = null;
const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DAYS_FULL = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DEFAULT_WORKOUTS = {
1:[{name:'Supino Reto',sets:4,reps:10,weight:30,rest:90,focus:'Peito'},{name:'Crucifixo',sets:3,reps:12,weight:12,rest:60,focus:'Peito'}],
2:[{name:'Agachamento',sets:4,reps:8,weight:40,rest:120,focus:'Perna'}],
3:[{name:'Puxada Frontal',sets:4,reps:10,weight:35,rest:90,focus:'Costas'}],
};
const ACHIEVEMENTS = [
{id:'first',name:'Primeiro Passo',desc:'Complete seu primeiro treino',icon:'',check:u=>u.stats.workouts>=1},
{id:'streak3',name:'Em chamas',desc:'3 dias seguidos',icon:'🔥',check:u=>u.stats.streak>=3},
{id:'streak7',name:'Semana perfeita',desc:'7 dias seguidos',icon:'⭐',check:u=>u.stats.streak>=7},
{id:'xp500',name:'Veterano',desc:'500 XP',icon:'🏆',check:u=>u.xp>=500},
{id:'lvl5',name:'Nível 5',desc:'Alcance nível 5',icon:'🎖️',check:u=>u.level>=5},
{id:'workouts10',name:'Persistente',desc:'10 treinos',icon:'💪',check:u=>u.stats.workouts>=10},
];
const EXERCISE_LIBRARY = [
{name:'Supino Reto',focus:'Peito',muscles:'Peito maior, Tríceps'},
{name:'Supino Inclinado',focus:'Peito',muscles:'Peito superior'},
{name:'Crucifixo',focus:'Peito',muscles:'Peito maior'},
{name:'Crossover',focus:'Peito',muscles:'Peito maior'},
{name:'Flexão',focus:'Peito',muscles:'Peito, Tríceps'},
{name:'Puxada Frontal',focus:'Costas',muscles:'Dorsal'},
{name:'Remada Curvada',focus:'Costas',muscles:'Dorsal'},
{name:'Barra Fixa',focus:'Costas',muscles:'Dorsal, Bíceps'},
{name:'Levantamento Terra',focus:'Costas',muscles:'Posterior'},
{name:'Agachamento',focus:'Perna',muscles:'Quadríceps, Glúteo'},
{name:'Leg Press',focus:'Perna',muscles:'Quadríceps'},
{name:'Stiff',focus:'Perna',muscles:'Posterior'},
{name:'Avanço',focus:'Perna',muscles:'Quadríceps, Glúteo'},
{name:'Desenvolvimento',focus:'Ombro',muscles:'Deltóide'},
{name:'Elevação Lateral',focus:'Ombro',muscles:'Deltóide lateral'},
{name:'Rosca Direta',focus:'Braço',muscles:'Bíceps'},
{name:'Tríceps Corda',focus:'Braço',muscles:'Tríceps'},
{name:'Prancha',focus:'Core',muscles:'Abdômen'},
{name:'Abdominal',focus:'Core',muscles:'Reto abdominal'},
];
/* ============================================
PERSISTÊNCIA
============================================ */
function loadDB() {
const raw = localStorage.getItem(DB_KEY);
if (raw) db = JSON.parse(raw);
else {
db = { users:{}, currentUserId:null, theme:'dark', students:[], transactions:[], classes:[], accessLogs:[], assessments:[] };
db.students = [
{ id: 1, name: 'Carlos Silva', email: 'carlos@email.com', role: 'Aluno', plan: 'Plano Anual', validity: '2026-12-15', status: 'Ativo' },
{ id: 2, name: 'Ana Souza', email: 'ana@email.com', role: 'Aluno', plan: 'Plano Mensal', validity: '2026-11-10', status: 'Pendente' },
{ id: 3, name: 'Prof. Ricardo', email: 'ricardo@gym.com', role: 'Professor', plan: 'Staff', validity: 'Indefinido', status: 'Ativo' },
];
db.transactions = [
{ id: 1, student: 'Carlos Silva', desc: 'Mensalidade Novembro', due: '2026-11-10', value: 129.90, method: 'PIX', status: 'Pago' },
{ id: 2, student: 'Ana Souza', desc: 'Mensalidade Novembro', due: '2026-11-10', value: 89.90, method: 'Cartão', status: 'Pendente' },
];
db.classes = [
{ id: 1, day: 1, time: '07:00', name: 'CrossFit', instructor: 'Prof. Ricardo', capacity: 15, enrolled: 12 },
{ id: 2, day: 2, time: '07:00', name: 'Yoga', instructor: 'Profa. Julia', capacity: 15, enrolled: 8 },
{ id: 3, day: 1, time: '18:00', name: 'Musculação Guiada', instructor: 'Prof. Marcos', capacity: 25, enrolled: 20 },
{ id: 4, day: 2, time: '18:00', name: 'Spinning', instructor: 'Prof. Marcos', capacity: 20, enrolled: 15 },
];
db.accessLogs = [
{ time: '2026-11-10 18:32', student: 'Carlos Silva', method: 'QR Code', location: 'Catraca Principal', status: 'Autorizado' },
{ time: '2026-11-10 18:30', student: 'Ana Souza', method: 'Biometria', location: 'Catraca Principal', status: 'Autorizado' },
];
saveDB();
}
Object.values(db.users).forEach(u => {
if (!u.water) u.water = {};
if (!u.personalRecords) u.personalRecords = {};
if (!u.waterStreak) u.waterStreak = 0;
if (!u.notes) u.notes = {};
if (!u.workouts) u.workouts = {};
if (!u.nutritionPlan) u.nutritionPlan = null;
});
}
function saveDB() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function currentUser() { return db.users[db.currentUserId]; }
function saveUser() { saveDB(); }
/* ============================================
AUTH
============================================ */
function handleLogin() {
const email = document.getElementById('login-email').value.trim();
const pass = document.getElementById('login-password').value;
if (!email || !pass) return UI.warning('Campos obrigatórios', 'Preencha email e senha');
const user = Object.values(db.users).find(u => (u.email===email || u.name===email) && u.password===pass);
if (!user) return UI.error('Erro no login', 'Email ou senha incorretos');
db.currentUserId = user.id; saveDB(); enterApp();
}
function handleRegister() {
const name = document.getElementById('reg-name').value.trim();
const email = document.getElementById('reg-email').value.trim();
const pass = document.getElementById('reg-password').value;
if (!name || !email || pass.length<4) return UI.warning('Dados inválidos', 'Preencha todos os campos (senha mín. 4)');
if (Object.values(db.users).some(u=>u.email===email)) return UI.error('Email em uso', 'Este email já está cadastrado');
const id = 'u_'+Date.now();
db.users[id] = {
id, name, email, password:pass,
workouts: JSON.parse(JSON.stringify(DEFAULT_WORKOUTS)),
meals:{}, history:[],
profile:{weight:null,height:null,age:null,goal:'maintenance',goalCal:2000,goalProt:120,goalCarb:250,goalFat:70},
xp:0, level:1,
stats:{workouts:0,streak:0,lastWorkout:null,mins:0,weightHistory:[]},
achievements:[], notifications:[],
water:{}, waterStreak:0, personalRecords:{}, notes:{}, nutritionPlan: null,
createdAt: Date.now()
};
db.currentUserId = id; saveDB(); enterApp();
UI.success('Bem-vindo! 🎉', 'Sua conta foi criada com sucesso');
}
function logoutConfirm() {
UI.confirm('Sair da conta?', 'Você precisará fazer login novamente para acessar seus dados.').then(ok => {
if (!ok) return;
db.currentUserId = null; saveDB(); location.reload();
});
}
function showRegister() { document.getElementById('login-form').style.display='none'; document.getElementById('register-form').style.display='block'; }
function showLogin() { document.getElementById('login-form').style.display='block'; document.getElementById('register-form').style.display='none'; }
function enterApp() {
document.getElementById('login-screen').classList.remove('active');
document.getElementById('login-screen').style.display='none';
document.getElementById('sidebar').style.display='flex';
document.getElementById('main').style.display='flex';
document.getElementById('bottom-nav').style.display='flex';
applyTheme(); checkStreak(); generateNotifications(); updateSidebar(); navigate('home');
}
function updateSidebar() {
const u = currentUser();
document.getElementById('sb-avatar').textContent = u.name[0].toUpperCase();
document.getElementById('sb-name').textContent = u.name;
document.getElementById('sb-level').textContent = 'Nível ' + u.level;
}
/* ============================================
NAVEGAÇÃO
============================================ */
const TITLES = {
home:'Dashboard', workouts:'Meus Treinos', diet:'Dieta', progress:'Progresso', tools:'Ferramentas',
library:'Biblioteca', profile:'Perfil', students:'Alunos & Planos', financial:'Financeiro',
schedule:'Grade & Aulas', access:'Logs de Acesso', assessments:'Avaliações Físicas', nutrition: 'Nutrição Inteligente'
};
function navigate(screen) {
document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
document.getElementById(screen+'-screen').classList.add('active');
document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
document.querySelector(`.nav-item[data-screen="${screen}"]`)?.classList.add('active');
document.querySelectorAll('.sidebar .nav-link').forEach(n=>n.classList.remove('active'));
document.querySelector(`.sidebar .nav-link[data-screen="${screen}"]`)?.classList.add('active');
document.getElementById('top-title').textContent = TITLES[screen] || 'FitPro';
document.getElementById('top-sub').textContent = getGreeting() + ', ' + currentUser().name.split(' ')[0];
const renderers = {
home:renderDashboard, workouts:renderWorkouts, diet:renderDiet, progress:renderProgress,
tools:renderTools, library:renderLibrary, profile:renderProfile, nutrition:renderNutrition,
students:renderStudents, financial:renderFinancial, access:renderAccess, schedule:renderSchedule, assessments:renderAssessments
};
if (renderers[screen]) renderers[screen]();
document.querySelector('.content').scrollTo(0,0);
}
function getGreeting() { const h = new Date().getHours(); if (h<12) return 'Bom dia ☀️'; if (h<18) return 'Boa tarde 🌤️'; return 'Boa noite 🌙'; }
/* ============================================
TEMA
============================================ */
function applyTheme() {
if (db.theme==='light') document.documentElement.setAttribute('data-theme','light');
else document.documentElement.removeAttribute('data-theme');
}
function toggleTheme() { db.theme = db.theme==='light' ? 'dark' : 'light'; saveDB(); applyTheme(); }
/* ============================================
DASHBOARD
============================================ */
function renderDashboard() {
const u = currentUser();
document.getElementById('streak-count').textContent = u.stats.streak;
document.getElementById('stat-workouts').textContent = u.stats.workouts;
document.getElementById('stat-xp').textContent = u.xp;
document.getElementById('stat-level').textContent = 'Nível ' + u.level;
document.getElementById('stat-mins').textContent = u.stats.mins;
const meals = getTodayMeals();
const calConsumed = meals.reduce((s,m)=>s+(+m.cal||0),0);
const pct = Math.round((calConsumed/(u.profile.goalCal||2000))*100);
document.getElementById('stat-goal').textContent = Math.min(pct,100)+'%';
const todayWater = getTodayWater();
document.getElementById('home-water-count').textContent = todayWater;
document.getElementById('home-water-bar').style.width = Math.min((todayWater/8)*100,100)+'%';
const todayEx = u.workouts[currentDay] || [];
const todayDiv = document.getElementById('today-workout');
if (todayEx.length===0) {
todayDiv.innerHTML = `<div class="card"><div class="empty"><div class="ic">😴</div><div>Descanso hoje<br><small class="text-muted">Use o 🧠 para sugerir um treino</small></div></div></div>`;
} else {
todayDiv.innerHTML = todayEx.slice(0,4).map(ex=>`<div class="exercise-card"><div class="exercise-icon">${getIcon(ex.focus)}</div><div class="exercise-info"><div class="name">${ex.name}</div><div class="meta">${ex.sets}×${ex.reps} · ${ex.weight}kg</div></div><span class="chip primary">${ex.focus}</span></div>`).join('');
}
renderHomePRs();
renderAchievements('achievements-preview', 3);
renderProgressChart();
}
function renderHomePRs() {
const u = currentUser();
const prs = Object.entries(u.personalRecords||{}).slice(0,3);
const div = document.getElementById('home-prs');
if (prs.length===0) { div.innerHTML = `<div class="card"><div class="empty" style="padding:20px;"><div class="ic"></div><div>Nenhum recorde ainda</div></div></div>`; return; }
div.innerHTML = prs.map(([name,pr])=>`<div class="pr-card"><div class="pr-icon">🏆</div><div class="pr-info"><div class="ex-name">${name}</div><div class="ex-date">${new Date(pr.date).toLocaleDateString('pt-BR')}</div></div><div class="pr-value">${pr.weight}kg</div></div>`).join('');
}
function renderProgressChart() {
const u = currentUser();
const hist = (u.stats.weightHistory||[]).slice(-14);
const labels = hist.map(h=>new Date(h.date).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
const data = hist.map(h=>h.weight);
const ctx = document.getElementById('progressChart');
if (!ctx) return;
if (progressChart) progressChart.destroy();
const color = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
const text2 = getComputedStyle(document.documentElement).getPropertyValue('--text-2').trim();
progressChart = new Chart(ctx, { type:'line', data:{labels:labels.length?labels:['Sem dados'], datasets:[{label:'Peso',data:data.length?data:[0],borderColor:color,backgroundColor:color+'33',tension:0.4,fill:true,pointRadius:4}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:text2},grid:{display:false}},y:{ticks:{color:text2},grid:{color:'rgba(128,128,128,0.1)'}}}}});
}
/* ============================================
WORKOUTS - PRO
============================================ */
function renderWorkouts() {
const u = currentUser();
document.getElementById('day-tabs').innerHTML = DAYS.map((d,i)=>{
const has = (u.workouts[i] && u.workouts[i].length>0);
return `<div class="day-tab ${i===currentDay?'active':''} ${has?'has-workout':''}" onclick="selectDay(${i})"><div class="d">${d}</div><div class="n">${String(i).padStart(2,'0')}</div></div>`;
}).join('');
if (workoutMode==='plan') renderPlanMode();
else if (workoutMode==='exec') renderExecMode();
else if (workoutMode==='hist') renderHistoryMode();
}
function selectDay(d) { currentDay = d; renderWorkouts(); }
function switchWorkoutMode(mode, btn) {
workoutMode = mode;
document.querySelectorAll('.workout-mode-btn').forEach(b=>b.classList.remove('active'));
btn.classList.add('active');
document.getElementById('workout-plan-mode').style.display = mode==='plan'?'block':'none';
document.getElementById('workout-exec-mode').style.display = mode==='exec'?'block':'none';
document.getElementById('workout-hist-mode').style.display = mode==='hist'?'block':'none';
if (mode==='plan') renderPlanMode();
else if (mode==='exec') renderExecMode();
else if (mode==='hist') renderHistoryMode();
}
function renderPlanMode() {
const u = currentUser();
const list = u.workouts[currentDay] || [];
const div = document.getElementById('exercises-list');
if (list.length===0) {
div.innerHTML = `<div class="card"><div class="empty"><div class="ic">📝</div><div>Nenhum exercício para ${DAYS_FULL[currentDay]}<br><small class="text-muted">Adicione um para começar</small></div></div></div>`;
} else {
const totalVol = list.reduce((s,e)=>s+(e.sets*e.reps*e.weight),0);
const totalTime = list.reduce((s,e)=>s+(e.sets*e.rest),0);
const summary = `<div class="card" style="margin-bottom:14px; background:linear-gradient(135deg,rgba(0,230,118,0.08),rgba(0,200,83,0.02));">
<div class="flex-between"><div><div class="text-xs text-muted">RESUMO DO TREINO</div><div style="font-size:18px; font-weight:800; margin-top:4px;">${list.length} exercícios · ${list.reduce((s,e)=>s+e.sets,0)} séries</div></div></div>
<div class="grid-3 mt-3">
<div><div class="text-xs text-muted">Volume</div><div style="font-weight:700; font-size:15px;">${totalVol.toLocaleString('pt-BR')}kg</div></div>
<div><div class="text-xs text-muted">Descanso</div><div style="font-weight:700; font-size:15px;">${Math.round(totalTime/60)}min</div></div>
<div><div class="text-xs text-muted">Tempo est.</div><div style="font-weight:700; font-size:15px;">${Math.round(totalTime/60 + list.length*3)}min</div></div>
</div>
</div>`;
div.innerHTML = summary + list.map((ex,i)=>renderPlanCard(ex,i)).join('');
}
renderDayNotes();
}
function renderPlanCard(ex, i) {
return `<div class="plan-card" id="plan-card-${i}">
<div class="plan-card-header" onclick="togglePlanCard(${i})">
<div class="exercise-icon">${getIcon(ex.focus)}</div>
<div class="info">
<div class="name">${ex.name} ${ex.superset?`<span class="chip purple">Superset ${ex.superset}</span>`:''}</div>
<div class="meta">${ex.sets}×${ex.reps} · ${ex.weight}kg · ⏱️${ex.rest}s</div>
</div>
<div class="actions"><span class="chip primary" style="margin-right:4px;">${ex.focus}</span></div>
</div>
<div class="plan-card-body">
<div class="row">
<div class="input-group"><label>Séries</label><input type="number" value="${ex.sets}" onchange="updateExercise(${i},'sets',this.value)" min="1"></div>
<div class="input-group"><label>Reps</label><input type="number" value="${ex.reps}" onchange="updateExercise(${i},'reps',this.value)" min="1"></div>
</div>
<div class="row">
<div class="input-group"><label>Peso (kg)</label><input type="number" value="${ex.weight}" onchange="updateExercise(${i},'weight',this.value)" min="0" step="0.5"></div>
<div class="input-group"><label>Descanso (s)</label><input type="number" value="${ex.rest}" onchange="updateExercise(${i},'rest',this.value)" min="10"></div>
</div>
<div class="input-group"><label>Foco</label>
<select onchange="updateExercise(${i},'focus',this.value)">
${['Peito','Costas','Perna','Ombro','Bíceps','Tríceps','Core','Cardio','Full Body'].map(f=>`<option ${ex.focus===f?'selected':''}>${f}</option>`).join('')}
</select>
</div>
<div class="input-group"><label>Notas (opcional)</label><textarea rows="2" onchange="updateExercise(${i},'note',this.value)" placeholder="Ex: pegar mais pesado na última">${ex.note||''}</textarea></div>
<div class="row">
<button class="btn btn-sm btn-secondary" onclick="moveExercise(${i},-1)" ${i===0?'disabled':''}>↑ Subir</button>
<button class="btn btn-sm btn-secondary" onclick="moveExercise(${i},1)">↓ Descer</button>
<button class="btn btn-sm btn-secondary" onclick="copyExercise(${i})">📋 Copiar</button>
</div>
<div class="row mt-2">
<button class="btn btn-sm btn-secondary" onclick="openEditExercise(${i})">✏️ Editar</button>
<button class="btn btn-sm btn-danger" onclick="confirmDeleteExercise(${i})">️ Excluir</button>
</div>
</div>
</div>`;
}
function togglePlanCard(i) { document.getElementById('plan-card-'+i).classList.toggle('open'); }
function updateExercise(i, field, value) {
const u = currentUser();
const ex = u.workouts[currentDay][i];
if (['sets','reps','weight','rest'].includes(field)) value = +value;
ex[field] = value;
saveUser();
if (field !== 'note') {
const wasOpen = document.getElementById('plan-card-'+i).classList.contains('open');
renderPlanMode();
if (wasOpen) document.getElementById('plan-card-'+i).classList.add('open');
}
}
function moveExercise(i, dir) {
const u = currentUser();
const list = u.workouts[currentDay];
const j = i + dir;
if (j<0 || j>=list.length) return;
[list[i],list[j]] = [list[j],list[i]];
saveUser(); renderPlanMode();
}
function copyExercise(i) {
clipboardExercise = JSON.parse(JSON.stringify(currentUser().workouts[currentDay][i]));
toast('Exercício copiado! 📋', 'success');
}
function confirmDeleteExercise(i) {
const ex = currentUser().workouts[currentDay][i];
UI.confirm('Excluir exercício?', `Deseja realmente excluir "${ex.name}"?`, 'danger').then(ok => {
if (!ok) return;
currentUser().workouts[currentDay].splice(i,1);
saveUser(); renderPlanMode();
toast('Exercício excluído', 'info');
});
}
function openEditExercise(i) {
editingExerciseId = i;
const ex = currentUser().workouts[currentDay][i];
openModal('generic-modal');
document.getElementById('generic-modal-content').innerHTML = `
<div class="modal-header"><h2>Editar Exercício</h2><button class="close-btn" onclick="closeModal('generic-modal')">✕</button></div>
<div class="input-group"><label>Nome</label><input type="text" id="ex-name" value="${ex.name}"></div>
<div class="row">
<div class="input-group"><label>Séries</label><input type="number" id="ex-sets" value="${ex.sets}" min="1"></div>
<div class="input-group"><label>Reps</label><input type="number" id="ex-reps" value="${ex.reps}" min="1"></div>
</div>
<div class="row">
<div class="input-group"><label>Peso (kg)</label><input type="number" id="ex-weight" value="${ex.weight}" min="0" step="0.5"></div>
<div class="input-group"><label>Descanso (s)</label><input type="number" id="ex-rest" value="${ex.rest}" min="10"></div>
</div>
<div class="input-group"><label>Foco muscular</label>
<select id="ex-focus">${['Peito','Costas','Perna','Ombro','Bíceps','Tríceps','Core','Cardio','Full Body'].map(f=>`<option ${ex.focus===f?'selected':''}>${f}</option>`).join('')}</select>
</div>
<button class="btn btn-primary btn-block" onclick="saveExercise()">Salvar</button>
`;
}
function openExerciseModal() {
editingExerciseId = null;
openModal('generic-modal');
document.getElementById('generic-modal-content').innerHTML = `
<div class="modal-header"><h2>Novo Exercício</h2><button class="close-btn" onclick="closeModal('generic-modal')">✕</button></div>
<div class="input-group"><label>Nome</label><input type="text" id="ex-name" placeholder="Ex: Supino Reto"></div>
<div class="row">
<div class="input-group"><label>Séries</label><input type="number" id="ex-sets" value="3" min="1"></div>
<div class="input-group"><label>Reps</label><input type="number" id="ex-reps" value="10" min="1"></div>
</div>
<div class="row">
<div class="input-group"><label>Peso (kg)</label><input type="number" id="ex-weight" value="0" min="0" step="0.5"></div>
<div class="input-group"><label>Descanso (s)</label><input type="number" id="ex-rest" value="60" min="10"></div>
</div>
<div class="input-group"><label>Foco muscular</label>
<select id="ex-focus">${['Peito','Costas','Perna','Ombro','Bíceps','Tríceps','Core','Cardio','Full Body'].map(f=>`<option>${f}</option>`).join('')}</select>
</div>
<button class="btn btn-primary btn-block" onclick="saveExercise()">Adicionar ao treino</button>
`;
}
function saveExercise() {
const u = currentUser();
const ex = {
name:document.getElementById('ex-name').value.trim(),
sets:+document.getElementById('ex-sets').value,
reps:+document.getElementById('ex-reps').value,
weight:+document.getElementById('ex-weight').value,
rest:+document.getElementById('ex-rest').value,
focus:document.getElementById('ex-focus').value,
};
if (!ex.name) return UI.warning('Nome obrigatório', 'Informe o nome do exercício');
if (!u.workouts[currentDay]) u.workouts[currentDay] = [];
if (editingExerciseId!==null) u.workouts[currentDay][editingExerciseId] = ex;
else u.workouts[currentDay].push(ex);
saveUser(); closeModal('generic-modal'); renderPlanMode();
toast('Exercício salvo! ✅', 'success');
}
function openDayMenu() {
const u = currentUser();
const hasEx = (u.workouts[currentDay]||[]).length > 0;
openModal('generic-modal');
document.getElementById('generic-modal-content').innerHTML = `
<div class="modal-header"><h2>⋯ Ações de ${DAYS_FULL[currentDay]}</h2><button class="close-btn" onclick="closeModal('generic-modal')">✕</button></div>
<button class="btn btn-secondary btn-block" onclick="pasteToDay()" ${!clipboardExercise?'disabled':''}>📋 Colar exercício aqui ${clipboardExercise?'('+clipboardExercise.name+')':''}</button>
<button class="btn btn-secondary btn-block mt-2" onclick="copyDayToAnother()" ${!hasEx?'disabled':''}>📤 Copiar treino para outro dia</button>
<button class="btn btn-secondary btn-block mt-2" onclick="duplicateDay()">📑 Duplicar para amanhã</button>
<button class="btn btn-secondary btn-block mt-2" onclick="useTemplate()">📚 Usar template pronto</button>
<button class="btn btn-danger btn-block mt-4" onclick="clearDayConfirm()" ${!hasEx?'disabled':''}>🗑️ Limpar dia</button>
`;
}
function pasteToDay() {
if (!clipboardExercise) return;
const u = currentUser();
if (!u.workouts[currentDay]) u.workouts[currentDay] = [];
u.workouts[currentDay].push(JSON.parse(JSON.stringify(clipboardExercise)));
saveUser(); closeModal('generic-modal'); renderPlanMode();
toast('Exercício colado!', 'success');
}
function copyDayToAnother() {
const u = currentUser();
const opts = DAYS.map((d,i)=>i!==currentDay && (u.workouts[i]||[]).length >= 0 ? `<button class="btn btn-secondary btn-block mt-2" onclick="doCopyDay(${i})">${d} — ${DAYS_FULL[i]}</button>` : '').join('');
openModal('generic-modal');
document.getElementById('generic-modal-content').innerHTML = `
<div class="modal-header"><h2>Copiar para qual dia?</h2><button class="close-btn" onclick="closeModal('generic-modal')">✕</button></div>
<p class="text-sm text-muted mb-3">O treino de ${DAYS_FULL[currentDay]} será copiado para o dia escolhido.</p>
${opts}
`;
}
function doCopyDay(target) {
const u = currentUser();
u.workouts[target] = JSON.parse(JSON.stringify(u.workouts[currentDay]||[]));
saveUser(); closeModal('generic-modal');
UI.success('Copiado!', `Treino copiado para ${DAYS_FULL[target]}`);
}
function duplicateDay() {
const u = currentUser();
const next = (currentDay+1) % 7;
u.workouts[next] = JSON.parse(JSON.stringify(u.workouts[currentDay]||[]));
saveUser(); closeModal('generic-modal');
UI.success('Duplicado!', `Treino duplicado para ${DAYS_FULL[next]}`);
}
function useTemplate() {
const templates = {
'push': { name:'Push (Peito/Ombro/Tríceps)', exs:[
{name:'Supino Reto',sets:4,reps:8,weight:0,rest:120,focus:'Peito'},
{name:'Supino Inclinado',sets:3,reps:10,weight:0,rest:90,focus:'Peito'},
{name:'Desenvolvimento',sets:4,reps:10,weight:0,rest:90,focus:'Ombro'},
{name:'Elevação Lateral',sets:3,reps:15,weight:0,rest:60,focus:'Ombro'},
{name:'Tríceps Corda',sets:3,reps:12,weight:0,rest:60,focus:'Tríceps'},
]},
'pull': { name:'Pull (Costas/Bíceps)', exs:[
{name:'Barra Fixa',sets:4,reps:8,weight:0,rest:120,focus:'Costas'},
{name:'Remada Curvada',sets:4,reps:10,weight:0,rest:90,focus:'Costas'},
{name:'Puxada Frontal',sets:3,reps:12,weight:0,rest:90,focus:'Costas'},
{name:'Rosca Direta',sets:3,reps:12,weight:0,rest:60,focus:'Bíceps'},
{name:'Rosca Martelo',sets:3,reps:12,weight:0,rest:60,focus:'Bíceps'},
]},
'legs': { name:'Legs (Perna)', exs:[
{name:'Agachamento',sets:4,reps:8,weight:0,rest:120,focus:'Perna'},
{name:'Leg Press',sets:4,reps:10,weight:0,rest:90,focus:'Perna'},
{name:'Stiff',sets:3,reps:12,weight:0,rest:90,focus:'Perna'},
{name:'Cadeira Extensora',sets:3,reps:15,weight:0,rest:60,focus:'Perna'},
{name:'Panturrilha',sets:4,reps:15,weight:0,rest:60,focus:'Perna'},
]},
'full': { name:'Full Body', exs:[
{name:'Agachamento',sets:3,reps:10,weight:0,rest:90,focus:'Perna'},
{name:'Supino Reto',sets:3,reps:10,weight:0,rest:90,focus:'Peito'},
{name:'Remada',sets:3,reps:10,weight:0,rest:90,focus:'Costas'},
{name:'Desenvolvimento',sets:3,reps:10,weight:0,rest:60,focus:'Ombro'},
{name:'Prancha',sets:3,reps:30,weight:0,rest:60,focus:'Core'},
]},
};
const list = Object.entries(templates).map(([k,t])=>`<button class="btn btn-secondary btn-block mt-2" onclick="applyTemplate('${k}')">💪 ${t.name}</button>`).join('');
openModal('generic-modal');
document.getElementById('generic-modal-content').innerHTML = `
<div class="modal-header"><h2>📚 Templates prontos</h2><button class="close-btn" onclick="closeModal('generic-modal')">✕</button></div>
<p class="text-sm text-muted mb-3">Escolha um template. O treino atual de ${DAYS_FULL[currentDay]} será substituído.</p>
${list}
`;
window._templates = templates;
}
function applyTemplate(key) {
UI.confirm('Substituir treino?', `O treino de ${DAYS_FULL[currentDay]} será substituído pelo template.`, 'warning').then(ok => {
if (!ok) return;
const u = currentUser();
u.workouts[currentDay] = JSON.parse(JSON.stringify(window._templates[key].exs));
saveUser(); closeModal('generic-modal'); renderPlanMode();
toast('Template aplicado! 🚀', 'success');
});
}
function clearDayConfirm() {
UI.confirm('Limpar treino?', `Todos os exercícios de ${DAYS_FULL[currentDay]} serão removidos.`, 'danger').then(ok => {
if (!ok) return;
currentUser().workouts[currentDay] = [];
saveUser(); closeModal('generic-modal'); renderPlanMode();
toast('Treino limpo', 'info');
});
}
function openLibraryPicker() {
const list = EXERCISE_LIBRARY.map(ex=>`
<div class="plan-card" style="margin-bottom:6px;">
<div class="plan-card-header" style="cursor:pointer; padding:10px 12px;" onclick="addFromLib('${ex.name}','${ex.focus}')">
<div class="exercise-icon" style="width:36px; height:36px; font-size:16px;">${getIcon(ex.focus)}</div>
<div class="info"><div class="name" style="font-size:14px;">${ex.name}</div><div class="meta">${ex.muscles}</div></div>
<button class="btn btn-sm btn-primary">+</button>
</div>
</div>`).join('');
openModal('generic-modal');
document.getElementById('generic-modal-content').innerHTML = `
<div class="modal-header"><h2>📚 Biblioteca</h2><button class="close-btn" onclick="closeModal('generic-modal')">✕</button></div>
<input type="text" class="dialog-input" placeholder="🔍 Buscar..." oninput="filterLibModal(this.value)" id="lib-modal-search">
<div id="lib-modal-list" style="max-height:400px; overflow-y:auto;">${list}</div>
`;
}
function filterLibModal(q) {
q = q.toLowerCase();
const list = EXERCISE_LIBRARY.filter(ex => ex.name.toLowerCase().includes(q) || ex.muscles.toLowerCase().includes(q));
document.getElementById('lib-modal-list').innerHTML = list.map(ex=>`
<div class="plan-card" style="margin-bottom:6px;">
<div class="plan-card-header" style="cursor:pointer; padding:10px 12px;" onclick="addFromLib('${ex.name}','${ex.focus}')">
<div class="exercise-icon" style="width:36px; height:36px; font-size:16px;">${getIcon(ex.focus)}</div>
<div class="info"><div class="name" style="font-size:14px;">${ex.name}</div><div class="meta">${ex.muscles}</div></div>
<button class="btn btn-sm btn-primary">+</button>
</div>
</div>`).join('');
}
function addFromLib(name, focus) {
const u = currentUser();
if (!u.workouts[currentDay]) u.workouts[currentDay] = [];
u.workouts[currentDay].push({name, sets:3, reps:10, weight:0, rest:60, focus});
saveUser(); closeModal('generic-modal'); renderPlanMode();
toast(`${name} adicionado!`, 'success');
}
function renderExecMode() {
const u = currentUser();
const exs = u.workouts[currentDay] || [];
const div = document.getElementById('exec-content');
if (exs.length===0) {
div.innerHTML = `<div class="card"><div class="empty"><div class="ic">📝</div><div>Nenhum exercício para executar<br><small class="text-muted">Vá para o modo Planejamento e adicione exercícios</small></div></div><button class="btn btn-primary btn-block" onclick="switchToPlan()">Ir para Planejamento</button></div>`;
return;
}
if (!currentExecution || currentExecution.day !== currentDay) {
currentExecution = {
day: currentDay,
startTime: Date.now(),
exercises: exs.map(ex => ({
...ex,
setsLog: Array.from({length:ex.sets}, (_,i)=>({
reps: ex.reps,
weight: ex.weight,
done: false,
}))
}))
};
}
const exec = currentExecution;
const totalSets = exec.exercises.reduce((s,e)=>s+e.setsLog.length, 0);
const doneSets = exec.exercises.reduce((s,e)=>s+e.setsLog.filter(sl=>sl.done).length, 0);
const totalVol = exec.exercises.reduce((s,e)=>s+e.setsLog.filter(sl=>sl.done).reduce((a,sl)=>a+(sl.reps*sl.weight),0), 0);
const elapsed = Math.floor((Date.now()-exec.startTime)/60000);
const pctDone = Math.round((doneSets/totalSets)*100);
let html = `
<div class="exec-header">
<div class="top">
<div><h2>${DAYS_FULL[currentDay]}</h2><div style="font-size:12px; opacity:0.8;">Treino em andamento</div></div>
<button class="btn btn-sm" style="background:rgba(0,0,0,0.15); color:#000;" onclick="finishWorkoutConfirm()">✓ Finalizar</button>
</div>
<div class="stats">
<div class="stat"><div class="v">${doneSets}/${totalSets}</div><div class="l">Séries</div></div>
<div class="stat"><div class="v">${totalVol.toLocaleString('pt-BR')}kg</div><div class="l">Volume</div></div>
<div class="stat"><div class="v">${elapsed}min</div><div class="l">Tempo</div></div>
<div class="stat"><div class="v">${pctDone}%</div><div class="l">Concluído</div></div>
</div>
<div class="exec-progress"><div class="fill" style="width:${pctDone}%"></div></div>
</div>
`;
exec.exercises.forEach((ex, ei) => {
const allDone = ex.setsLog.every(s=>s.done);
const isCurrent = !allDone && (ei===0 || exec.exercises[ei-1].setsLog.every(s=>s.done));
html += `
<div class="exec-card ${allDone?'done':isCurrent?'current':''}">
<div class="exec-card-header" onclick="toggleExecCard(${ei})">
<div class="num">${ei+1}</div>
<div class="title">
<div class="n">${ex.name}</div>
<div class="m">${ex.focus} · ${ex.setsLog.filter(s=>s.done).length}/${ex.setsLog.length} séries</div>
</div>
${allDone?'<div class="badge">✓ Completo</div>':isCurrent?'<div class="badge">▶️ Agora</div>':''}
</div>
<div class="sets-table" id="sets-${ei}">
<div class="set-row header">
<div>#</div>
<div>KG</div>
<div>REPS</div>
<div>✓</div>
</div>
${ex.setsLog.map((s,si)=>`
<div class="set-row">
<div style="text-align:center; font-weight:700; color:var(--text-2);">${si+1}</div>
<input type="number" value="${s.weight}" step="0.5" onchange="updateSet(${ei},${si},'weight',this.value)">
<input type="number" value="${s.reps}" min="0" onchange="updateSet(${ei},${si},'reps',this.value)">
<div class="set-check ${s.done?'checked':''}" onclick="toggleSet(${ei},${si})">${s.done?'✓':''}</div>
</div>
`).join('')}
<div style="margin-top:10px;">
<button class="btn btn-sm btn-secondary" onclick="addSet(${ei})">+ Adicionar série</button>
<button class="btn btn-sm btn-secondary" onclick="startRest(${ei})" style="margin-left:6px;">⏱️ Iniciar descanso (${ex.rest}s)</button>
</div>
</div>
</div>
`;
});
html += `<div style="text-align:center; margin-top:20px;"><button class="btn btn-secondary btn-sm" onclick="resetExecution()">↺ Reiniciar execução</button></div>`;
div.innerHTML = html;
}
function switchToPlan() {
const btn = document.querySelector('.workout-mode-btn[data-mode="plan"]');
switchWorkoutMode('plan', btn);
}
function toggleExecCard(ei) {
const el = document.getElementById('sets-'+ei);
el.style.display = el.style.display==='block' ? 'none' : 'block';
}
function updateSet(ei, si, field, value) {
currentExecution.exercises[ei].setsLog[si][field] = +value;
}
function toggleSet(ei, si) {
const s = currentExecution.exercises[ei].setsLog[si];
s.done = !s.done;
if (s.done) {
beep();
if (navigator.vibrate) navigator.vibrate(50);
const ex = currentUser().workouts[currentDay][ei];
if (s.weight > ex.weight) {
ex.weight = s.weight;
saveUser();
}
}
renderExecMode();
}
function addSet(ei) {
const ex = currentExecution.exercises[ei];
const last = ex.setsLog[ex.setsLog.length-1];
ex.setsLog.push({reps:last?.reps||10, weight:last?.weight||0, done:false});
renderExecMode();
}
function startRest(ei) {
const ex = currentExecution.exercises[ei];
document.getElementById('timer-exercise-name').textContent = `Descanso · ${ex.name}`;
startTimer(ex.rest);
}
function resetExecution() {
UI.confirm('Reiniciar?', 'Todo o progresso desta sessão será perdido.', 'warning').then(ok => {
if (!ok) return;
currentExecution = null;
renderExecMode();
});
}
function finishWorkoutConfirm() {
const exec = currentExecution;
if (!exec) return;
const totalSets = exec.exercises.reduce((s,e)=>s+e.setsLog.length, 0);
const doneSets = exec.exercises.reduce((s,e)=>s+e.setsLog.filter(sl=>sl.done).length, 0);
if (doneSets === 0) return UI.warning('Nenhuma série concluída', 'Complete pelo menos uma série antes de finalizar');
UI.confirm('Finalizar treino?', `${doneSets}/${totalSets} séries concluídas.`, 'success').then(ok => {
if (!ok) return;
finishWorkout();
});
}
function renderHistoryMode() {
const u = currentUser();
const hist = (u.history||[]).slice().reverse().slice(0,20);
const div = document.getElementById('history-content');
if (hist.length===0) {
div.innerHTML = `<div class="card"><div class="empty"><div class="ic">📊</div><div>Nenhum treino finalizado ainda<br><small class="text-muted">Complete seu primeiro treino!</small></div></div></div>`;
return;
}
div.innerHTML = hist.map(h => `
<div class="card" style="margin-bottom:10px;">
<div class="flex-between">
<div>
<div style="font-weight:700;">${DAYS_FULL[h.day]} — ${new Date(h.date).toLocaleDateString('pt-BR')}</div>
<div class="text-sm text-muted">${new Date(h.date).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
</div>
<div style="text-align:right;">
<div style="font-size:22px; font-weight:800; color:var(--primary);">${h.duration}min</div>
</div>
</div>
</div>
`).join('');
}
/* ============================================
TIMER
============================================ */
function startTimer(seconds) {
timerSeconds = seconds; timerTotal = seconds; timerPaused = false;
document.getElementById('timer-pause-btn').innerHTML = '⏸️ Pausar';
updateTimerDisplay();
clearInterval(timerInterval);
document.getElementById('timer-overlay').classList.add('active');
timerInterval = setInterval(()=>{
if (timerPaused) return;
timerSeconds--;
updateTimerDisplay();
if (timerSeconds<=0) {
beep(); if (navigator.vibrate) navigator.vibrate([200,100,200]);
clearInterval(timerInterval);
setTimeout(()=>{ document.getElementById('timer-overlay').classList.remove('active'); toast('Descanso finalizado! ⏰', 'success'); }, 800);
}
}, 1000);
}
function updateTimerDisplay() {
const m = String(Math.floor(timerSeconds/60)).padStart(2,'0');
const s = String(timerSeconds%60).padStart(2,'0');
document.getElementById('timer-display').textContent = `${m}:${s}`;
const pct = timerTotal ? (timerSeconds/timerTotal)*100 : 0;
document.getElementById('timer-circle').style.setProperty('--progress', pct+'%');
}
function toggleTimerPause() {
timerPaused = !timerPaused;
document.getElementById('timer-pause-btn').innerHTML = timerPaused ? '▶️ Continuar' : '⏸️ Pausar';
}
function skipTimer() { clearInterval(timerInterval); document.getElementById('timer-overlay').classList.remove('active'); }
function closeTimer() { clearInterval(timerInterval); document.getElementById('timer-overlay').classList.remove('active'); }
function finishWorkout() {
clearInterval(timerInterval);
document.getElementById('timer-overlay').classList.remove('active');
const u = currentUser();
const exec = currentExecution;
const elapsed = Math.max(1, Math.round((Date.now()-exec.startTime)/60000));
const totalVol = exec.exercises.reduce((s,e)=>s+e.setsLog.filter(sl=>sl.done).reduce((a,sl)=>a+(sl.reps*sl.weight),0), 0);
u.stats.workouts++;
u.stats.mins += elapsed;
u.xp += 20 + elapsed + Math.floor(totalVol/100);
u.stats.lastWorkout = Date.now();
u.stats.streak = (u.stats.streak||0) + 1;
u.history.push({date:Date.now(), day:currentDay, duration:elapsed});
exec.exercises.forEach((e,i) => {
const maxW = Math.max(...e.setsLog.filter(s=>s.done).map(s=>s.weight));
if (maxW > (u.workouts[currentDay][i]?.weight||0)) {
u.workouts[currentDay][i].weight = maxW;
}
if (maxW > (u.personalRecords[e.name]?.weight||0)) {
u.personalRecords[e.name] = {weight:maxW, date:Date.now()};
}
});
checkLevelUp(u); checkAchievements(); saveUser(); updateSidebar();
beep(); if (navigator.vibrate) navigator.vibrate([100,50,100,50,200]);
currentExecution = null;
UI.success('🎉 Treino concluído!', `+${20+elapsed+Math.floor(totalVol/100)} XP · ${totalVol.toLocaleString('pt-BR')}kg de volume`);
navigate('home');
}
function checkLevelUp(u) {
let needed = u.level * 100;
while (u.xp >= needed) { u.xp -= needed; u.level++; needed = u.level * 100; toast(` Nível ${u.level}!`, 'success'); }
}
/* ============================================
SOM
============================================ */
function beep() {
try { const ctx=new (window.AudioContext||window.webkitAudioContext)(); const osc=ctx.createOscillator(); const gain=ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.type='sine'; osc.frequency.value=880; gain.gain.setValueAtTime(0.3,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.5); osc.start(); osc.stop(ctx.currentTime+0.5); } catch(e){}
}
/* ============================================
DIET
============================================ */
function getTodayMeals() { return currentUser().meals[dateKey(new Date())] || []; }
function dateKey(d) { return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function renderDiet() {
const u = currentUser();
const meals = getTodayMeals();
const totalCal = meals.reduce((s,m)=>s+(+m.cal||0),0);
const totalProt = meals.reduce((s,m)=>s+(+m.prot||0),0);
const totalCarb = meals.reduce((s,m)=>s+(+m.carb||0),0);
const totalFat = meals.reduce((s,m)=>s+(+m.fat||0),0);
const goalCal=u.profile.goalCal||2000, goalProt=u.profile.goalProt||120, goalCarb=u.profile.goalCarb||250, goalFat=u.profile.goalFat||70;
const calPct = Math.min((totalCal/goalCal)*100,100);
document.getElementById('cal-consumed').textContent = totalCal;
document.getElementById('cal-goal').textContent = goalCal;
document.getElementById('cal-pct').textContent = Math.round(calPct)+'%';
document.getElementById('cal-ring').style.setProperty('--pct', calPct+'%');
const protPct = Math.min((totalProt/goalProt)*100,100);
const carbPct = Math.min((totalCarb/goalCarb)*100,100);
const fatPct = Math.min((totalFat/goalFat)*100,100);
document.getElementById('macro-prot').textContent = totalProt;
document.getElementById('macro-carb').textContent = totalCarb;
document.getElementById('macro-fat').textContent = totalFat;
document.getElementById('goal-prot').textContent = goalProt;
document.getElementById('goal-carb').textContent = goalCarb;
document.getElementById('goal-fat').textContent = goalFat;
document.getElementById('ring-prot').style.setProperty('--pct', protPct+'%');
document.getElementById('ring-carb').style.setProperty('--pct', carbPct+'%');
document.getElementById('ring-fat').style.setProperty('--pct', fatPct+'%');
document.getElementById('pct-prot').textContent = Math.round(protPct)+'%';
document.getElementById('pct-carb').textContent = Math.round(carbPct)+'%';
document.getElementById('pct-fat').textContent = Math.round(fatPct)+'%';
const list = document.getElementById('meals-list');
if (meals.length===0) {
list.innerHTML = `<div class="card"><div class="empty"><div class="ic">🍽️</div><div>Nenhuma refeição hoje</div></div></div>`;
return;
}
list.innerHTML = meals.map((m,i)=>`<div class="plan-card" style="margin-bottom:10px;"><div class="plan-card-header"><div class="exercise-icon">🍽️</div><div class="info"><div class="name">${m.name}</div><div class="meta">${m.desc||''}</div><div class="mt-2"><span class="chip primary">${m.cal} kcal</span><span class="chip info">P ${m.prot}g</span><span class="chip warning">C ${m.carb}g</span><span class="chip accent">G ${m.fat}g</span></div></div><button class="btn btn-sm btn-danger" onclick="deleteMeal(${i})">🗑️</button></div></div>`).join('');
}
function openMealModal() {
openModal('generic-modal');
document.getElementById('generic-modal-content').innerHTML = `
<div class="modal-header"><h2>Nova Refeição</h2><button class="close-btn" onclick="closeModal('generic-modal')">✕</button></div>
<div class="input-group"><label>Nome</label><input type="text" id="meal-name" placeholder="Ex: Café da manhã"></div>
<div class="input-group"><label>Descrição</label><textarea id="meal-desc" rows="2" placeholder="O que você comeu?"></textarea></div>
<div class="row"><div class="input-group"><label>Calorias</label><input type="number" id="meal-cal" value="300" min="0"></div><div class="input-group"><label>Proteína (g)</label><input type="number" id="meal-prot" value="20" min="0"></div></div>
<div class="row"><div class="input-group"><label>Carboidrato (g)</label><input type="number" id="meal-carb" value="40" min="0"></div><div class="input-group"><label>Gordura (g)</label><input type="number" id="meal-fat" value="10" min="0"></div></div>
<button class="btn btn-primary btn-block" onclick="saveMeal()">Salvar</button>
`;
}
function saveMeal() {
const u = currentUser();
const meal = {
name:document.getElementById('meal-name').value.trim(),
desc:document.getElementById('meal-desc').value.trim(),
cal:+document.getElementById('meal-cal').value,
prot:+document.getElementById('meal-prot').value,
carb:+document.getElementById('meal-carb').value,
fat:+document.getElementById('meal-fat').value,
};
if (!meal.name) return UI.warning('Nome obrigatório', 'Informe o nome da refeição');
const key = dateKey(new Date());
if (!u.meals[key]) u.meals[key] = [];
u.meals[key].push(meal);
saveUser(); closeModal('generic-modal'); renderDiet();
toast('Refeição registrada! 🍎', 'success');
}
function deleteMeal(i) {
UI.confirm('Excluir refeição?', 'Esta ação não pode ser desfeita.', 'danger').then(ok => {
if (!ok) return;
const u = currentUser();
const key = dateKey(new Date());
u.meals[key].splice(i,1);
saveUser(); renderDiet();
});
}
/* ============================================
ÁGUA
============================================ */
function getTodayWater() { return currentUser().water[dateKey(new Date())] || 0; }
function renderTools() { renderWaterGrid(); }
function renderWaterGrid() {
const count = getTodayWater();
const grid = document.getElementById('water-grid');
if (!grid) return;
grid.innerHTML = '';
for (let i=0; i<8; i++) {
const cup = document.createElement('div');
cup.className = 'water-cup' + (i<count?' filled':'');
cup.textContent = '';
cup.onclick = () => toggleWaterCup(i);
grid.appendChild(cup);
}
document.getElementById('water-count').textContent = count;
document.getElementById('water-ml').textContent = count * 250;
document.getElementById('water-bar').style.width = Math.min((count/8)*100,100)+'%';
}
function toggleWaterCup(i) {
const u = currentUser();
const key = dateKey(new Date());
const current = u.water[key]||0;
u.water[key] = i < current ? i : i+1;
saveUser(); renderWaterGrid();
}
/* ============================================
CALCULADORAS
============================================ */
function calculate1RM() {
const w = +document.getElementById('rm-weight').value;
const r = +document.getElementById('rm-reps').value;
if (!w || !r) return UI.warning('Dados inválidos', 'Informe peso e repetições');
const rm = r===1 ? w : w * (1 + r/30);
const rounded = Math.round(rm*2)/2;
document.getElementById('rm-result').innerHTML = `<div class="calc-result"><div class="lbl">Seu 1RM estimado</div><div class="big">${rounded} kg</div></div>`;
const zones = [{pct:100,label:'Máxima',desc:'1 rep'},{pct:95,label:'Força máx',desc:'2 reps'},{pct:90,label:'Força',desc:'3-4 reps'},{pct:85,label:'Força/Hiper',desc:'5-6 reps'},{pct:80,label:'Hipertrofia',desc:'7-8 reps'},{pct:75,label:'Hipertrofia',desc:'9-10 reps'},{pct:70,label:'Resistência',desc:'11-12 reps'},{pct:65,label:'Resistência',desc:'13-15 reps'},{pct:60,label:'Resistência',desc:'16-20 reps'}];
document.getElementById('rm-zones').innerHTML = zones.map(z=>{const kg=Math.round((rounded*z.pct/100)*2)/2;return `<div class="flex-between" style="padding:10px 0; border-bottom:1px solid var(--border);"><div><strong>${z.label}</strong><div class="text-xs text-muted">${z.desc}</div></div><div><strong>${kg} kg</strong> <span class="text-xs text-muted">(${z.pct}%)</span></div></div>`;}).join('');
}
function calculateTDEE() {
const sex=document.getElementById('tdee-sex').value, age=+document.getElementById('tdee-age').value, w=+document.getElementById('tdee-weight').value, h=+document.getElementById('tdee-height').value, act=+document.getElementById('tdee-activity').value;
if (!w||!h||!age) return UI.warning('Dados inválidos','Preencha todos os campos');
const tmb = sex==='m' ? (10*w + 6.25*h - 5*age + 5) : (10*w + 6.25*h - 5*age - 161);
const tdee = Math.round(tmb*act);
document.getElementById('tdee-result').innerHTML = `<div class="calc-result"><div class="lbl">TMB</div><div class="big">${Math.round(tmb)} kcal</div><div class="text-xs" style="margin-top:6px; opacity:0.8;">Metabolismo basal</div></div><div class="grid-3 mt-3"><div class="stat-card g2" style="text-align:center;"><div class="label">Cutting</div><div class="value" style="font-size:22px;">${tdee-500}</div><div class="trend">perder gordura</div></div><div class="stat-card g1" style="text-align:center;"><div class="label">Manutenção</div><div class="value" style="font-size:22px;">${tdee}</div><div class="trend">TDEE</div></div><div class="stat-card g4" style="text-align:center;"><div class="label">Bulking</div><div class="value" style="font-size:22px;">${tdee+300}</div><div class="trend">ganhar massa</div></div></div>`;
}
function calculateIMC() {
const w = +document.getElementById('imc-weight').value;
const h = +document.getElementById('imc-height').value;
if (!w || !h) return UI.warning('Dados inválidos','Informe peso e altura');
const hm = h/100;
const imc = w / (hm*hm);
const imcRound = imc.toFixed(1);
let faixa='', cor='', bg='', descricao='';
if (imc < 18.5) { faixa='Abaixo do peso'; cor='#fff'; bg='var(--info)'; descricao='Seu IMC indica peso abaixo do ideal. Considere aumentar a ingestão calórica.'; }
else if (imc < 25) { faixa='Peso normal'; cor='#000'; bg='var(--primary)'; descricao='🎉 Parabéns! Seu peso está na faixa saudável.'; }
else if (imc < 30) { faixa='Sobrepeso'; cor='#000'; bg='var(--warning)'; descricao='Você está um pouco acima do peso ideal. Ajustes na dieta ajudam.'; }
else if (imc < 35) { faixa='Obesidade grau I'; cor='#fff'; bg='var(--accent)'; descricao='Atenção: obesidade grau I. Procure orientação profissional.'; }
else if (imc < 40) { faixa='Obesidade grau II'; cor='#fff'; bg='var(--accent)'; descricao='Obesidade grau II. Recomenda-se acompanhamento médico.'; }
else { faixa='Obesidade grau III'; cor='#fff'; bg='var(--danger)'; descricao='Obesidade grau III. Busque acompanhamento médico urgente.'; }
const pct = Math.max(0, Math.min(100, ((imc-15)/(40-15))*100));
document.getElementById('imc-result').innerHTML = `
<div class="card" style="margin-top:16px;">
<div class="flex-between" style="margin-bottom:16px;">
<div>
<div class="text-xs text-muted">SEU IMC</div>
<div style="font-size:36px; font-weight:800; color:${bg};">${imcRound}</div>
<div style="font-weight:600; color:${bg}; margin-top:2px;">${faixa}</div>
</div>
<div style="font-size:60px;">⚖️</div>
</div>
<div class="progress-bar" style="height:10px; background:linear-gradient(90deg,var(--info) 0%,var(--primary) 25%,var(--warning) 50%,var(--accent) 75%,var(--danger) 100%); position:relative;">
<div style="position:absolute; top:-4px; left:${pct}%; width:4px; height:18px; background:#000; border-radius:2px; transform:translateX(-50%); box-shadow:0 0 0 2px var(--card);"></div>
</div>
<div class="flex-between" style="font-size:10px; color:var(--text-3); margin-top:4px;"><div>15</div><div>18.5</div><div>25</div><div>30</div><div>35</div><div>40+</div></div>
<div class="mt-3 text-sm text-muted">Peso ideal para sua altura: <strong>${(18.5*hm*hm).toFixed(1)}kg</strong> a <strong>${(24.9*hm*hm).toFixed(1)}kg</strong></div>
</div>
`;
}
function setQuickTimer(s) { quickTimerSeconds=s; quickTimerTotal=s; quickTimerRunning=false; clearInterval(quickTimerInterval); updateQuickTimer(); document.getElementById('qt-start').innerHTML='▶️ Iniciar'; }
function updateQuickTimer() { const m=String(Math.floor(quickTimerSeconds/60)).padStart(2,'0'); const s=String(quickTimerSeconds%60).padStart(2,'0'); document.getElementById('quick-timer-display').textContent=`${m}:${s}`; const pct=quickTimerTotal?(quickTimerSeconds/quickTimerTotal)*100:0; document.getElementById('quick-timer-circle').style.setProperty('--progress',pct+'%'); }
function toggleQuickTimer() { if (quickTimerRunning) { quickTimerRunning=false; clearInterval(quickTimerInterval); document.getElementById('qt-start').innerHTML='▶️ Continuar'; } else { if (quickTimerSeconds<=0) quickTimerSeconds=quickTimerTotal; quickTimerRunning=true; document.getElementById('qt-start').innerHTML='⏸️ Pausar'; quickTimerInterval=setInterval(()=>{ quickTimerSeconds--; updateQuickTimer(); if (quickTimerSeconds<=0) { clearInterval(quickTimerInterval); quickTimerRunning=false; document.getElementById('qt-start').innerHTML='▶️ Iniciar'; beep(); if (navigator.vibrate) navigator.vibrate([200,100,200]); toast('⏰ Tempo!','success'); } },1000); } }
function resetQuickTimer() { clearInterval(quickTimerInterval); quickTimerRunning=false; quickTimerSeconds=quickTimerTotal; updateQuickTimer(); document.getElementById('qt-start').innerHTML='▶️ Iniciar'; }
/* ============================================
PROGRESS
============================================ */
function renderProgress() { renderHeatmap(); renderWeightChart(); renderPRList(); updateWeightInfo(); }
function switchProgressTab(btn, tab) { document.querySelectorAll('#progress-screen .tab-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); ['calendar','weight','records'].forEach(t=>{document.getElementById('progress-'+t).style.display=t===tab?'block':'none';}); if (tab==='weight') renderWeightChart(); }
function renderHeatmap() {
const u = currentUser();
const y = calendarDate.getFullYear(), m = calendarDate.getMonth();
document.getElementById('cal-month-title').textContent = `${MONTHS[m]} ${y}`;
const firstDay = new Date(y,m,1).getDay();
const daysInMonth = new Date(y,m+1,0).getDate();
const today = new Date();
const heatmap = document.getElementById('heatmap');
heatmap.innerHTML = '';
let workoutCount = 0, daysTrained = 0;
for (let i=0; i<firstDay; i++) heatmap.appendChild(document.createElement('div'));
for (let d=1; d<=daysInMonth; d++) {
const date = new Date(y,m,d);
const dateStr = dateKey(date);
const dayEl = document.createElement('div');
dayEl.className = 'heatmap-day';
dayEl.textContent = d;
const count = u.history.filter(h=>dateKey(new Date(h.date))===dateStr).length;
if (count>0) { workoutCount+=count; daysTrained++; if (count>=3) dayEl.classList.add('l3'); else if (count>=2) dayEl.classList.add('l2'); else dayEl.classList.add('l1'); }
if (date.toDateString()===today.toDateString()) dayEl.classList.add('today');
heatmap.appendChild(dayEl);
}
document.getElementById('cal-month-count').textContent = workoutCount;
document.getElementById('cal-month-days').textContent = daysTrained;
}
function changeMonth(delta) { calendarDate.setMonth(calendarDate.getMonth()+delta); renderHeatmap(); }
function renderWeightChart() {
const u = currentUser();
const hist = (u.stats.weightHistory||[]).slice(-30);
const labels = hist.map(h=>new Date(h.date).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
const data = hist.map(h=>h.weight);
const ctx = document.getElementById('weightChart');
if (!ctx) return;
if (weightChart) weightChart.destroy();
const color = getComputedStyle(document.documentElement).getPropertyValue('--info').trim();
const text2 = getComputedStyle(document.documentElement).getPropertyValue('--text-2').trim();
weightChart = new Chart(ctx, { type:'line', data:{labels:labels.length?labels:['Sem dados'],datasets:[{label:'Peso',data:data.length?data:[0],borderColor:color,backgroundColor:color+'33',tension:0.4,fill:true,pointRadius:4}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:text2},grid:{display:false}},y:{ticks:{color:text2},grid:{color:'rgba(128,128,128,0.1)'}}}}});
}
function addWeight() {
const w = +document.getElementById('new-weight').value;
if (!w || w<20) return UI.warning('Peso inválido','Informe um peso válido');
const u = currentUser();
u.profile.weight = w;
u.stats.weightHistory.push({date:Date.now(), weight:w});
saveUser(); renderWeightChart(); updateWeightInfo();
toast('Peso registrado! ️','success');
document.getElementById('new-weight').value = '';
}
function updateWeightInfo() {
const u = currentUser();
const hist = u.stats.weightHistory||[];
if (hist.length===0) { document.getElementById('current-weight').textContent='--'; document.getElementById('weight-diff').textContent='--'; return; }
const current = hist[hist.length-1].weight;
const first = hist[0].weight;
const diff = current - first;
document.getElementById('current-weight').textContent = current.toFixed(1);
const d = document.getElementById('weight-diff');
d.textContent = (diff>=0?'+':'')+diff.toFixed(1)+' kg';
d.style.color = diff>0?'var(--accent)':diff<0?'var(--primary)':'var(--text)';
}
function renderPRList() {
const u = currentUser();
const prs = Object.entries(u.personalRecords||{});
const div = document.getElementById('pr-list');
if (prs.length===0) { div.innerHTML = `<div class="card"><div class="empty"><div class="ic">🏆</div><div>Nenhum recorde ainda</div></div></div>`; return; }
prs.sort((a,b)=>b[1].weight-a[1].weight);
div.innerHTML = prs.map(([name,pr])=>`<div class="pr-card"><div class="pr-icon">🏆</div><div class="pr-info"><div class="ex-name">${name}</div><div class="ex-date">${new Date(pr.date).toLocaleDateString('pt-BR')}</div></div><div class="pr-value">${pr.weight}kg</div></div>`).join('');
}
function switchToolsTab(btn, tab) { document.querySelectorAll('#tools-screen .tab-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); ['water','1rm','tdee','imc','rest'].forEach(t=>{document.getElementById('tools-'+t).style.display=t===tab?'block':'none';}); }
/* ============================================
LIBRARY
============================================ */
function renderLibrary() {
const search = (document.getElementById('lib-search')?.value || '').toLowerCase();
const list = EXERCISE_LIBRARY.filter(ex => { const mf = libFilter==='all' || ex.focus===libFilter; const ms = ex.name.toLowerCase().includes(search) || ex.muscles.toLowerCase().includes(search); return mf && ms; });
const div = document.getElementById('lib-list');
if (!div) return;
if (list.length===0) { div.innerHTML = `<div class="card"><div class="empty"><div class="ic">🔍</div><div>Nenhum exercício</div></div></div>`; return; }
div.innerHTML = list.map(ex=>`<div class="plan-card" style="margin-bottom:10px;"><div class="plan-card-header"><div class="exercise-icon">${getIcon(ex.focus)}</div><div class="info"><div class="name">${ex.name}</div><div class="meta">${ex.muscles}</div><div class="mt-2"><span class="chip primary">${ex.focus}</span></div></div><button class="btn btn-sm btn-primary" onclick="addFromLib('${ex.name.replace(/'/g,"\\'")}','${ex.focus}')">+</button></div></div>`).join('');
}
function filterLib(btn, filter) { document.querySelectorAll('#library-screen .tab-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); libFilter=filter; renderLibrary(); }
/* ============================================
NOTAS
============================================ */
function openAINote() {
openModal('generic-modal');
document.getElementById('generic-modal-content').innerHTML = `
<div class="modal-header"><h2>📝 Anotação</h2><button class="close-btn" onclick="closeModal('generic-modal')">✕</button></div>
<div class="input-group"><label>Observação</label><textarea id="note-text" rows="5" placeholder="Como você se sentiu? Observações..."></textarea></div>
<button class="btn btn-primary btn-block" onclick="saveNote()">Salvar</button>
`;
}
function saveNote() {
const text = document.getElementById('note-text').value.trim();
if (!text) return UI.warning('Vazio','Escreva algo antes de salvar');
const u = currentUser();
const key = dateKey(new Date())+'_'+currentDay;
if (!u.notes[key]) u.notes[key] = [];
u.notes[key].push({text, date:Date.now()});
saveUser(); closeModal('generic-modal'); renderDayNotes();
toast('Anotação salva! 📝','success');
}
function renderDayNotes() {
const u = currentUser();
const key = dateKey(new Date())+'_'+currentDay;
const notes = u.notes[key] || [];
const div = document.getElementById('day-notes');
if (!div) return;
if (notes.length===0) { div.innerHTML = `<div class="card"><div class="text-sm text-muted" style="text-align:center; padding:10px;">Nenhuma anotação</div></div>`; return; }
div.innerHTML = notes.map(n=>`<div class="note-card"><div class="date">${new Date(n.date).toLocaleString('pt-BR')}</div><div class="text">${n.text}</div></div>`).join('');
}
/* ============================================
PROFILE
============================================ */
function renderProfile() {
const u = currentUser();
document.getElementById('profile-name').textContent = u.name;
document.getElementById('profile-email').textContent = u.email;
document.getElementById('profile-level').textContent = 'LVL '+u.level;
document.getElementById('profile-level-num').textContent = u.level;
document.getElementById('profile-xp').textContent = u.xp;
document.getElementById('profile-xp-need').textContent = u.level*100;
document.getElementById('profile-xp-bar').style.width = ((u.xp/(u.level*100))*100)+'%';
document.getElementById('profile-weight').textContent = u.profile.weight || '--';
document.getElementById('profile-height').textContent = u.profile.height || '--';
document.getElementById('profile-age').textContent = u.profile.age || '--';
document.getElementById('profile-goal').textContent = goalLabel(u.profile.goal);
document.getElementById('profile-avatar').innerHTML = u.name[0].toUpperCase();
const imcDiv = document.getElementById('imc-detail');
if (u.profile.weight && u.profile.height) {
const h = u.profile.height/100;
const imc = u.profile.weight/(h*h);
document.getElementById('profile-bmi').textContent = imc.toFixed(1);
let faixa='', cor='', bg='';
if (imc<18.5){faixa='Abaixo do peso';bg='var(--info)';cor='#fff';}
else if (imc<25){faixa='Normal';bg='var(--primary)';cor='#000';}
else if (imc<30){faixa='Sobrepeso';bg='var(--warning)';cor='#000';}
else if (imc<35){faixa='Obesidade I';bg='var(--accent)';cor='#fff';}
else if (imc<40){faixa='Obesidade II';bg='var(--accent)';cor='#fff';}
else {faixa='Obesidade III';bg='var(--danger)';cor='#fff';}
imcDiv.innerHTML = `
<div class="card" style="margin-top:14px;">
<div class="flex-between">
<div>
<div class="text-xs text-muted">SEU IMC</div>
<div style="font-size:36px; font-weight:800; color:${bg};">${imc.toFixed(1)}</div>
<div style="font-weight:600; color:${bg}; margin-top:2px;">${faixa}</div>
</div>
<div style="font-size:60px;">⚖️</div>
</div>
<div class="progress-bar" style="height:10px; background:linear-gradient(90deg,var(--info) 0%,var(--primary) 25%,var(--warning) 50%,var(--accent) 75%,var(--danger) 100%); position:relative; margin-top:16px;">
<div style="position:absolute; top:-4px; left:${Math.max(0,Math.min(100,((imc-15)/(40-15))*100))}%; width:4px; height:18px; background:#000; border-radius:2px; transform:translateX(-50%); box-shadow:0 0 0 2px var(--card);"></div>
</div>
<div class="flex-between" style="font-size:10px; color:var(--text-3); margin-top:4px;"><div>15</div><div>18.5</div><div>25</div><div>30</div><div>35</div><div>40+</div></div>
<div class="mt-3 text-sm text-muted">Peso ideal para sua altura: <strong>${(18.5*h*h).toFixed(1)}kg</strong> a <strong>${(24.9*h*h).toFixed(1)}kg</strong></div>
</div>
`;
} else {
document.getElementById('profile-bmi').textContent = '--';
imcDiv.innerHTML = `<div class="card" style="margin-top:14px;"><div class="text-sm text-muted" style="text-align:center; padding:10px;">Preencha peso e altura para ver seu IMC detalhado</div></div>`;
}
renderAchievements('achievements-list', 100);
}
function goalLabel(g) { return {bulking:'🔥 Bulking',cutting:'✂️ Cutting',maintenance:'⚖️ Manutenção',health:'💚 Saúde'}[g] || '🎯 Objetivo'; }
function editProfile() {
const u = currentUser();
openModal('generic-modal');
document.getElementById('generic-modal-content').innerHTML = `
<div class="modal-header"><h2>Editar Perfil</h2><button class="close-btn" onclick="closeModal('generic-modal')">✕</button></div>
<div class="input-group"><label>Objetivo</label><select id="edit-goal"><option value="bulking" ${u.profile.goal==='bulking'?'selected':''}>🔥 Bulking</option><option value="cutting" ${u.profile.goal==='cutting'?'selected':''}>✂️ Cutting</option><option value="maintenance" ${u.profile.goal==='maintenance'?'selected':''}>⚖️ Manutenção</option><option value="health" ${u.profile.goal==='health'?'selected':''}>💚 Saúde</option></select></div>
<div class="row"><div class="input-group"><label>Peso (kg)</label><input type="number" id="edit-weight" step="0.1" min="30" value="${u.profile.weight||''}"></div><div class="input-group"><label>Altura (cm)</label><input type="number" id="edit-height" min="100" value="${u.profile.height||''}"></div></div>
<div class="row"><div class="input-group"><label>Idade</label><input type="number" id="edit-age" min="10" value="${u.profile.age||''}"></div><div class="input-group"><label>Meta kcal/dia</label><input type="number" id="edit-goal-cal" min="1000" value="${u.profile.goalCal||2000}"></div></div>
<button class="btn btn-primary btn-block" onclick="saveProfile()">Salvar alterações</button>
`;
}
function saveProfile() {
const u = currentUser();
const newWeight = +document.getElementById('edit-weight').value || null;
u.profile.goal = document.getElementById('edit-goal').value;
u.profile.height = +document.getElementById('edit-height').value || null;
u.profile.age = +document.getElementById('edit-age').value || null;
u.profile.goalCal = +document.getElementById('edit-goal-cal').value || 2000;
if (newWeight) { u.profile.weight = newWeight; u.stats.weightHistory.push({date:Date.now(), weight:newWeight}); }
saveUser(); closeModal('generic-modal'); renderProfile(); updateSidebar();
toast('Perfil atualizado! ✅','success');
}
/* ============================================
ACHIEVEMENTS / STREAK / NOTIF / IA
============================================ */
function checkAchievements() { const u=currentUser(); ACHIEVEMENTS.forEach(a=>{if(!u.achievements.includes(a.id)&&a.check(u)){u.achievements.push(a.id); toast(`🏅 ${a.name}`,'success');}}); saveUser(); }
function renderAchievements(containerId, max) { const u=currentUser(); const shown=ACHIEVEMENTS.slice(0,max); document.getElementById(containerId).innerHTML=shown.map(a=>{const got=u.achievements.includes(a.id);return `<div class="achievement ${got?'':'locked'}"><div class="medal">${a.icon}</div><div class="info"><div class="t">${a.name}</div><div class="d">${a.desc}</div></div>${got?'<div style="color:var(--primary); font-weight:700;">✓</div>':''}</div>`;}).join(''); }
function checkStreak() { const u=currentUser(); if (!u.stats.lastWorkout) return; const days=Math.floor((Date.now()-u.stats.lastWorkout)/86400000); if (days>1 && u.stats.streak>0) { u.stats.streak=0; saveUser(); } }
function generateNotifications() {
const u = currentUser();
u.notifications = [];
const h = new Date().getHours();
if (h>=7 && h<=10) u.notifications.push({icon:'☀️',text:'Bom dia! Hora de treinar 💪'});
if (u.stats.streak===0 && u.stats.workouts>0) u.notifications.push({icon:'️',text:'Você pulou um dia. Não perca a sequência!'});
if (u.stats.streak>=3) u.notifications.push({icon:'🔥',text:`Incrível! ${u.stats.streak} dias seguidos!`});
u.notifications.push({icon:'💧',text:'Não esqueça de beber água!'});
u.notifications.push({icon:'🎯',text:`Meta diária: ${u.profile.goalCal||2000} kcal`});
saveUser();
const dot = document.getElementById('notif-dot');
if (dot) dot.style.display = u.notifications.length ? 'block' : 'none';
}
function showNotifications() {
const u = currentUser();
const list = u.notifications.length===0 ? `<div class="empty"><div class="ic"></div><div>Nenhuma notificação</div></div>` : u.notifications.map(n=>`<div class="plan-card" style="margin-bottom:8px;"><div class="plan-card-header"><div class="exercise-icon">${n.icon}</div><div class="info"><div class="name">${n.text}</div></div></div></div>`).join('');
openModal('generic-modal');
document.getElementById('generic-modal-content').innerHTML = `<div class="modal-header"><h2>🔔 Notificações</h2><button class="close-btn" onclick="closeModal('generic-modal')">✕</button></div>${list}`;
}
let aiChatHistory = [];
function openAI() {
const u = currentUser();
const goal = u.profile.goal || 'maintenance';
openModal('generic-modal');
document.getElementById('generic-modal-content').innerHTML = `
<div class="modal-header">
<h2>🧠 Assistente FitPro IA</h2>
<button class="close-btn" onclick="closeModal('generic-modal')">✕</button>
</div>
<div class="ai-tabs">
<div class="ai-tab active" onclick="switchAiTab('generator', this)">⚡ Gerar Treino</div>
<div class="ai-tab" onclick="switchAiTab('chat', this)">💬 Chat com IA</div>
</div>
<div id="ai-generator-panel">
<div class="card" style="background:linear-gradient(135deg,rgba(0,230,118,0.1),rgba(0,200,83,0.02)); margin-bottom:14px;">
<h3 style="margin-bottom:8px;">⚙️ Configuração do Treino</h3>
<p style="color:var(--text-2); font-size:13px; margin-bottom:12px;">A IA criará um treino único e aleatório baseado no seu perfil.</p>
<div class="input-group" style="margin-bottom:12px;">
<label>Objetivo do Treino</label>
<select id="ai-gen-goal">
<option value="hipertrofia" ${goal==='bulking'?'selected':''}>Hipertrofia (Ganho de Massa)</option>
<option value="emagrecimento" ${goal==='cutting'?'selected':''}>Emagrecimento (Queima de Gordura)</option>
<option value="forca">Força Máxima</option>
<option value="resistencia">Resistência e Condicionamento</option>
</select>
</div>
<div class="input-group" style="margin-bottom:12px;">
<label>Foco Muscular Principal</label>
<select id="ai-gen-focus">
<option value="Peito">Peito</option><option value="Costas">Costas</option><option value="Perna">Perna</option>
<option value="Ombro">Ombro</option><option value="Braço">Braços (Bíceps/Tríceps)</option><option value="Full Body">Corpo Inteiro</option>
</select>
</div>
<button class="btn btn-primary btn-block" onclick="generateDynamicWorkout()">✨ Gerar Treino Inteligente</button>
</div>
<div id="ai-workout-result" style="display:none;"></div>
</div>
<div id="ai-chat-panel" style="display:none;">
<div class="chat-container" id="chat-container">
<div class="chat-msg ai">Olá! Sou seu assistente fitness com IA. Pode me perguntar sobre treinos, dieta, execução de exercícios ou motivação. Como posso ajudar hoje? 💪</div>
</div>
<div class="typing-indicator" id="typing-indicator">IA está digitando...</div>
<div class="chat-input-area">
<input type="text" id="chat-input" placeholder="Digite sua dúvida..." onkeydown="if(event.key==='Enter') sendChatMessage()">
<button class="btn btn-primary" onclick="sendChatMessage()" style="width:auto; padding:12px;">➤</button>
</div>
</div>
`;
}
function switchAiTab(tab, btn) {
document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
btn.classList.add('active');
document.getElementById('ai-generator-panel').style.display = tab === 'generator' ? 'block' : 'none';
document.getElementById('ai-chat-panel').style.display = tab === 'chat' ? 'block' : 'none';
}
function generateDynamicWorkout() {
const goal = document.getElementById('ai-gen-goal').value;
const focus = document.getElementById('ai-gen-focus').value;
let pool = EXERCISE_LIBRARY;
if (focus !== 'Full Body') {
pool = EXERCISE_LIBRARY.filter(ex => ex.focus === focus || (focus === 'Braço' && (ex.focus === 'Bíceps' || ex.focus === 'Tríceps')));
}
pool = pool.sort(() => 0.5 - Math.random());
const count = Math.floor(Math.random() * 3) + 4;
const selected = pool.slice(0, count);
const workout = selected.map(ex => {
let sets, reps, rest;
if (goal === 'hipertrofia') { sets = Math.floor(Math.random()*2)+3; reps = Math.floor(Math.random()*4)+8; rest = 60; }
else if (goal === 'emagrecimento') { sets = 3; reps = Math.floor(Math.random()*5)+12; rest = 45; }
else if (goal === 'forca') { sets = 5; reps = Math.floor(Math.random()*3)+3; rest = 120; }
else { sets = 3; reps = Math.floor(Math.random()*5)+15; rest = 45; }
return { name: ex.name, sets, reps, weight: 0, rest, focus: ex.focus };
});
const resultDiv = document.getElementById('ai-workout-result');
resultDiv.style.display = 'block';
resultDiv.innerHTML = `
<div class="ai-workout-preview" style="background:var(--bg); border-radius:12px; padding:16px; border:1px solid var(--border); margin-top:12px;">
<h4 style="margin-bottom:12px; color:var(--primary);">✅ Treino Gerado: Foco em ${focus}</h4>
${workout.map(ex => `
<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border); font-size:14px;">
<div><div style="font-weight:600;">${ex.name}</div><div style="font-size:12px; color:var(--text-2);">${ex.focus}</div></div>
<div style="text-align:right;"><div style="font-weight:700;">${ex.sets} x ${ex.reps}</div><div style="font-size:12px; color:var(--text-2);">${ex.rest}s descanso</div></div>
</div>
`).join('')}
<button class="btn btn-primary btn-block mt-3" onclick='applyDynamicWorkout(${JSON.stringify(workout).replace(/'/g, "\\'")})'> Aplicar este Treino ao Dia Atual</button>
</div>
`;
window._generatedWorkout = workout;
toast('Treino gerado com sucesso!', 'success');
}
function applyDynamicWorkout(workout) {
const u = currentUser();
u.workouts[currentDay] = workout;
saveUser();
closeModal('generic-modal');
if (workoutMode === 'plan') renderPlanMode();
toast('Treino aplicado ao dia atual! ', 'success');
}
function sendChatMessage() {
const input = document.getElementById('chat-input');
const msg = input.value.trim();
if (!msg) return;
const container = document.getElementById('chat-container');
container.innerHTML += `<div class="chat-msg user">${msg}</div>`;
input.value = '';
container.scrollTop = container.scrollHeight;
document.getElementById('typing-indicator').style.display = 'block';
setTimeout(() => {
document.getElementById('typing-indicator').style.display = 'none';
const response = getAIResponse(msg);
container.innerHTML += `<div class="chat-msg ai">${response}</div>`;
container.scrollTop = container.scrollHeight;
}, 1000 + Math.random() * 1000);
}
function getAIResponse(msg) {
const lower = msg.toLowerCase();
if (lower.includes('ola') || lower.includes('oi')) return "Olá! 👋 Sou seu assistente fitness. Posso te ajudar com dúvidas sobre treinos, dieta, execução de exercícios ou motivação.";
if (lower.includes('proteina') || lower.includes('whey')) return "🥩 A proteína é essencial para a recuperação muscular! Tente consumir entre 1.6g a 2.2g por kg de peso corporal diariamente.";
if (lower.includes('dor') || lower.includes('lesao')) return "⚠️ Se a dor for aguda ou nas articulações, pare o exercício imediatamente e descanse. Consulte um médico se persistir.";
if (lower.includes('emagrecer') || lower.includes('perder peso')) return "🔥 Para emagrecer, o déficit calórico é fundamental. Foque em exercícios compostos e mantenha a proteína alta.";
if (lower.includes('treino') || lower.includes('hipertrofia')) return "💪 Para hipertrofia, a chave é a progressão de carga e volume. Tente fazer 3-4 séries de 8-12 repetições, chegando perto da falha.";
if (lower.includes('agua')) return "💧 A hidratação é crucial! Tente beber pelo menos 35ml de água por kg de peso corporal diariamente.";
return "Interessante! 🤔 Para te dar a melhor orientação, foque em consistência, progressão de carga e uma boa alimentação. Quer que eu gere um treino específico?";
}
/* ============================================
FUNÇÕES DE GESTÃO (ACADEMY)
============================================ */
function populateStudentSelects() {
const datalist = document.getElementById('student-datalist');
if (datalist) {
const alunos = db.students.filter(s => s.role === 'Aluno');
datalist.innerHTML = alunos.map(s => `<option value="${s.name}">`).join('');
}
const transSelect = document.getElementById('trans-student');
if (transSelect) {
transSelect.innerHTML = db.students.filter(s => s.role === 'Aluno').map(s => `<option value="${s.name}">${s.name}</option>`).join('');
}
}
function renderStudents() {
const tbody = document.getElementById('students-table-body');
if (!tbody) return;
tbody.innerHTML = db.students.map(s => `
<tr>
<td><div style="font-weight:600;">${s.name}</div><div class="text-xs text-muted">${s.email}</div></td>
<td><span class="chip ${s.role === 'Aluno' ? 'primary' : 'info'}">${s.role}</span></td>
<td>${s.plan}</td>
<td>${s.validity}</td>
<td><span class="status ${s.status === 'Ativo' ? 'active' : 'pending'}" onclick="toggleStudentStatus(${s.id})">${s.status}</span></td>
<td>
<button class="btn btn-sm btn-secondary" onclick="editStudent(${s.id})">✏️</button>
<button class="btn btn-sm btn-danger" onclick="deleteStudent(${s.id})">🗑️</button>
</td>
</tr>
`).join('');
}
function filterStudents(q) {
const lower = q.toLowerCase();
const filtered = db.students.filter(s => s.name.toLowerCase().includes(lower) || s.email.toLowerCase().includes(lower));
const tbody = document.getElementById('students-table-body');
tbody.innerHTML = filtered.map(s => `
<tr>
<td><div style="font-weight:600;">${s.name}</div><div class="text-xs text-muted">${s.email}</div></td>
<td><span class="chip ${s.role === 'Aluno' ? 'primary' : 'info'}">${s.role}</span></td>
<td>${s.plan}</td>
<td>${s.validity}</td>
<td><span class="status ${s.status === 'Ativo' ? 'active' : 'pending'}">${s.status}</span></td>
<td>
<button class="btn btn-sm btn-secondary" onclick="editStudent(${s.id})">✏️</button>
<button class="btn btn-sm btn-danger" onclick="deleteStudent(${s.id})">️</button>
</td>
</tr>
`).join('');
}
function addNewStudent() {
const name = document.getElementById('new-student-name').value;
const email = document.getElementById('new-student-email').value;
const role = document.getElementById('new-student-role').value;
const plan = document.getElementById('new-student-plan').value;
const validity = document.getElementById('new-student-validity').value;
const lgpd = document.getElementById('lgpd-check').checked;
if (!name || !email || !validity) return UI.warning('Campos obrigatórios', 'Preencha nome, email e validade.');
if (!lgpd) return UI.warning('LGPD', 'É necessário aceitar os termos da LGPD para prosseguir.');
db.students.push({ id: Date.now(), name, email, role, plan, validity, status: 'Ativo' });
saveDB();
closeModal('add-student-modal');
renderStudents();
toast('Aluno cadastrado com sucesso! ✅', 'success');
}
function toggleStudentStatus(id) {
const s = db.students.find(x => x.id === id);
if (s) {
s.status = s.status === 'Ativo' ? 'Pendente' : 'Ativo';
saveDB();
renderStudents();
}
}
function deleteStudent(id) {
UI.confirm('Excluir aluno?', 'Esta ação removerá o aluno do sistema.', 'danger').then(ok => {
if (!ok) return;
db.students = db.students.filter(s => s.id !== id);
saveDB();
renderStudents();
toast('Aluno removido', 'info');
});
}
function renderFinancial() {
const tbody = document.getElementById('financial-table-body');
if (!tbody) return;
let expected = 0, received = 0, late = 0;
tbody.innerHTML = db.transactions.map(t => {
expected += t.value;
if (t.status === 'Pago') received += t.value;
else late += t.value;
return `
<tr>
<td style="font-weight:600;">${t.student}</td>
<td>${t.desc}</td>
<td>${t.due}</td>
<td>R$ ${t.value.toFixed(2)}</td>
<td><span class="chip ${t.method === 'PIX' ? 'primary' : 'accent'}">${t.method}</span></td>
<td><span class="status ${t.status === 'Pago' ? 'active' : (t.status === 'Pendente' ? 'pending' : 'churn')}" onclick="toggleTransactionStatus(${t.id})" style="cursor:pointer;">${t.status}</span></td>
<td>
${t.status !== 'Pago' ? `<button class="btn btn-sm btn-primary" onclick="toggleTransactionStatus(${t.id})">Marcar Pago</button>` : '<span class="text-xs text-muted">Concluído</span>'}
</td>
</tr>
`}).join('');
document.getElementById('fin-expected').textContent = `R$ ${expected.toFixed(2)}`;
document.getElementById('fin-received').textContent = `R$ ${received.toFixed(2)}`;
document.getElementById('fin-late').textContent = `R$ ${late.toFixed(2)}`;
}
function toggleTransactionStatus(id) {
const t = db.transactions.find(x => x.id === id);
if (t) {
t.status = t.status === 'Pago' ? 'Pendente' : 'Pago';
saveDB();
renderFinancial();
toast('Status atualizado!', 'success');
}
}
function addTransaction() {
const student = document.getElementById('trans-student').value;
const desc = document.getElementById('trans-desc').value;
const value = parseFloat(document.getElementById('trans-value').value);
const due = document.getElementById('trans-due').value;
const method = document.getElementById('trans-method').value;
if (!student || !value || !due) return UI.warning('Campos obrigatórios', 'Preencha todos os dados.');
db.transactions.push({ id: Date.now(), student, desc, due, value, method, status: 'Pendente' });
saveDB();
closeModal('add-transaction-modal');
renderFinancial();
toast('Transação registrada!', 'success');
}
function renderSchedule() {
const container = document.getElementById('schedule-grid-container');
if (!container) return;
const days = ['Horário', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
const times = ['07:00', '09:00', '18:00', '19:00', '20:00'];
let html = '';
days.forEach((d, i) => {
html += `<div class="schedule-cell header">${d}</div>`;
});
times.forEach(time => {
html += `<div class="schedule-cell" style="font-weight:700; display:flex; align-items:center; justify-content:center;">${time}</div>`;
for (let day = 1; day <= 5; day++) {
const classes = db.classes.filter(c => c.day == day && c.time === time);
html += `<div class="schedule-cell">`;
classes.forEach(c => {
html += `
<div class="schedule-class">
<button class="delete-class" onclick="deleteClass(${c.id})">✕</button>
<div class="title">${c.name}</div>
<div class="meta">${c.instructor}<br>${c.enrolled}/${c.capacity} alunos</div>
</div>
`;
});
html += `</div>`;
}
});
container.innerHTML = html;
}
function addClass() {
const day = parseInt(document.getElementById('class-day').value);
const time = document.getElementById('class-time').value;
const name = document.getElementById('class-name').value;
const instructor = document.getElementById('class-instructor').value;
const capacity = parseInt(document.getElementById('class-capacity').value);
if (!name || !instructor) return UI.warning('Campos obrigatórios', 'Preencha nome da aula e instrutor.');
db.classes.push({ id: Date.now(), day, time, name, instructor, capacity, enrolled: Math.floor(Math.random() * (capacity - 5)) + 5 });
saveDB();
closeModal('add-class-modal');
renderSchedule();
toast('Aula agendada com sucesso!', 'success');
}
function deleteClass(id) {
UI.confirm('Cancelar esta aula?', 'A aula será removida da grade.', 'danger').then(ok => {
if (!ok) return;
db.classes = db.classes.filter(c => c.id !== id);
saveDB();
renderSchedule();
toast('Aula cancelada', 'info');
});
}
function renderAccess() {
const tbody = document.getElementById('access-log-body');
if (!tbody) return;
tbody.innerHTML = db.accessLogs.map(log => `
<tr>
<td>${log.time}</td>
<td style="font-weight:600;">${log.student}</td>
<td>${log.method}</td>
<td>${log.location}</td>
<td><span class="status ${log.status === 'Autorizado' ? 'active' : 'churn'}">${log.status}</span></td>
</tr>
`).join('');
}
function filterAccessLogs(q) {
const lower = q.toLowerCase();
const filtered = db.accessLogs.filter(log => log.student.toLowerCase().includes(lower));
const tbody = document.getElementById('access-log-body');
tbody.innerHTML = filtered.map(log => `
<tr>
<td>${log.time}</td>
<td style="font-weight:600;">${log.student}</td>
<td>${log.method}</td>
<td>${log.location}</td>
<td><span class="status ${log.status === 'Autorizado' ? 'active' : 'churn'}">${log.status}</span></td>
</tr>
`).join('');
}
function simulateAccessLog() {
const students = db.students.filter(s => s.role === 'Aluno').map(s => s.name);
if (students.length === 0) return UI.warning('Nenhum aluno', 'Cadastre alunos primeiro.');
const methods = ['Biometria', 'QR Code', 'Reconhecimento Facial'];
const statuses = ['Autorizado', 'Autorizado', 'Negado (Mensalidade)'];
const rand = Math.floor(Math.random() * students.length);
const now = new Date();
const timeStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
const newLog = {
time: timeStr,
student: students[rand],
method: methods[Math.floor(Math.random() * methods.length)],
location: 'Catraca Principal',
status: statuses[Math.floor(Math.random() * statuses.length)]
};
db.accessLogs.unshift(newLog);
saveDB();
renderAccess();
toast(`Acesso: ${newLog.student}`, newLog.status === 'Autorizado' ? 'success' : 'error');
}
function openAssessmentModal() {
populateStudentSelects();
openModal('add-assessment-modal');
}
function calcAssessIMC() {
const w = parseFloat(document.getElementById('assess-weight').value);
const h = parseFloat(document.getElementById('assess-height').value) / 100;
if (w && h) {
const imc = (w / (h * h)).toFixed(1);
document.getElementById('assess-imc').value = imc;
} else {
document.getElementById('assess-imc').value = '';
}
}
function saveAssessment() {
const student = document.getElementById('assess-student').value;
const date = document.getElementById('assess-date').value;
const weight = parseFloat(document.getElementById('assess-weight').value);
const height = parseFloat(document.getElementById('assess-height').value);
const fat = parseFloat(document.getElementById('assess-fat').value) || 0;
const muscle = parseFloat(document.getElementById('assess-muscle').value) || 0;
const waist = parseFloat(document.getElementById('assess-waist').value) || 0;
const hip = parseFloat(document.getElementById('assess-hip').value) || 0;
const goal = document.getElementById('assess-goal').value;
const notes = document.getElementById('assess-notes').value;
const generateWorkout = document.getElementById('generate-workout-check').checked;
if (!student || !weight || !height) return UI.warning('Campos obrigatórios', 'Preencha pelo menos aluno, peso e altura.');
const imc = (weight / ((height/100) ** 2)).toFixed(1);
const assessment = {
id: Date.now(), student, date, weight, height, imc, fat, muscle, waist, hip, goal, notes
};
db.assessments.push(assessment);
if (generateWorkout) {
generateWeeklyWorkoutFromAssessment(goal);
}
saveDB();
closeModal('add-assessment-modal');
renderAssessments();
toast(generateWorkout ? 'Avaliação salva e treino Seg-Sex gerado com sucesso! 🚀' : 'Avaliação salva com sucesso!', 'success');
}
function generateWeeklyWorkoutFromAssessment(goal) {
const u = currentUser();
const lib = EXERCISE_LIBRARY;
const getEx = (focus, count, sets, reps, rest) => {
const pool = lib.filter(ex => ex.focus === focus || (focus === 'Braço' && (ex.focus === 'Bíceps' || ex.focus === 'Tríceps')));
return pool.sort(() => 0.5 - Math.random()).slice(0, count).map(ex => ({
name: ex.name, sets, reps, weight: 0, rest, focus: ex.focus
}));
};
if (goal === 'emagrecimento') {
u.workouts[1] = getEx('Perna', 4, 3, 15, 45).concat(getEx('Core', 2, 3, 20, 30));
u.workouts[2] = getEx('Peito', 3, 3, 12, 45).concat(getEx('Tríceps', 2, 3, 15, 45));
u.workouts[3] = getEx('Costas', 3, 3, 12, 45).concat(getEx('Bíceps', 2, 3, 15, 45));
u.workouts[4] = getEx('Ombro', 3, 3, 15, 45).concat(getEx('Core', 2, 3, 20, 30));
u.workouts[5] = getEx('Perna', 3, 3, 15, 45).concat(getEx('Braço', 2, 3, 15, 45));
} else {
u.workouts[1] = getEx('Peito', 4, 4, 8, 90).concat(getEx('Tríceps', 2, 3, 10, 60));
u.workouts[2] = getEx('Costas', 4, 4, 8, 90).concat(getEx('Bíceps', 2, 3, 10, 60));
u.workouts[3] = getEx('Perna', 5, 4, 8, 120);
u.workouts[4] = getEx('Ombro', 4, 4, 10, 60).concat(getEx('Core', 2, 3, 15, 60));
u.workouts[5] = getEx('Braço', 4, 4, 10, 60).concat(getEx('Core', 2, 3, 15, 60));
}
saveUser();
}
function renderAssessments() {
const list = document.getElementById('assessment-student-list');
if (!list) return;
const byStudent = {};
db.assessments.forEach(a => {
if (!byStudent[a.student]) byStudent[a.student] = [];
byStudent[a.student].push(a);
});
list.innerHTML = Object.keys(byStudent).map(student => {
const last = byStudent[student].sort((a,b) => new Date(b.date) - new Date(a.date))[0];
return `
<div class="plan-card" style="padding:12px; cursor:pointer; margin-bottom:8px;" onclick="showAssessmentDetails('${student}')">
<div style="font-weight:600;">${student}</div>
<div class="text-xs text-muted">Última: ${new Date(last.date).toLocaleDateString('pt-BR')} · IMC: ${last.imc}</div>
</div>
`;
}).join('') || '<div class="empty" style="padding:20px;"><div class="ic">📋</div><div>Nenhuma avaliação registrada</div></div>';
}
function filterAssessments(q) {
const lower = q.toLowerCase();
const list = document.getElementById('assessment-student-list');
const byStudent = {};
db.assessments.forEach(a => {
if (a.student.toLowerCase().includes(lower)) {
if (!byStudent[a.student]) byStudent[a.student] = [];
byStudent[a.student].push(a);
}
});
list.innerHTML = Object.keys(byStudent).map(student => {
const last = byStudent[student].sort((a,b) => new Date(b.date) - new Date(a.date))[0];
return `
<div class="plan-card" style="padding:12px; cursor:pointer; margin-bottom:8px;" onclick="showAssessmentDetails('${student}')">
<div style="font-weight:600;">${student}</div>
<div class="text-xs text-muted">Última: ${new Date(last.date).toLocaleDateString('pt-BR')} · IMC: ${last.imc}</div>
</div>
`;
}).join('') || '<div class="empty" style="padding:20px;"><div class="ic">📋</div><div>Nenhum resultado encontrado</div></div>';
}
function showAssessmentDetails(studentName) {
const assessments = db.assessments.filter(a => a.student === studentName).sort((a,b) => new Date(b.date) - new Date(a.date));
if (assessments.length === 0) return;
const last = assessments[0];
const details = document.getElementById('assessment-details');
details.innerHTML = `
<div style="animation: fadeIn 0.3s;">
<h4 style="margin-bottom:12px;">${last.student}</h4>
<div class="grid-2" style="margin-bottom:16px;">
<div class="stat-card"><div class="label">Peso</div><div class="value" style="font-size:20px;">${last.weight} kg</div></div>
<div class="stat-card"><div class="label">Altura</div><div class="value" style="font-size:20px;">${last.height} cm</div></div>
<div class="stat-card"><div class="label">IMC</div><div class="value" style="font-size:20px; color:var(--primary);">${last.imc}</div></div>
<div class="stat-card"><div class="label">% Gordura</div><div class="value" style="font-size:20px;">${last.fat}%</div></div>
<div class="stat-card"><div class="label">Cintura</div><div class="value" style="font-size:20px;">${last.waist} cm</div></div>
<div class="stat-card"><div class="label">Quadril</div><div class="value" style="font-size:20px;">${last.hip} cm</div></div>
</div>
<div class="card" style="background:var(--bg-2); margin-bottom:16px;">
<div class="text-sm text-muted" style="margin-bottom:6px;">Objetivo</div>
<div style="font-size:14px; font-weight:600; text-transform:capitalize;">${last.goal}</div>
</div>
${last.notes ? `
<div class="card" style="background:var(--bg-2);">
<div class="text-sm text-muted" style="margin-bottom:6px;">Anamnese / Observações</div>
<div style="font-size:14px; line-height:1.5;">${last.notes}</div>
</div>` : ''}
<button class="btn btn-primary btn-block mt-3" onclick="navigate('workouts')">📋 Ver Treino Gerado</button>
</div>
`;
}
/* ============================================
NUTRIÇÃO INTELIGENTE
============================================ */
const FOOD_DATABASE = [
{ name: 'Ovos mexidos (2 unid.)', meal: 'cafe', tags: ['protein', 'gluten_free'], cal: 140, p: 12, c: 1, f: 9 },
{ name: 'Pão integral (2 fatias)', meal: 'cafe', tags: ['carb', 'fiber'], cal: 160, p: 6, c: 30, f: 2 },
{ name: 'Tapioca com queijo branco', meal: 'cafe', tags: ['carb', 'dairy', 'gluten_free'], cal: 200, p: 10, c: 35, f: 4 },
{ name: 'Mingau de aveia com banana', meal: 'cafe', tags: ['carb', 'fiber', 'vegan'], cal: 250, p: 8, c: 45, f: 4 },
{ name: 'Iogurte natural (tipo Danone sem açúcar)', meal: 'cafe', tags: ['dairy', 'probiotic', 'gluten_free'], cal: 80, p: 5, c: 10, f: 2 },
{ name: 'Whey Protein com água', meal: 'cafe', tags: ['protein', 'gluten_free'], cal: 120, p: 24, c: 3, f: 1 },
{ name: 'Mix de castanhas (30g)', meal: 'lanche', tags: ['fat', 'vegan', 'gluten_free'], cal: 180, p: 5, c: 6, f: 16 },
{ name: 'Fruta (Maçã ou Pera)', meal: 'lanche', tags: ['carb', 'fiber', 'vegan', 'gluten_free'], cal: 80, p: 0, c: 20, f: 0 },
{ name: 'Iogurte proteico', meal: 'lanche', tags: ['dairy', 'protein'], cal: 100, p: 15, c: 8, f: 1 },
{ name: 'Salada de frutas sem açúcar', meal: 'lanche', tags: ['carb', 'vegan', 'gluten_free'], cal: 120, p: 1, c: 30, f: 0 },
{ name: 'Peito de frango grelhado (150g)', meal: 'principal', tags: ['protein', 'gluten_free', 'lean'], cal: 240, p: 45, c: 0, f: 5 },
{ name: 'Patinho moído (150g)', meal: 'principal', tags: ['protein', 'gluten_free', 'iron'], cal: 280, p: 40, c: 0, f: 12 },
{ name: 'Tilápia assada (150g)', meal: 'principal', tags: ['protein', 'gluten_free', 'lean'], cal: 150, p: 30, c: 0, f: 3 },
{ name: 'Omelete de 3 ovos com espinafre', meal: 'principal', tags: ['protein', 'gluten_free'], cal: 220, p: 18, c: 2, f: 15 },
{ name: 'Arroz integral (4 col. sopa)', meal: 'principal', tags: ['carb', 'fiber', 'gluten_free', 'vegan'], cal: 110, p: 3, c: 23, f: 1 },
{ name: 'Batata doce cozida (150g)', meal: 'principal', tags: ['carb', 'fiber', 'vegan', 'gluten_free'], cal: 130, p: 2, c: 30, f: 0 },
{ name: 'Macarrão integral (80g cru)', meal: 'principal', tags: ['carb', 'fiber'], cal: 280, p: 10, c: 58, f: 2 },
{ name: 'Salada verde livre (Alface, Rúcula, Tomate)', meal: 'principal', tags: ['fiber', 'vegan', 'gluten_free', 'low_cal'], cal: 30, p: 2, c: 5, f: 0 },
{ name: 'Brócolis e Couve-flor no vapor', meal: 'principal', tags: ['fiber', 'vegan', 'gluten_free', 'low_cal'], cal: 50, p: 4, c: 10, f: 0 },
{ name: 'Chá de camomila + 2 quadradinhos de chocolate 70%', meal: 'ceia', tags: ['dairy_free', 'gluten_free'], cal: 120, p: 2, c: 10, f: 8 },
{ name: 'Abacate (1/4 unid.)', meal: 'ceia', tags: ['fat', 'vegan', 'gluten_free'], cal: 160, p: 2, c: 9, f: 15 },
{ name: 'Gelatina zero', meal: 'ceia', tags: ['low_cal', 'gluten_free'], cal: 10, p: 1, c: 1, f: 0 }
];
function renderNutrition() {
const u = currentUser();
const formContainer = document.getElementById('nutrition-form-container');
const planDisplay = document.getElementById('nutrition-plan-display');
if (u.nutritionPlan) {
formContainer.style.display = 'none';
planDisplay.style.display = 'block';
displayGeneratedPlan(u.nutritionPlan);
} else {
formContainer.style.display = 'block';
planDisplay.style.display = 'none';
}
}
function generateSmartDiet() {
const goal = document.getElementById('nutri-goal').value;
const restrictions = [];
if (document.getElementById('rest-lactose').checked) restrictions.push('dairy');
if (document.getElementById('rest-gluten').checked) restrictions.push('gluten');
if (document.getElementById('rest-diabetes').checked) restrictions.push('high_sugar');
if (document.getElementById('rest-hipertensao').checked) restrictions.push('high_sodium');
const freeMeal = document.getElementById('nutri-free-meal').value.trim() || 'Refeição livre à escolha (com moderação)';
let safeFoods = FOOD_DATABASE.filter(food => {
for (let rest of restrictions) {
if (food.tags.includes(rest)) return false;
}
return true;
});
const getRandomSafe = (mealType) => {
const options = safeFoods.filter(f => f.meal === mealType);
return options.length > 0 ? options[Math.floor(Math.random() * options.length)] : { name: 'Opção segura não encontrada, consulte nutricionista', cal: 0, p:0, c:0, f:0 };
};
const portion = goal === 'hipertrofia' ? 'Porção aumentada (+20%)' : (goal === 'emagrecimento' ? 'Porção reduzida (-15%)' : 'Porção padrão');
const plan = {
goal, restrictions, freeMeal, portion,
cafe: getRandomSafe('cafe'),
lanche_manha: getRandomSafe('lanche'),
almoco: [getRandomSafe('principal'), getRandomSafe('principal'), getRandomSafe('principal')],
lanche_tarde: getRandomSafe('lanche'),
jantar: [getRandomSafe('principal'), getRandomSafe('principal')],
ceia: getRandomSafe('ceia')
};
const u = currentUser();
u.nutritionPlan = plan;
saveUser();
renderNutrition();
toast('Plano alimentar gerado com sucesso! 🥗', 'success');
}
function displayGeneratedPlan(plan) {
const container = document.getElementById('nutrition-meals-container');
document.getElementById('display-free-meal').textContent = plan.freeMeal;
const meals = [
{ title: 'Café da Manhã', time: '07:00 - 08:00', icon: '☕', items: [plan.cafe] },
{ title: 'Lanche da Manhã', time: '10:00', icon: '🍎', items: [plan.lanche_manha] },
{ title: 'Almoço', time: '12:00 - 13:00', icon: '🍽️', items: plan.almoco },
{ title: 'Lanche da Tarde', time: '16:00', icon: '🥜', items: [plan.lanche_tarde] },
{ title: 'Jantar', time: '19:00 - 20:00', icon: '🥗', items: plan.jantar },
{ title: 'Ceia', time: '21:30', icon: '🌙', items: [plan.ceia] }
];
let html = `<div class="chip accent mb-3" style="font-size:13px; padding:6px 12px;">Objetivo: ${plan.goal.toUpperCase()} | ${plan.portion}</div>`;
meals.forEach(m => {
html += `<div class="meal-card">
<div class="meal-header">
<div class="meal-icon">${m.icon}</div>
<div>
<div class="meal-title">${m.title}</div>
<div class="meal-time">${m.time}</div>
</div>
</div>
<ul class="food-list">`;
m.items.forEach(item => {
html += `<li class="food-item">
<span class="food-name">${item.name}</span>
<span class="food-macros">${item.cal} kcal | P:${item.p}g C:${item.c}g G:${item.f}g</span>
</li>`;
});
html += `</ul></div>`;
});
container.innerHTML = html;
}
function resetNutritionForm() {
const u = currentUser();
u.nutritionPlan = null;
saveUser();
renderNutrition();
}
/* ============================================
UTILS
============================================ */
function toast(msg, type='info') {
const t = document.createElement('div');
t.className = 'toast ' + type;
const icons = {success:'✓',error:'✕',warning:'️',info:'ℹ️'};
t.innerHTML = `<span style="font-size:18px;">${icons[type]||'ℹ️'}</span> ${msg}`;
document.body.appendChild(t);
setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(100px)'; t.style.transition='all 0.3s'; setTimeout(()=>t.remove(),300); }, 3000);
}
function exportData() {
const data = JSON.stringify(currentUser(), null, 2);
const blob = new Blob([data], {type:'application/json'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = 'fitpro-dados.json';
a.click();
toast('Dados exportados! 📥','success');
}
function getIcon(focus) { return {'Peito':'💪','Costas':'🔙','Perna':'🦵','Ombro':'️','Bíceps':'💪','Tríceps':'💪','Core':'🎯','Cardio':'🏃','Full Body':'','Braço':'💪'}[focus] || '💪'; }
/* ============================================
INIT
============================================ */
loadDB(); applyTheme();
if (db.currentUserId && db.users[db.currentUserId]) enterApp();
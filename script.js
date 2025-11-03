
// Client simple pour le jeu - se connecte au serveur Socket.IO
const SERVER_URL = "https://socketio-server-q0ai.onrender.com";
const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

let localId = null;
let localName = '';
let room = '';
let level = 'easy';
let currentQuestion = null;
let questionTimer = null;
let timeLeft = 30;

const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const demoBtn = document.getElementById('demoBtn');
const nameInput = document.getElementById('nameInput');
const roomInput = document.getElementById('roomInput');
const playersList = document.getElementById('playersList');
const createdRoom = document.getElementById('createdRoom');
const levelSelect = document.getElementById('levelSelect');
const lobby = document.getElementById('lobby');
const gameSec = document.getElementById('game');
const finishedSec = document.getElementById('finished');
const playersTrack = document.getElementById('track');
const questionText = document.getElementById('questionText');
const choicesDiv = document.getElementById('choices');
const timerDisplay = document.getElementById('timerDisplay');
const useBoostBtn = document.getElementById('useBoostBtn');
const playerNameLabel = document.getElementById('playerNameLabel');
const playersListEl = document.getElementById('playersList');
const muteBtn = document.getElementById('muteBtn');
const bgMusic = document.getElementById('bgMusic');
const podiumDiv = document.getElementById('podium');
const replayBtn = document.getElementById('replayBtn');
const backBtn = document.getElementById('backBtn');

bgMusic.volume = 0.25;
let muted = false;

muteBtn.addEventListener('click', () => {
  muted = !muted;
  if (muted) { bgMusic.pause(); muteBtn.textContent = 'Musique ON'; }
  else { bgMusic.play(); muteBtn.textContent = 'Musique OFF'; }
});

createBtn.addEventListener('click', () => {
  level = levelSelect.value;
  socket.emit('createRoom', { level }, (resp) => {
    if (resp && resp.room) {
      room = resp.room;
      createdRoom.textContent = 'Code de la salle : ' + room;
      alert('Salle créée : ' + room + '. Les étudiants peuvent la rejoindre.');
    }
  });
});

joinBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  const r = roomInput.value.trim();
  if (!name || !r) return alert('Entrez un nom et un code de salle.');
  localName = name; room = r; level = levelSelect.value;
  socket.emit('joinRoom', { room, name }, (resp) => {
    if (resp && resp.success) {
      localId = resp.playerId;
      playerNameLabel.textContent = localName;
      lobby.classList.add('hidden');
      gameSec.classList.remove('hidden');
    } else {
      alert('Impossible de rejoindre la salle: ' + (resp?.message || 'erreur'));
    }
  });
});

demoBtn.addEventListener('click', () => {
  // Simple demo mode: local play without server (single device)
  localName = 'Vous (démo)';
  localId = 'local';
  room = 'demo';
  lobby.classList.add('hidden');
  gameSec.classList.remove('hidden');
  // create dummy players
  const dummy = [];
  for (let i=0;i<6;i++) dummy.push({ id: 'p'+i, name: i===0?localName:'AI '+i, position:0, boostAvailable:false, boostTimer:0 });
  updatePlayers(dummy);
  // send first question locally
  requestNextQuestionLocal();
});

socket.on('lobbyUpdate', (payload) => {
  updatePlayers(payload.players || []);
});

socket.on('gameStart', (payload) => {
  updatePlayers(payload.players || []);
});

socket.on('playerQuestion', (payload) => {
  if (payload.playerId === localId) {
    currentQuestion = payload.question;
    showQuestion(currentQuestion);
  }
});

socket.on('gameState', (payload) => {
  updatePlayers(payload.players || []);
  if (payload.finished) {
    showFinished(payload.players || []);
  }
});

socket.on('review', (payload) => {
  showFinished(payload.players || []);
});

socket.on('boostActivated', (payload) => {
  // remove one choice from UI
  if (!currentQuestion) return;
  const removeIndex = payload.removeIndex;
  const btn = document.querySelector('#choice-' + removeIndex);
  if (btn) {
    btn.disabled = true;
    btn.textContent = btn.textContent + ' (supprimé)';
  }
});

function updatePlayers(list) {
  playersListEl.innerHTML = '';
  playersTrack.innerHTML = '';
  list.forEach((p, i) => {
    const li = document.createElement('li');
    li.textContent = p.name + ' — ' + (p.position || 0) + ' pts';
    playersListEl.appendChild(li);

    // track
    const lane = document.createElement('div');
    lane.className = 'player-lane';
    const dot = document.createElement('div');
    dot.className = 'player-dot';
    dot.textContent = p.name ? p.name[0].toUpperCase() : 'U';
    lane.appendChild(dot);
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    const pct = Math.min(100, Math.round(((p.position||0) / 20) * 100));
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    lane.appendChild(bar);
    const score = document.createElement('div');
    score.style.width = '50px';
    score.style.textAlign = 'right';
    score.textContent = (p.position||0) + ' pts';
    lane.appendChild(score);
    playersTrack.appendChild(lane);
  });
}

function showQuestion(q) {
  questionText.textContent = q.q;
  choicesDiv.innerHTML = '';
  q.choices.forEach((c, idx) => {
    const b = document.createElement('button');
    b.id = 'choice-' + idx;
    b.textContent = c;
    b.addEventListener('click', () => submitAnswer(idx));
    choicesDiv.appendChild(b);
  });
  timeLeft = 30;
  timerDisplay.textContent = timeLeft;
  if (questionTimer) clearInterval(questionTimer);
  questionTimer = setInterval(() => {
    timeLeft -= 1;
    timerDisplay.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(questionTimer);
      submitAnswer(null);
    }
  }, 1000);
}

function submitAnswer(choiceIdx) {
  if (!room || !localId) return;
  if (questionTimer) { clearInterval(questionTimer); questionTimer = null; }
  if (room === 'demo') {
    // local demo logic: simple correct/incorrect handling with random AI moves
    const correct = choiceIdx !== null && choiceIdx === currentQuestion.a;
    if (correct) alert('Bonne réponse (démo) !'); else alert('Mauvaise réponse (démo).');
    requestNextQuestionLocal();
    return;
  }
  socket.emit('answer', { room, playerId: localId, choice: choiceIdx });
}

function requestNextQuestionLocal() {
  // pick a local question set (embedded here for demo)
  const banks = { easy: [], medium: [], hard: [] };
  // minimal demo questions (client will not use for full games)
  const q = { q: 'Demo question: The hotel ___ be full.', choices: ['must','might','should'], a:1 };
  currentQuestion = q;
  showQuestion(q);
}

useBoostBtn.addEventListener('click', () => {
  if (!room || !localId) return;
  socket.emit('useBoost', { room, playerId: localId });
});

replayBtn.addEventListener('click', () => {
  if (!room) return;
  socket.emit('restart', { room });
  finishedSec.classList.add('hidden');
  lobby.classList.remove('hidden');
});

backBtn.addEventListener('click', () => {
  finishedSec.classList.add('hidden');
  lobby.classList.remove('hidden');
  gameSec.classList.add('hidden');
});

function showFinished(players) {
  gameSec.classList.add('hidden');
  finishedSec.classList.remove('hidden');
  // sort players
  const sorted = players.slice().sort((a,b)=> (b.position||0) - (a.position||0));
  podiumDiv.innerHTML = '';
  const pEl = document.createElement('div');
  pEl.className = 'podium';
  sorted.slice(0,3).forEach((p, idx) => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.innerHTML = '<div class="name">' + p.name + '</div><div class="score">' + (p.position || 0) + ' pts</div>';
    pEl.appendChild(slot);
  });
  podiumDiv.appendChild(pEl);
  // stop music
  bgMusic.pause();
}

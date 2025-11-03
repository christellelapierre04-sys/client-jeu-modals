
// Full client script for Course des Modals (connects to your server)
const SERVER_URL = "https://socketio-server-q0ai.onrender.com";
const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

// ... rest of script will be simple and use the QUESTIONS variable below
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
const startBtn = document.getElementById('startBtn');
const hostControls = document.getElementById('hostControls');

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
      alert('Salle créée : ' + room + '. Envoyez le code aux étudiants.');
      hostControls.classList.remove('hidden');
    }
  });
});

startBtn && startBtn.addEventListener('click', () => {
  if (!room) return alert('Aucune salle.');
  socket.emit('startGame', { room, level });
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
  localName = 'Vous (démo)';
  localId = 'local';
  room = 'demo';
  lobby.classList.add('hidden');
  gameSec.classList.remove('hidden');
  const dummy = [];
  for (let i=0;i<6;i++) dummy.push({ id: 'p'+i, name: i===0?localName:'AI '+i, position:0, boostAvailable:false, boostTimer:0 });
  updatePlayers(dummy);
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
    const correct = choiceIdx !== null && choiceIdx === currentQuestion.a;
    if (correct) alert('Bonne réponse (démo) !'); else alert('Mauvaise réponse (démo).');
    requestNextQuestionLocal();
    return;
  }
  socket.emit('answer', { room, playerId: localId, choice: choiceIdx });
}

function requestNextQuestionLocal() {
  const banks = QUESTIONS;
  const q = banks[level][Math.floor(Math.random()*banks[level].length)];
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


function showFinished(players) {
  gameSec.classList.add('hidden');
  finishedSec.classList.remove('hidden');
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
  bgMusic.pause();
}


var QUESTIONS = {
  "easy": [
    {
      "q": "The train is late; they ___ be delayed by the storm.",
      "choices": [
        "must",
        "might",
        "should"
      ],
      "a": 1,
      "sector": "Transport"
    },
    {
      "q": "Guests ___ check out by 11 AM according to hotel policy.",
      "choices": [
        "must",
        "might",
        "could"
      ],
      "a": 0,
      "sector": "Accommodation"
    },
    {
      "q": "You ___ try the chef's special — it's excellent.",
      "choices": [
        "should",
        "might",
        "can"
      ],
      "a": 0,
      "sector": "Food"
    },
    {
      "q": "If the show is full, you ___ book the next available time.",
      "choices": [
        "must",
        "should",
        "might"
      ],
      "a": 1,
      "sector": "Entertainment"
    },
    {
      "q": "For payment, you ___ use cash or card at reception.",
      "choices": [
        "can",
        "must",
        "should"
      ],
      "a": 0,
      "sector": "Travel services"
    },
    {
      "q": "He ___ have taken the wrong bus; he isn't here yet.",
      "choices": [
        "must",
        "might",
        "could"
      ],
      "a": 1,
      "sector": "Transport"
    },
    {
      "q": "They ___ be in the restaurant — I just heard someone at the table next to them.",
      "choices": [
        "must",
        "might",
        "should"
      ],
      "a": 1,
      "sector": "Food"
    },
    {
      "q": "You ___ ask the concierge for a taxi — it's a free service.",
      "choices": [
        "should",
        "could",
        "must"
      ],
      "a": 1,
      "sector": "Accommodation"
    },
    {
      "q": "The hotel lights are on; they ___ be awake.",
      "choices": [
        "must",
        "can't",
        "might"
      ],
      "a": 2,
      "sector": "Accommodation"
    },
    {
      "q": "It looks cloudy — the tour ___ be cancelled.",
      "choices": [
        "must",
        "might",
        "should"
      ],
      "a": 1,
      "sector": "Entertainment"
    }
  ],
  "medium": [
    {
      "q": "The tour guide didn't show up; he ___ have missed his flight.",
      "choices": [
        "must",
        "might",
        "should"
      ],
      "a": 0,
      "sector": "Transport"
    },
    {
      "q": "They ___ have eaten already — the plates are empty.",
      "choices": [
        "must",
        "could",
        "might"
      ],
      "a": 0,
      "sector": "Food"
    },
    {
      "q": "You ___ have been given late notice about the event.",
      "choices": [
        "may",
        "must",
        "might"
      ],
      "a": 0,
      "sector": "Entertainment"
    },
    {
      "q": "The luggage is missing; it ___ have been left on the bus.",
      "choices": [
        "must",
        "could",
        "should"
      ],
      "a": 1,
      "sector": "Transport"
    },
    {
      "q": "They ___ not have checked the schedule properly.",
      "choices": [
        "might",
        "must",
        "could"
      ],
      "a": 0,
      "sector": "Transport"
    },
    {
      "q": "She ___ have been promoted — she wears a manager's badge.",
      "choices": [
        "must",
        "might",
        "could"
      ],
      "a": 0,
      "sector": "Travel services"
    },
    {
      "q": "If the kitchen was closed, you ___ have been told during check-in.",
      "choices": [
        "should",
        "must",
        "might"
      ],
      "a": 0,
      "sector": "Accommodation"
    },
    {
      "q": "He says he paid, but he ___ be lying.",
      "choices": [
        "might",
        "must",
        "could"
      ],
      "a": 2,
      "sector": "Travel services"
    },
    {
      "q": "The show is late — they ___ have had technical issues.",
      "choices": [
        "must",
        "might",
        "should"
      ],
      "a": 1,
      "sector": "Entertainment"
    },
    {
      "q": "You ___ have asked for a room with a view when booking.",
      "choices": [
        "should",
        "must",
        "could"
      ],
      "a": 0,
      "sector": "Accommodation"
    }
  ],
  "hard": [
    {
      "q": "By the time we arrived, the restaurant ___ have closed — there were no lights.",
      "choices": [
        "must",
        "might",
        "could"
      ],
      "a": 0,
      "sector": "Food"
    },
    {
      "q": "He ___ have taken a later train — his message said 'on my way'.",
      "choices": [
        "may",
        "must",
        "might"
      ],
      "a": 0,
      "sector": "Transport"
    },
    {
      "q": "The brochure is inaccurate; the company ___ have changed the itinerary without notice.",
      "choices": [
        "must",
        "might",
        "should"
      ],
      "a": 1,
      "sector": "Travel services"
    },
    {
      "q": "If she had left earlier, she ___ have caught the ferry.",
      "choices": [
        "would",
        "could",
        "might"
      ],
      "a": 0,
      "sector": "Transport"
    },
    {
      "q": "They ___ have offered a refund if they knew it was double-booked.",
      "choices": [
        "might",
        "must",
        "would"
      ],
      "a": 2,
      "sector": "Accommodation"
    },
    {
      "q": "Judging by the footprints, someone ___ have entered the room after housekeeping.",
      "choices": [
        "must",
        "might",
        "could"
      ],
      "a": 0,
      "sector": "Accommodation"
    },
    {
      "q": "From the sounds, the guests ___ have been enjoying the live music.",
      "choices": [
        "must",
        "might",
        "could"
      ],
      "a": 1,
      "sector": "Entertainment"
    },
    {
      "q": "They say the company is reliable; that ___ be true — I've seen many complaints.",
      "choices": [
        "must",
        "may",
        "can't"
      ],
      "a": 2,
      "sector": "Travel services"
    },
    {
      "q": "Had they known about the strike, they ___ have postponed the trip.",
      "choices": [
        "could",
        "would",
        "might"
      ],
      "a": 1,
      "sector": "Transport"
    },
    {
      "q": "The porter said he ___ have seen the package, but he's unsure.",
      "choices": [
        "might",
        "must",
        "could"
      ],
      "a": 0,
      "sector": "Travel services"
    }
  ]
};
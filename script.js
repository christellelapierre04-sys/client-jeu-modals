/* ======================================================
   SCRIPT.JS — Jeu Course des Modals (Thème Voyage)
   ====================================================== */

/* ================================
   Connexion au serveur
   ================================ */
const socket = io("https://socketio-server-1-lq9u.onrender.com", {
  transports: ["websocket"],
});

/* ================================
   Éléments du DOM
   ================================ */
const lobby = document.getElementById("lobby");
const game = document.getElementById("game");
const finished = document.getElementById("finished");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const playersList = document.getElementById("playersList");
const createdRoom = document.getElementById("createdRoom");
const hostControls = document.getElementById("hostControls");

const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const demoBtn = document.getElementById("demoBtn");
const startBtn = document.getElementById("startBtn");
const backBtn = document.getElementById("backBtn");

const questionText = document.getElementById("questionText");
const choicesDiv = document.getElementById("choices");
const timerDisplay = document.getElementById("timerDisplay");

const track = document.getElementById("track");
const levelSelect = document.getElementById("levelSelect");

const useBoostBtn = document.getElementById("useBoostBtn");

const podium = document.getElementById("podium");

const bgMusic = document.getElementById("bgMusic");
const muteBtn = document.getElementById("muteBtn");

let interval = null;
let timeLeft = 30;

let currentRoom = null;
let currentPlayer = null;
let currentLevel = "easy";
let usedBoost = false;
let questionBank = null;

/* ================================
   MUSIQUE
   ================================ */
muteBtn.addEventListener("click", () => {
  if (bgMusic.paused) {
    bgMusic.play();
    muteBtn.textContent = "Musique ON";
  } else {
    bgMusic.pause();
    muteBtn.textContent = "Musique OFF";
  }
});

/* ================================
   Chargement des questions JSON
   ================================ */
async function loadQuestions() {
  const res = await fetch("questions.json");
  questionBank = await res.json();
}

/* ================================
   TIMER
   ================================ */
function startTimer() {
  clearInterval(interval);
  timeLeft = 30;
  timerDisplay.textContent = timeLeft;

  interval = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(interval);
      sendAnswer(null); // Pas répondu
    }
  }, 1000);
}

/* ================================
   Interface
   ================================ */
function showLobby() {
  lobby.classList.remove("hidden");
  game.classList.add("hidden");
  finished.classList.add("hidden");
}

function showGame() {
  lobby.classList.add("hidden");
  game.classList.remove("hidden");
  finished.classList.add("hidden");
}

function showFinished() {
  lobby.classList.add("hidden");
  game.classList.add("hidden");
  finished.classList.remove("hidden");
}

/* ================================
   Création de salle
   ================================ */
createBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();

  if (!name) return alert("Entrez votre nom.");

  socket.emit("create-room", name);
});

socket.on("room-created", (roomCode) => {
  currentRoom = roomCode;
  createdRoom.textContent = "Salle créée : " + roomCode;
  hostControls.classList.remove("hidden");
});

/* ================================
   Rejoindre une salle
   ================================ */
joinBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  const room = roomInput.value.trim();

  if (!name) return alert("Entrez votre nom.");
  if (!room) return alert("Entrez un code de salle.");

  socket.emit("join-room", { name, room });
});

socket.on("room-joined", ({ room, name }) => {
  currentRoom = room;
  currentPlayer = name;
});

/* ================================
   Mode démo (solo)
   ================================ */
demoBtn.addEventListener("click", async () => {
  await loadQuestions();
  setupPlayerLanes(["Démo"]);
  askQuestion();
  showGame();
});

/* ================================
   Liste des joueurs
   ================================ */
socket.on("players-update", (players) => {
  playersList.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.name;
    playersList.appendChild(li);
  });

  setupPlayerLanes(players.map((p) => p.name));
});

/* ================================
   Démarrage du jeu
   ================================ */
startBtn.addEventListener("click", async () => {
  currentLevel = levelSelect.value;
  await loadQuestions();
  socket.emit("start-game", currentRoom, currentLevel);
  showGame();
});

/* ================================
   Lancement des questions depuis serveur
   ================================ */
socket.on("new-question", (data) => {
  showQuestion(data);
});

/* ================================
   Affichage question
   ================================ */
function showQuestion(question) {
  timeLeft = 30;
  questionText.textContent = question.q;
  choicesDiv.innerHTML = "";
  usedBoost = false;

  question.choices.forEach((choice, index) => {
    const btn = document.createElement("button");
    btn.textContent = choice;
    btn.addEventListener("click", () => sendAnswer(index));
    choicesDiv.appendChild(btn);
  });

  startTimer();
}

/* ================================
   Envoi de réponse
   ================================ */
function sendAnswer(answerIndex) {
  clearInterval(interval);

  socket.emit("answer", {
    room: currentRoom,
    name: currentPlayer,
    answer: answerIndex,
  });
}

/* ================================
   Progression joueurs sur la piste
   ================================ */
function setupPlayerLanes(players) {
  track.innerHTML = "";

  players.forEach((name) => {
    const lane = document.createElement("div");
    lane.className = "player-lane";

    const dot = document.createElement("div");
    dot.className = "player-dot";
    dot.textContent = name[0].toUpperCase();

    const bar = document.createElement("div");
    bar.className = "progress-bar";

    const fill = document.createElement("div");
    fill.className = "progress-fill";
    fill.id = "progress-" + name;

    bar.appendChild(fill);
    lane.appendChild(dot);
    lane.appendChild(bar);
    track.appendChild(lane);
  });
}

/* ================================
   Mise à jour des points
   ================================ */
socket.on("progress-update", ({ name, progress }) => {
  const fill = document.getElementById("progress-" + name);
  if (fill) fill.style.width = progress + "%";
});

/* ================================
   Boost (flamme)
   ================================ */
useBoostBtn.addEventListener("click", () => {
  if (usedBoost) return alert("Boost déjà utilisé !");
  usedBoost = true;

  socket.emit("use-boost", {
    room: currentRoom,
    name: currentPlayer,
  });
});

/* ================================
   Fin de partie
   ================================ */
socket.on("game-finished", (ranking) => {
  showFinished();
  podium.innerHTML = "";

  ranking.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "slot";

    div.innerHTML = `
      <h3>${i + 1}ᵉ place</h3>
      <strong>${p.name}</strong><br>
      ${Math.round(p.progress)}%
    `;

    podium.appendChild(div);
  });
});
/* ================================
   Lancement automatique de la musique
   ================================ */
window.addEventListener("load", () => {
  if (bgMusic) {
    bgMusic.volume = 0.4;
    bgMusic.play().catch(() => {
      console.log("Autoplay bloqué — l'utilisateur doit cliquer une fois");
    });
  }
});


/* ================================
   Retour au lobby
   ================================ */
backBtn.addEventListener("click", () => {
  showLobby();
});

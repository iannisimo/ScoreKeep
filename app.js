// --- STATE DEFINITION & LOCAL STORAGE ---
let state = {
  gameName: "My Board Game",
  players: [], // { id: string, name: string, scores: number[], total: number, colorIndex: number }
  rounds: 0,
  gameActive: false
};

// Colors for player color dots (matches classes in styles.css)
const MAX_COLORS = 8;

// Keep track of IDs for target elements in dialogs
let playerToDeleteId = null;
let scoreToEditData = null; // { playerId: string, roundIndex: number }
let roundToDeleteIndex = null;

// Load game state from local storage
function loadState() {
  const savedState = localStorage.getItem("scorekeep_state");
  if (savedState) {
    try {
      state = JSON.parse(savedState);

      // Clean up old default test names if the game was never started/played
      if (!state.gameActive && state.rounds === 0 && state.players && state.players.length === 3) {
        const names = state.players.map(p => p.name);
        if (names[0] === "Player 1" && names[1] === "Player 2" && names[2] === "Player 3") {
          state.players = [];
        }
      }
    } catch (e) {
      console.error("Error parsing saved state:", e);
    }
  }
}

// Save state to local storage
function saveState() {
  localStorage.setItem("scorekeep_state", JSON.stringify(state));
}

// --- DOM ELEMENTS ---
const appHeaderActions = document.getElementById("header-actions");
const setupView = document.getElementById("setup-view");
const gameView = document.getElementById("game-view");

const setupPlayerList = document.getElementById("setup-player-list");
const setupErrorMsg = document.getElementById("setup-error-msg");
const btnAddSetupPlayer = document.getElementById("btn-add-setup-player");
const btnClearSetupPlayers = document.getElementById("btn-clear-setup-players");
const btnStartGame = document.getElementById("btn-start-game");

const displayRoundNum = document.getElementById("display-round-num");
const leaderboardList = document.getElementById("leaderboard-list");
const scoreInputFields = document.getElementById("score-input-fields");
const formRoundScores = document.getElementById("form-round-scores");

const inputRuntimePlayerName = document.getElementById("input-runtime-player-name");
const runtimeErrorMsg = document.getElementById("runtime-error-msg");
const btnRuntimeAddPlayer = document.getElementById("btn-runtime-add-player");
const historyTable = document.getElementById("history-table");

// Dialogs
const dialogReset = document.getElementById("dialog-reset");
const dialogNewGame = document.getElementById("dialog-new-game");
const dialogDeletePlayer = document.getElementById("dialog-delete-player");
const dialogEditScore = document.getElementById("dialog-edit-score");
const dialogDeleteRound = document.getElementById("dialog-delete-round");

// Dialog Triggers/Buttons
const btnResetConfirm = document.getElementById("btn-reset-confirm");
const btnNewConfirm = document.getElementById("btn-new-confirm");

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  initSetupPlayers();
  setupEventListeners();
  render();
  registerServiceWorker();
});

// Register Service Worker for PWA
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js")
        .then(reg => console.log("Service Worker registered successfully.", reg.scope))
        .catch(err => console.error("Service Worker registration failed:", err));
    });
  }
}

// --- SETUP VIEW FUNCTIONS ---
function initSetupPlayers() {
  setupPlayerList.innerHTML = "";
  if (state.players.length === 0) {
    addSetupPlayerInput("");
  } else {
    // Populate setup fields from current state if starting a new setup
    state.players.forEach(p => addSetupPlayerInput(p.name));
  }

  // Focus the first input field on load
  const firstInput = setupPlayerList.querySelector(".setup-player-name-input");
  if (firstInput) {
    firstInput.focus();
  }
}

function addSetupPlayerInput(nameVal = "") {
  const row = document.createElement("div");
  row.className = "setup-player-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "setup-player-name-input";
  input.placeholder = `Player Name`;
  input.value = nameVal;

  // Clear error states on type/input
  input.addEventListener("input", () => {
    input.classList.remove("error");
    setupErrorMsg.classList.add("hidden");
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn-icon-only";
  deleteBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-inline" style="margin-right:0;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  `;

  deleteBtn.addEventListener("click", () => {
    // Keep at least 1 player input
    if (setupPlayerList.children.length > 1) {
      row.remove();
    }
  });

  row.appendChild(input);
  row.appendChild(deleteBtn);
  setupPlayerList.appendChild(row);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  // Setup Actions
  btnAddSetupPlayer.addEventListener("click", () => addSetupPlayerInput(""));
  btnClearSetupPlayers.addEventListener("click", clearSetupPlayers);
  btnStartGame.addEventListener("click", startGame);

  // Score Entry
  formRoundScores.addEventListener("submit", submitRoundScores);

  // Enter key navigation between score fields
  scoreInputFields.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT") {
      e.preventDefault();

      const inputs = Array.from(scoreInputFields.querySelectorAll("input[type='number']"));
      const currentIndex = inputs.indexOf(e.target);

      if (currentIndex > -1 && currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus();
        inputs[currentIndex + 1].select();
      } else if (currentIndex === inputs.length - 1) {
        submitRoundScores(e);
      }
    }
  });

  setupPlayerList.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT") {
      e.preventDefault();

      if (e.target.value === "") {
        startGame();
      }

      let inputs = Array.from(setupPlayerList.querySelectorAll("input[type='text']"));
      const currentIndex = inputs.indexOf(e.target);

      if (currentIndex == inputs.length - 1) {
        addSetupPlayerInput("");
        inputs = Array.from(setupPlayerList.querySelectorAll("input[type='text']"));
      }

      inputs[currentIndex + 1].focus();
      inputs[currentIndex + 1].select();
    }
  });

  // Select all text in input on focus for rapid entry
  scoreInputFields.addEventListener("focusin", (e) => {
    if (e.target.tagName === "INPUT") {
      e.target.select();
    }
  });

  // Runtime Add Player
  btnRuntimeAddPlayer.addEventListener("click", runtimeAddPlayer);
  inputRuntimePlayerName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runtimeAddPlayer();
    }
  });
  inputRuntimePlayerName.addEventListener("input", () => {
    inputRuntimePlayerName.classList.remove("error");
    runtimeErrorMsg.classList.add("hidden");
  });

  // Global Dialog Openers
  btnResetConfirm.addEventListener("click", () => dialogReset.showModal());
  btnNewConfirm.addEventListener("click", () => dialogNewGame.showModal());

  // Reset Dialog Buttons
  document.getElementById("btn-reset-cancel").addEventListener("click", () => dialogReset.close());
  document.getElementById("btn-reset-confirm-action").addEventListener("click", resetGameScores);

  // New Game Dialog Buttons
  document.getElementById("btn-new-cancel").addEventListener("click", () => dialogNewGame.close());
  document.getElementById("btn-new-confirm-action").addEventListener("click", startNewGameSession);

  // Delete Player Dialog Buttons
  document.getElementById("btn-delete-player-cancel").addEventListener("click", () => {
    playerToDeleteId = null;
    dialogDeletePlayer.close();
  });
  document.getElementById("btn-delete-player-confirm").addEventListener("click", confirmDeletePlayer);

  // Edit Score Dialog Buttons
  document.getElementById("btn-edit-score-cancel").addEventListener("click", () => {
    scoreToEditData = null;
    dialogEditScore.close();
  });
  document.getElementById("btn-edit-score-save").addEventListener("click", saveEditedScore);

  // Delete Round Dialog Buttons
  document.getElementById("btn-delete-round-cancel").addEventListener("click", () => {
    roundToDeleteIndex = null;
    dialogDeleteRound.close();
  });
  document.getElementById("btn-delete-round-confirm").addEventListener("click", confirmDeleteRound);
}

// --- CORE GAME ACTIONS ---

function startGame() {
  const gameNameVal = "Game Scoreboard";
  const playerInputs = document.querySelectorAll(".setup-player-name-input");

  const playersList = [];
  let colorIdx = 0;

  playerInputs.forEach((input) => {
    const name = input.value.trim();
    if (name) {
      playersList.push({
        id: "p_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        name: name,
        scores: [],
        total: 0,
        colorIndex: colorIdx % MAX_COLORS
      });
      colorIdx++;
    }
  });

  if (playersList.length === 0) {
    playerInputs.forEach(input => {
      input.classList.add("error");
    });
    setupErrorMsg.classList.remove("hidden");

    if (playerInputs.length > 0) {
      playerInputs[0].focus();
    }
    return;
  }

  state.gameName = gameNameVal;
  state.players = playersList;
  state.rounds = 0;
  state.gameActive = true;

  saveState();
  render();
}

function submitRoundScores(e) {
  e.preventDefault();

  // Read score inputs
  state.players.forEach(player => {
    const input = document.getElementById(`score-input-${player.id}`);
    const scoreVal = input ? parseInt(input.value, 10) : 0;

    // Default to 0 if NaN/empty
    const score = isNaN(scoreVal) ? 0 : scoreVal;
    player.scores.push(score);
    player.total = player.scores.reduce((sum, s) => sum + s, 0);
  });

  state.rounds++;
  saveState();
  render();

  // Reset inputs
  state.players.forEach(player => {
    const input = document.getElementById(`score-input-${player.id}`);
    if (input) input.value = "";
  });

  // Focus the first input for the next round
  if (state.players.length > 0) {
    const firstInput = document.getElementById(`score-input-${state.players[0].id}`);
    if (firstInput) firstInput.focus();
  }
}

function runtimeAddPlayer() {
  const name = inputRuntimePlayerName.value.trim();
  if (!name) {
    inputRuntimePlayerName.classList.add("error");
    runtimeErrorMsg.classList.remove("hidden");
    inputRuntimePlayerName.focus();
    return;
  }

  inputRuntimePlayerName.classList.remove("error");
  runtimeErrorMsg.classList.add("hidden");

  // Create new player. Fill past rounds with 0.
  const newPlayer = {
    id: "p_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
    name: name,
    scores: Array(state.rounds).fill(0),
    total: 0,
    colorIndex: state.players.length % MAX_COLORS
  };

  state.players.push(newPlayer);
  inputRuntimePlayerName.value = "";

  saveState();
  render();
}

function promptDeletePlayer(playerId, playerName) {
  playerToDeleteId = playerId;
  document.getElementById("delete-player-name").textContent = playerName;
  dialogDeletePlayer.showModal();
}

function confirmDeletePlayer() {
  if (!playerToDeleteId) return;

  state.players = state.players.filter(p => p.id !== playerToDeleteId);
  playerToDeleteId = null;
  dialogDeletePlayer.close();

  // If no players left, we stay in game view but it will render empty, 
  // or we could let the user decide. Let's just save and render.
  startNewGameSession();
}

function resetGameScores() {
  state.players.forEach(p => {
    p.scores = [];
    p.total = 0;
  });
  state.rounds = 0;
  saveState();
  render();
  dialogReset.close();
}

function startNewGameSession() {
  state.gameActive = false;
  state.rounds = 0;
  // Keep players but reset their scores and totals
  state.players.forEach(p => {
    p.scores = [];
    p.total = 0;
  });
  saveState();

  // Re-initialize setup player list Inputs
  initSetupPlayers();
  render();
  dialogNewGame.close();
}

function clearSetupPlayers() {
  state.players = [];
  saveState();
  initSetupPlayers();
}

function promptDeleteRound(roundIndex) {
  roundToDeleteIndex = roundIndex;
  document.getElementById("delete-round-display-num").textContent = roundIndex + 1;
  dialogDeleteRound.showModal();
}

function confirmDeleteRound() {
  if (roundToDeleteIndex === null || roundToDeleteIndex === undefined) return;

  state.players.forEach(player => {
    if (player.scores && player.scores.length > roundToDeleteIndex) {
      player.scores.splice(roundToDeleteIndex, 1);
      player.total = player.scores.reduce((sum, s) => sum + s, 0);
    }
  });

  state.rounds--;
  saveState();
  render();

  roundToDeleteIndex = null;
  dialogDeleteRound.close();
}

// --- SCORE EDITING FUNCTIONS ---
function openEditScoreDialog(playerId, roundIndex) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return;

  scoreToEditData = { playerId, roundIndex };

  document.getElementById("edit-score-player").textContent = player.name;
  document.getElementById("edit-score-round").textContent = roundIndex + 1;

  const scoreVal = player.scores[roundIndex] !== undefined ? player.scores[roundIndex] : 0;
  document.getElementById("input-edit-score-value").value = scoreVal;

  dialogEditScore.showModal();
  document.getElementById("input-edit-score-value").select();
}

function saveEditedScore() {
  if (!scoreToEditData) return;

  const { playerId, roundIndex } = scoreToEditData;
  const player = state.players.find(p => p.id === playerId);

  if (player) {
    const inputVal = parseInt(document.getElementById("input-edit-score-value").value, 10);
    const newScore = isNaN(inputVal) ? 0 : inputVal;

    player.scores[roundIndex] = newScore;
    player.total = player.scores.reduce((sum, s) => sum + s, 0);

    saveState();
    render();
  }

  scoreToEditData = null;
  dialogEditScore.close();
}

// --- RENDER FUNCTIONS ---
function render() {
  if (!state.gameActive) {
    // Show setup
    setupView.classList.remove("hidden");
    gameView.classList.add("hidden");
    appHeaderActions.classList.add("hidden");
    return;
  }

  // Show active game
  setupView.classList.add("hidden");
  gameView.classList.remove("hidden");
  appHeaderActions.classList.remove("hidden");

  // Render header info
  displayRoundNum.textContent = state.rounds + 1;

  renderLeaderboard();
  renderScoreInputs();
  renderHistoryTable();
}

function renderLeaderboard() {
  // Sort copy of players by total points (descending)
  const sortedPlayers = [...state.players].sort((a, b) => b.total - a.total);

  leaderboardList.innerHTML = "";

  if (sortedPlayers.length === 0) {
    leaderboardList.innerHTML = `<p style="color:var(--text-secondary); text-align:center; padding:12px 0;">No active players</p>`;
    return;
  }

  // Find max score to flag leader(s)
  const maxScore = sortedPlayers[0].total;

  sortedPlayers.forEach((player, index) => {
    const isLeader = player.total === maxScore && maxScore > 0;
    const card = document.createElement("div");
    card.className = `leaderboard-card ${isLeader ? 'leader' : ''}`;

    card.innerHTML = `
      <div class="player-rank-info">
        <span class="rank-badge">${index + 1}</span>
        <div class="player-details">
          <span class="player-dot dot-${player.colorIndex}"></span>
          <span class="player-name">${escapeHtml(player.name)} ${isLeader ? '👑' : ''}</span>
        </div>
      </div>
      <div class="player-meta">
        <span class="player-score">${player.total} pts</span>
        <button class="btn-remove-player" title="Remove player from game" data-id="${player.id}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-inline" style="margin-right:0; width:14px; height:14px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;

    // Hook delete button
    card.querySelector(".btn-remove-player").addEventListener("click", (e) => {
      e.stopPropagation();
      promptDeletePlayer(player.id, player.name);
    });

    leaderboardList.appendChild(card);
  });
}

function renderScoreInputs() {
  scoreInputFields.innerHTML = "";

  if (state.players.length === 0) {
    scoreInputFields.innerHTML = `<p style="color:var(--text-secondary); text-align:center; padding:12px 0;">Add players to enter scores.</p>`;
    formRoundScores.querySelector(".btn").setAttribute("disabled", "true");
    return;
  } else {
    formRoundScores.querySelector(".btn").removeAttribute("disabled");
  }

  state.players.forEach(player => {
    const row = document.createElement("div");
    row.className = "player-score-input-row";

    row.innerHTML = `
      <div class="player-score-label">
        <span class="player-dot dot-${player.colorIndex}"></span>
        <span>${escapeHtml(player.name)}</span>
      </div>
      <div class="input-container-inc">
        <input type="number" id="score-input-${player.id}" placeholder="0" pattern="-?[0-9]*" inputmode="numeric">
      </div>
    `;

    scoreInputFields.appendChild(row);
  });
}

function renderHistoryTable() {
  const thead = historyTable.querySelector("thead");
  const tbody = historyTable.querySelector("tbody");

  thead.innerHTML = "";
  tbody.innerHTML = "";

  if (state.players.length === 0 || state.rounds === 0) {
    historyTable.style.display = "none";
    document.querySelector(".scoresheet-history").style.display = "none";
    return;
  }

  historyTable.style.display = "table";
  document.querySelector(".scoresheet-history").style.display = "block";

  // Build header row: list of player names
  const headerRow = document.createElement("tr");

  state.players.forEach(player => {
    const th = document.createElement("th");
    th.innerHTML = `
      <span class="player-dot dot-${player.colorIndex}" style="display:inline-block; margin-right:4px;"></span>
      ${escapeHtml(player.name)}
    `;
    headerRow.appendChild(th);
  });

  // Add empty action header
  const thAction = document.createElement("th");
  thAction.style.width = "48px";
  headerRow.appendChild(thAction);
  thead.appendChild(headerRow);

  // Build body rows: Turn 1, Turn 2, ...
  for (let r = 0; r < state.rounds; r++) {
    const row = document.createElement("tr");



    state.players.forEach(player => {
      const td = document.createElement("td");
      const score = player.scores[r] !== undefined ? player.scores[r] : 0;
      td.textContent = score;
      td.className = "editable-cell";

      // Bind click to edit cell
      td.addEventListener("click", () => {
        openEditScoreDialog(player.id, r);
      });

      row.appendChild(td);
    });

    // Add action cell to delete this round
    const tdAction = document.createElement("td");
    const btnDelete = document.createElement("button");
    btnDelete.className = "btn-delete-row";
    btnDelete.title = `Delete Round ${r + 1}`;
    btnDelete.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon-inline" style="margin-right:0; width:16px; height:16px; color:var(--text-secondary);"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
    `;
    btnDelete.addEventListener("click", () => {
      promptDeleteRound(r);
    });
    tdAction.appendChild(btnDelete);
    row.appendChild(tdAction);

    tbody.appendChild(row);
  }
}

// --- UTILS ---
function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

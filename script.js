const DEFAULT_BANKROLL = 500;
const CHIP_PERCENTAGES = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5];
const SUITS = ["♠", "♥", "♦", "♣"];
const VALUES = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
const DAS_OFFERED = true;
const BLACKJACK_PAYOUTS = {
  "1:1": { numerator: 1, denominator: 1 },
  "5:4": { numerator: 5, denominator: 4 },
  "3:2": { numerator: 3, denominator: 2 },
};

const DEFAULT_BLACKJACK_PAYOUT = "5:4";
const SETTINGS_STORAGE_KEY = "blackjack_settings_v1";
const DEFAULT_KEYBINDS = {
  deal: "d",
  hit: "h",
  stand: "s",
  double: "f",
  split: "p",
};

const state = {
  deck: [],
  dealerHand: [],
  playerHands: [[]],
  playerHandBets: [0],
  playerHandNaturalEligible: [true],
  playerStood: [false],
  playerBusted: [false],
  activePlayerHand: 0,
  dealerHidden: true,
  phase: "betting",
  bankrolls: { player: DEFAULT_BANKROLL, dealer: DEFAULT_BANKROLL },
  currentBet: 0,
  roundStartBankrolls: {
    player: DEFAULT_BANKROLL,
    dealer: DEFAULT_BANKROLL,
  },
  chipBaseBankroll: DEFAULT_BANKROLL,
  chipAmounts: [],
  autoBetAmount: 0,
  blackjackPayout: DEFAULT_BLACKJACK_PAYOUT,
  dealerRule: "H17",
  hotkeysEnabled: false,
  keybinds: { ...DEFAULT_KEYBINDS },
  assistedGameplay: false,
  settingsOpen: false,
  dealerAutoRunning: false,
  simulationRunning: false,
  simulationCancelRequested: false,
  pendingSimulationParams: null,
  newlyDrawnCards: [],
};

const ui = {};

function $(id) {
  return document.getElementById(id);
}

function normalizeKeybindChar(value) {
  const trimmed = String(value ?? "")
    .trim()
    .toLowerCase();
  return trimmed.length ? trimmed[0] : "";
}

function sanitizeKeybinds(candidate = {}) {
  const sanitized = { ...DEFAULT_KEYBINDS };
  const seen = new Set();
  for (const action of Object.keys(DEFAULT_KEYBINDS)) {
    const next = normalizeKeybindChar(candidate[action]);
    if (next && !seen.has(next)) {
      sanitized[action] = next;
      seen.add(next);
    }
  }
  return sanitized;
}

function savePersistentSettings() {
  const payload = {
    assistedGameplay: state.assistedGameplay,
    autoBetAmount: state.autoBetAmount,
    blackjackPayout: state.blackjackPayout,
    dealerRule: state.dealerRule,
    hotkeysEnabled: state.hotkeysEnabled,
    keybinds: state.keybinds,
    simulateRunCountInput: ui.simulateRunCountInput?.value ?? "100",
    simulateBaseBetInput: ui.simulateBaseBetInput?.value ?? "10",
    simulatePlayerBankrollInput: ui.simulatePlayerBankrollInput?.value ?? "500",
    simulateDealerBankrollInput: ui.simulateDealerBankrollInput?.value ?? "500",
  };

  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors (private mode, disabled storage, quota exceeded).
  }
}

function loadPersistentSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;

    state.assistedGameplay = Boolean(parsed.assistedGameplay);
    state.autoBetAmount = Math.max(
      0,
      Math.floor(Number(parsed.autoBetAmount) || 0),
    );
    state.blackjackPayout = BLACKJACK_PAYOUTS[parsed.blackjackPayout]
      ? parsed.blackjackPayout
      : DEFAULT_BLACKJACK_PAYOUT;
    state.dealerRule = parsed.dealerRule === "S17" ? "S17" : "H17";
    state.hotkeysEnabled = Boolean(parsed.hotkeysEnabled);
    state.keybinds = sanitizeKeybinds(parsed.keybinds);
  } catch {
    // Ignore malformed persisted data.
  }
}

function init() {
  Object.assign(ui, {
    playerBal: $("playerBal"),
    dealerBal: $("dealerBal"),
    betDisplay: $("betDisplay"),
    playerChg: $("playerChg"),
    dealerChg: $("dealerChg"),
    betChg: $("betChg"),
    settingsBtn: $("settingsBtn"),
    settingsMenu: $("settingsMenu"),
    assistedToggle: $("assistedToggle"),
    hotkeysToggle: $("hotkeysToggle"),
    autoBetInput: $("autoBetInput"),
    blackjackPayoutSelect: $("blackjackPayoutSelect"),
    dealerRuleSelect: $("dealerRuleSelect"),
    openKeybindsBtn: $("openKeybindsBtn"),
    simulateRunsBtn: $("simulateRunsBtn"),
    openBankrollBtn: $("openBankrollBtn"),
    bankrollModal: $("bankrollModal"),
    playerBankrollInput: $("playerBankrollInput"),
    dealerBankrollInput: $("dealerBankrollInput"),
    closeBankrollBtn: $("closeBankrollBtn"),
    applyBankrollBtn: $("applyBankrollBtn"),
    simulationModal: $("simulationModal"),
    simulateRunCountInput: $("simulateRunCountInput"),
    simulateBaseBetInput: $("simulateBaseBetInput"),
    simulatePlayerBankrollInput: $("simulatePlayerBankrollInput"),
    simulateDealerBankrollInput: $("simulateDealerBankrollInput"),
    simulationResults: $("simulationResults"),
    closeSimulationBtn: $("closeSimulationBtn"),
    startSimulationBtn: $("startSimulationBtn"),
    simulationWarningModal: $("simulationWarningModal"),
    simulationWarningText: $("simulationWarningText"),
    cancelSimulationWarningBtn: $("cancelSimulationWarningBtn"),
    confirmSimulationWarningBtn: $("confirmSimulationWarningBtn"),
    keybindsModal: $("keybindsModal"),
    closeKeybindsBtn: $("closeKeybindsBtn"),
    resetKeybindsBtn: $("resetKeybindsBtn"),
    saveKeybindsBtn: $("saveKeybindsBtn"),
    keybindDealInput: $("keybindDealInput"),
    keybindHitInput: $("keybindHitInput"),
    keybindStandInput: $("keybindStandInput"),
    keybindDoubleInput: $("keybindDoubleInput"),
    keybindSplitInput: $("keybindSplitInput"),
    dealerHand: $("dealerHand"),
    dealerScore: $("dealerScore"),
    playerHandsArea: $("playerHandsArea"),
    chipTray: $("chipTray"),
    resultBanner: $("resultBanner"),
    resultText: $("resultText"),
    resultSub: $("resultSub"),
    resultPay: $("resultPay"),
    statusBar: $("statusBar"),
    phasePips: $("phasePips"),
    actions: $("actions"),
    table: document.querySelector(".table"),
    dealerTurn: $("dealerTurn"),
    playerTurn: $("playerTurn"),
  });

  loadPersistentSettings();

  ui.settingsBtn.addEventListener("click", toggleSettingsMenu);
  ui.assistedToggle.addEventListener("change", onAssistedToggleChange);
  ui.hotkeysToggle.addEventListener("change", onHotkeysToggleChange);
  ui.autoBetInput.addEventListener("change", onAutoBetInputChange);
  ui.blackjackPayoutSelect.addEventListener("change", onBlackjackPayoutChange);
  ui.dealerRuleSelect.addEventListener("change", onDealerRuleChange);
  ui.openKeybindsBtn.addEventListener("click", openKeybindsModal);
  ui.simulateRunsBtn.addEventListener("click", onSimulateRunsClick);
  ui.openBankrollBtn.addEventListener("click", openBankrollModal);
  ui.closeBankrollBtn.addEventListener("click", closeBankrollModal);
  ui.applyBankrollBtn.addEventListener("click", applyBankrollSetup);
  ui.closeSimulationBtn.addEventListener("click", closeSimulationModal);
  ui.startSimulationBtn.addEventListener("click", runSimulationFromModal);
  ui.cancelSimulationWarningBtn.addEventListener(
    "click",
    closeSimulationWarningModal,
  );
  ui.confirmSimulationWarningBtn.addEventListener(
    "click",
    confirmLargeSimulation,
  );
  ui.closeKeybindsBtn.addEventListener("click", closeKeybindsModal);
  ui.resetKeybindsBtn.addEventListener("click", resetKeybindsToDefault);
  ui.saveKeybindsBtn.addEventListener("click", saveKeybindsFromModal);
  ui.bankrollModal.addEventListener("click", (event) => {
    if (event.target === ui.bankrollModal) closeBankrollModal();
  });
  ui.simulationModal.addEventListener("click", (event) => {
    if (event.target === ui.simulationModal) closeSimulationModal();
  });
  ui.simulationWarningModal.addEventListener("click", (event) => {
    if (event.target === ui.simulationWarningModal)
      closeSimulationWarningModal();
  });
  ui.keybindsModal.addEventListener("click", (event) => {
    if (event.target === ui.keybindsModal) closeKeybindsModal();
  });
  document.addEventListener("keydown", onGlobalKeyDown);
  document.addEventListener("click", (event) => {
    if (!state.settingsOpen) return;
    if (ui.settingsMenu.contains(event.target)) return;
    if (ui.settingsBtn.contains(event.target)) return;
    closeSettingsMenu();
  });
  ui.chipTray.addEventListener("click", onChipTrayClick);
  ui.actions.addEventListener("click", onActionClick);
  ui.simulateRunCountInput.addEventListener("change", savePersistentSettings);
  ui.simulateBaseBetInput.addEventListener("change", savePersistentSettings);
  ui.simulatePlayerBankrollInput.addEventListener(
    "change",
    savePersistentSettings,
  );
  ui.simulateDealerBankrollInput.addEventListener(
    "change",
    savePersistentSettings,
  );

  syncBankrollInputs();
  ui.assistedToggle.checked = state.assistedGameplay;
  ui.hotkeysToggle.checked = state.hotkeysEnabled;
  ui.autoBetInput.value = String(state.autoBetAmount);
  ui.blackjackPayoutSelect.value = state.blackjackPayout;
  ui.dealerRuleSelect.value = state.dealerRule;
  renderKeybindInputs();
  hydrateSimulationInputsFromSettings();
  render();
}

function toggleSettingsMenu() {
  if (state.settingsOpen) closeSettingsMenu();
  else openSettingsMenu();
}

function openSettingsMenu() {
  state.settingsOpen = true;
  ui.settingsMenu.hidden = false;
  ui.settingsBtn.setAttribute("aria-expanded", "true");
}

function closeSettingsMenu() {
  state.settingsOpen = false;
  ui.settingsMenu.hidden = true;
  ui.settingsBtn.setAttribute("aria-expanded", "false");
}

function onAssistedToggleChange() {
  state.assistedGameplay = ui.assistedToggle.checked;
  savePersistentSettings();
  if (state.assistedGameplay && state.phase === "player") {
    showAssistRecommendation();
  }
}

function onHotkeysToggleChange() {
  state.hotkeysEnabled = ui.hotkeysToggle.checked;
  savePersistentSettings();
  if (state.hotkeysEnabled) {
    openKeybindsModal();
    setStatus("Hotkeys enabled. Configure bindings as needed.");
  } else {
    setStatus("Hotkeys disabled.");
  }
}

function renderKeybindInputs() {
  ui.keybindDealInput.value = state.keybinds.deal;
  ui.keybindHitInput.value = state.keybinds.hit;
  ui.keybindStandInput.value = state.keybinds.stand;
  ui.keybindDoubleInput.value = state.keybinds.double;
  ui.keybindSplitInput.value = state.keybinds.split;
}

function openKeybindsModal() {
  closeSettingsMenu();
  renderKeybindInputs();
  ui.keybindsModal.classList.add("open");
  ui.keybindsModal.setAttribute("aria-hidden", "false");
}

function closeKeybindsModal() {
  ui.keybindsModal.classList.remove("open");
  ui.keybindsModal.setAttribute("aria-hidden", "true");
}

function saveKeybindsFromModal() {
  const candidate = {
    deal: normalizeKeybindChar(ui.keybindDealInput.value),
    hit: normalizeKeybindChar(ui.keybindHitInput.value),
    stand: normalizeKeybindChar(ui.keybindStandInput.value),
    double: normalizeKeybindChar(ui.keybindDoubleInput.value),
    split: normalizeKeybindChar(ui.keybindSplitInput.value),
  };

  const keys = Object.values(candidate);
  if (keys.some((key) => !key)) {
    setStatus("All keybinds must have one key.", true);
    return;
  }

  const duplicate = keys.find((key, index) => keys.indexOf(key) !== index);
  if (duplicate) {
    setStatus(`Duplicate keybind '${duplicate}' is not allowed.`, true);
    return;
  }

  state.keybinds = { ...candidate };
  savePersistentSettings();
  closeKeybindsModal();
  setStatus("Keybinds updated.");
}

function resetKeybindsToDefault() {
  state.keybinds = { ...DEFAULT_KEYBINDS };
  renderKeybindInputs();
  savePersistentSettings();
  setStatus("Keybinds reset to defaults.");
}

function onSimulateRunsClick() {
  openSimulationModal();
}

function onBlackjackPayoutChange() {
  const selected = ui.blackjackPayoutSelect.value;
  state.blackjackPayout = BLACKJACK_PAYOUTS[selected]
    ? selected
    : DEFAULT_BLACKJACK_PAYOUT;
  ui.blackjackPayoutSelect.value = state.blackjackPayout;
  savePersistentSettings();
  setStatus(`Blackjack payout set to ${state.blackjackPayout}.`);
}

function onDealerRuleChange() {
  const selected = ui.dealerRuleSelect.value;
  state.dealerRule = selected === "S17" ? "S17" : "H17";
  ui.dealerRuleSelect.value = state.dealerRule;
  savePersistentSettings();
  setStatus(`Dealer rule set to ${state.dealerRule}.`);
}

function getBlackjackPayoutConfig(payoutSetting = state.blackjackPayout) {
  return (
    BLACKJACK_PAYOUTS[payoutSetting] ??
    BLACKJACK_PAYOUTS[DEFAULT_BLACKJACK_PAYOUT]
  );
}

function getBlackjackProfit(bet, payoutSetting = state.blackjackPayout) {
  const { numerator, denominator } = getBlackjackPayoutConfig(payoutSetting);
  return (bet * numerator) / denominator;
}

function getDefaultSimulationBet(playerBankroll, dealerBankroll) {
  const fallback = state.chipAmounts[2] ?? 10;
  const preferred =
    state.autoBetAmount > 0
      ? state.autoBetAmount
      : state.currentBet > 0
        ? state.currentBet
        : fallback;
  return Math.max(
    1,
    Math.floor(Math.min(preferred, playerBankroll, dealerBankroll)),
  );
}

function hydrateSimulationInputsFromSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;

    const runCount = String(parsed.simulateRunCountInput ?? "").trim();
    const baseBet = Math.floor(Number(parsed.simulateBaseBetInput));
    const playerBankroll = Math.floor(
      Number(parsed.simulatePlayerBankrollInput),
    );
    const dealerBankroll = Math.floor(
      Number(parsed.simulateDealerBankrollInput),
    );

    if (runCount) ui.simulateRunCountInput.value = runCount;
    if (Number.isFinite(baseBet) && baseBet > 0) {
      ui.simulateBaseBetInput.value = String(baseBet);
    }
    if (Number.isFinite(playerBankroll) && playerBankroll > 0) {
      ui.simulatePlayerBankrollInput.value = String(playerBankroll);
    }
    if (Number.isFinite(dealerBankroll) && dealerBankroll > 0) {
      ui.simulateDealerBankrollInput.value = String(dealerBankroll);
    }
  } catch {
    // Ignore malformed persisted values.
  }
}

function openSimulationModal() {
  closeSettingsMenu();
  if (!ui.simulateRunCountInput.value.trim())
    ui.simulateRunCountInput.value = "100";
  if (!ui.simulatePlayerBankrollInput.value.trim()) {
    ui.simulatePlayerBankrollInput.value = String(state.bankrolls.player);
  }
  if (!ui.simulateDealerBankrollInput.value.trim()) {
    ui.simulateDealerBankrollInput.value = String(state.bankrolls.dealer);
  }
  if (!ui.simulateBaseBetInput.value.trim()) {
    ui.simulateBaseBetInput.value = String(
      getDefaultSimulationBet(state.bankrolls.player, state.bankrolls.dealer),
    );
  }
  clearSimulationResults();
  savePersistentSettings();
  ui.simulationModal.classList.add("open");
  ui.simulationModal.setAttribute("aria-hidden", "false");
}

function closeSimulationModal() {
  if (state.simulationRunning) {
    requestSimulationCancel();
    return;
  }
  ui.simulationModal.classList.remove("open");
  ui.simulationModal.setAttribute("aria-hidden", "true");
  closeSimulationWarningModal();
  setSimulationRunning(false);
}

function openSimulationWarningModal(hands) {
  state.pendingSimulationParams = hands;
  ui.simulationWarningText.textContent = `You are about to simulate ${hands.toLocaleString()} hands. This could take noticeable time depending on your device.`;
  ui.simulationWarningModal.classList.add("open");
  ui.simulationWarningModal.setAttribute("aria-hidden", "false");
}

function closeSimulationWarningModal() {
  if (state.simulationRunning) return;
  ui.simulationWarningModal.classList.remove("open");
  ui.simulationWarningModal.setAttribute("aria-hidden", "true");
  state.pendingSimulationParams = null;
}

function confirmLargeSimulation() {
  const hands = state.pendingSimulationParams;
  closeSimulationWarningModal();
  if (!Number.isFinite(hands) || hands <= 0) return;
  launchSimulation(hands);
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.ceil(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function renderSimulationProgress({ completed, total, startedAt }) {
  const percent = total > 0 ? (completed / total) * 100 : 0;
  const elapsedSeconds = Math.max(
    0.001,
    (performance.now() - startedAt) / 1000,
  );
  const handsPerSecond = completed / elapsedSeconds;
  const etaSeconds =
    handsPerSecond > 0 ? (total - completed) / handsPerSecond : NaN;

  ui.simulationResults.innerHTML = `
    <div class="simulation-progress">
      <div class="simulation-summary-title">Running Simulation</div>
      <div class="simulation-progress-topline">
        <span>${completed.toLocaleString()} / ${total.toLocaleString()} hands</span>
        <span>${percent.toFixed(1)}%</span>
      </div>
      <div class="simulation-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.max(0, percent)).toFixed(1)}">
        <div class="simulation-progress-fill" style="width: ${Math.min(100, Math.max(0, percent)).toFixed(2)}%"></div>
      </div>
      <div class="simulation-progress-meta">
        <span>Speed: ${Math.round(handsPerSecond).toLocaleString()} hands/s</span>
        <span>ETA: ${formatEta(etaSeconds)}</span>
      </div>
      <div class="simulation-placeholder">You can cancel this run at any time.</div>
    </div>
  `;
}

function requestSimulationCancel() {
  if (!state.simulationRunning) return;
  state.simulationCancelRequested = true;
  ui.closeSimulationBtn.disabled = true;
  ui.closeSimulationBtn.textContent = "Cancelling…";
  setStatus("Cancelling simulation…");
}

function launchSimulation(totalHands) {
  setSimulationRunning(true);
  state.simulationCancelRequested = false;
  savePersistentSettings();
  setStatus(`Running ${totalHands} simulated hands...`);

  const playerBankroll = Math.floor(
    Number(ui.simulatePlayerBankrollInput.value),
  );
  const dealerBankroll = Math.floor(
    Number(ui.simulateDealerBankrollInput.value),
  );
  const baseBet = Math.floor(Number(ui.simulateBaseBetInput.value));

  const summary = {
    requestedHands: totalHands,
    actualHands: 0,
    baseBet,
    blackjackPayout: state.blackjackPayout,
    playerStartBankroll: playerBankroll,
    dealerStartBankroll: dealerBankroll,
    playerEndBankroll: playerBankroll,
    dealerEndBankroll: dealerBankroll,
    playerNet: 0,
    dealerNet: 0,
    playerWins: 0,
    dealerWins: 0,
    pushes: 0,
    playerHandWins: 0,
    dealerHandWins: 0,
    handPushes: 0,
    totalResolvedHands: 0,
    doubles: 0,
    splits: 0,
    totalWagered: 0,
    endedEarly: false,
    stopReason: "",
  };

  const runState = {
    totalHands,
    baseBet,
    startedAt: performance.now(),
    lastProgressAt: 0,
    currentPlayerBankroll: playerBankroll,
    currentDealerBankroll: dealerBankroll,
    summary,
  };

  renderSimulationProgress({
    completed: 0,
    total: totalHands,
    startedAt: runState.startedAt,
  });

  const processChunk = () => {
    if (!state.simulationRunning) return;

    const chunkStart = performance.now();
    while (runState.summary.actualHands < runState.totalHands) {
      if (state.simulationCancelRequested) {
        runState.summary.endedEarly = true;
        runState.summary.stopReason = "cancelled by user";
        break;
      }

      const openingBet = Math.min(
        runState.baseBet,
        runState.currentPlayerBankroll,
        runState.currentDealerBankroll,
      );
      if (openingBet < 1) {
        runState.summary.endedEarly = true;
        runState.summary.stopReason =
          "one side could no longer cover the opening bet";
        break;
      }

      const round = simulateSingleHand({
        playerBankroll: runState.currentPlayerBankroll,
        dealerBankroll: runState.currentDealerBankroll,
        baseBet: openingBet,
        blackjackPayout: runState.summary.blackjackPayout,
      });

      runState.currentPlayerBankroll += round.playerDelta;
      runState.currentDealerBankroll += round.dealerDelta;
      runState.summary.actualHands += 1;
      runState.summary.playerHandWins += round.playerHandWins;
      runState.summary.dealerHandWins += round.dealerHandWins;
      runState.summary.handPushes += round.handPushes;
      runState.summary.totalResolvedHands +=
        round.playerHandWins + round.dealerHandWins + round.handPushes;
      runState.summary.doubles += round.doubles;
      runState.summary.splits += round.splits;
      runState.summary.totalWagered += round.totalWagered;

      if (round.playerDelta > 0) runState.summary.playerWins += 1;
      else if (round.playerDelta < 0) runState.summary.dealerWins += 1;
      else runState.summary.pushes += 1;

      if (performance.now() - chunkStart >= 16) break;
    }

    const now = performance.now();
    if (
      now - runState.lastProgressAt >= 100 ||
      runState.summary.actualHands >= runState.totalHands ||
      runState.summary.endedEarly
    ) {
      runState.lastProgressAt = now;
      renderSimulationProgress({
        completed: runState.summary.actualHands,
        total: runState.totalHands,
        startedAt: runState.startedAt,
      });
    }

    if (
      runState.summary.actualHands >= runState.totalHands ||
      runState.summary.endedEarly
    ) {
      runState.summary.playerEndBankroll = runState.currentPlayerBankroll;
      runState.summary.dealerEndBankroll = runState.currentDealerBankroll;
      runState.summary.playerNet =
        runState.currentPlayerBankroll - runState.summary.playerStartBankroll;
      runState.summary.dealerNet =
        runState.currentDealerBankroll - runState.summary.dealerStartBankroll;

      renderSimulationResults(runState.summary);
      setSimulationRunning(false);

      const completedText =
        runState.summary.actualHands === runState.summary.requestedHands &&
        !runState.summary.endedEarly
          ? `Simulation complete — Player ${runState.summary.playerWins}, Dealer ${runState.summary.dealerWins}, Push ${runState.summary.pushes}.`
          : `Simulation stopped after ${runState.summary.actualHands} hands — ${runState.summary.stopReason}`;
      setStatus(completedText);
      return;
    }

    window.requestAnimationFrame(processChunk);
  };

  window.requestAnimationFrame(processChunk);
}

function clearSimulationResults() {
  ui.simulationResults.innerHTML = `
    <div class="simulation-placeholder">
      Choose the run count and bankrolls, then run the simulation to see the summary here.
    </div>
  `;
}

function setSimulationRunning(isRunning) {
  state.simulationRunning = isRunning;
  if (!isRunning) state.simulationCancelRequested = false;
  ui.startSimulationBtn.disabled = isRunning;
  ui.closeSimulationBtn.disabled = false;
  ui.closeSimulationBtn.textContent = isRunning ? "Cancel Run" : "Close";
  ui.startSimulationBtn.textContent = isRunning ? "Running…" : "Run Simulation";
}

function parseNumberInput(input) {
  const str = String(input).trim().toLowerCase();
  const match = str.match(/^([\d.]+)([km])?$/);

  if (!match) {
    return NaN;
  }

  const num = parseFloat(match[1]);
  const suffix = match[2];

  if (suffix === "k") {
    return num * 1000;
  } else if (suffix === "m") {
    return num * 1000000;
  }

  return num;
}

function runSimulationFromModal() {
  savePersistentSettings();
  const requestedHands = Math.floor(
    parseNumberInput(ui.simulateRunCountInput.value),
  );
  const playerBankroll = Math.floor(
    Number(ui.simulatePlayerBankrollInput.value),
  );
  const dealerBankroll = Math.floor(
    Number(ui.simulateDealerBankrollInput.value),
  );
  const baseBet = Math.floor(Number(ui.simulateBaseBetInput.value));

  if (
    !Number.isFinite(requestedHands) ||
    !Number.isFinite(playerBankroll) ||
    !Number.isFinite(dealerBankroll) ||
    !Number.isFinite(baseBet) ||
    requestedHands <= 0 ||
    playerBankroll <= 0 ||
    dealerBankroll <= 0 ||
    baseBet <= 0
  ) {
    setStatus("Simulation values must all be positive whole numbers.", true);
    return;
  }

  const cappedHands = Math.min(requestedHands, 10000000);
  if (cappedHands > 1000000) {
    openSimulationWarningModal(cappedHands);
    return;
  }
  launchSimulation(cappedHands);
}

function renderSimulationResults(summary) {
  const stopNotice = summary.endedEarly
    ? `<div class="simulation-notice">Stopped early: ${summary.stopReason}</div>`
    : "";

  ui.simulationResults.innerHTML = `
    <div class="simulation-summary">
      <div class="simulation-summary-title">Simulation Results</div>
      ${stopNotice}
      <div class="simulation-bankrolls">
        <div class="simulation-bankroll-card">
          <span class="simulation-stat-label">Player bankroll</span>
          <span class="simulation-bankroll-line">Start ${formatMoney(summary.playerStartBankroll)}</span>
          <span class="simulation-bankroll-line">End ${formatMoney(summary.playerEndBankroll)}</span>
          <span class="simulation-bankroll-line ${summary.playerNet >= 0 ? "win" : "lose"}">${formatSignedMoney(summary.playerNet)}</span>
        </div>
        <div class="simulation-bankroll-card">
          <span class="simulation-stat-label">Dealer bankroll</span>
          <span class="simulation-bankroll-line">Start ${formatMoney(summary.dealerStartBankroll)}</span>
          <span class="simulation-bankroll-line">End ${formatMoney(summary.dealerEndBankroll)}</span>
          <span class="simulation-bankroll-line ${summary.dealerNet >= 0 ? "win" : "lose"}">${formatSignedMoney(summary.dealerNet)}</span>
        </div>
      </div>
      <details class="simulation-details">
        <summary class="simulation-details-toggle">
          <span class="simulation-toggle-more">Show more</span>
          <span class="simulation-toggle-less">Show less</span>
        </summary>
        <div class="simulation-details-body">
          <div class="simulation-stat-grid">
            <div class="simulation-stat"><span class="simulation-stat-label">Hands played</span><span class="simulation-stat-value">${summary.actualHands} / ${summary.requestedHands}</span></div>
            <div class="simulation-stat"><span class="simulation-stat-label">Base bet</span><span class="simulation-stat-value">${formatMoney(summary.baseBet)}</span></div>
            <div class="simulation-stat"><span class="simulation-stat-label">Blackjack payout</span><span class="simulation-stat-value">${summary.blackjackPayout}</span></div>
            <div class="simulation-stat"><span class="simulation-stat-label">Player wins</span><span class="simulation-stat-value win">${summary.playerWins}</span></div>
            <div class="simulation-stat"><span class="simulation-stat-label">Dealer wins</span><span class="simulation-stat-value lose">${summary.dealerWins}</span></div>
            <div class="simulation-stat"><span class="simulation-stat-label">Push rounds</span><span class="simulation-stat-value push">${summary.pushes}</span></div>
            <div class="simulation-stat"><span class="simulation-stat-label">Resolved hands</span><span class="simulation-stat-value">${summary.totalResolvedHands}</span></div>
            <div class="simulation-stat"><span class="simulation-stat-label">Player hand wins</span><span class="simulation-stat-value win">${summary.playerHandWins}</span></div>
            <div class="simulation-stat"><span class="simulation-stat-label">Dealer hand wins</span><span class="simulation-stat-value lose">${summary.dealerHandWins}</span></div>
            <div class="simulation-stat"><span class="simulation-stat-label">Push hands</span><span class="simulation-stat-value push">${summary.handPushes}</span></div>
            <div class="simulation-stat"><span class="simulation-stat-label">Splits used</span><span class="simulation-stat-value">${summary.splits}</span></div>
            <div class="simulation-stat"><span class="simulation-stat-label">Doubles used</span><span class="simulation-stat-value">${summary.doubles}</span></div>
            <div class="simulation-stat"><span class="simulation-stat-label">Total wagered</span><span class="simulation-stat-value">${formatMoney(summary.totalWagered)}</span></div>
          </div>
        </div>
      </details>
    </div>
  `;
}

function simulateManyHands({
  totalHands,
  playerBankroll,
  dealerBankroll,
  baseBet,
  blackjackPayout = state.blackjackPayout,
}) {
  let currentPlayerBankroll = playerBankroll;
  let currentDealerBankroll = dealerBankroll;

  const summary = {
    requestedHands: totalHands,
    actualHands: 0,
    baseBet,
    blackjackPayout,
    playerStartBankroll: playerBankroll,
    dealerStartBankroll: dealerBankroll,
    playerEndBankroll: playerBankroll,
    dealerEndBankroll: dealerBankroll,
    playerNet: 0,
    dealerNet: 0,
    playerWins: 0,
    dealerWins: 0,
    pushes: 0,
    playerHandWins: 0,
    dealerHandWins: 0,
    handPushes: 0,
    totalResolvedHands: 0,
    doubles: 0,
    splits: 0,
    totalWagered: 0,
    endedEarly: false,
    stopReason: "",
  };

  for (let index = 0; index < totalHands; index += 1) {
    const openingBet = Math.min(
      baseBet,
      currentPlayerBankroll,
      currentDealerBankroll,
    );
    if (openingBet < 1) {
      summary.endedEarly = true;
      summary.stopReason = "one side could no longer cover the opening bet";
      break;
    }

    const round = simulateSingleHand({
      playerBankroll: currentPlayerBankroll,
      dealerBankroll: currentDealerBankroll,
      baseBet: openingBet,
      blackjackPayout,
    });

    currentPlayerBankroll += round.playerDelta;
    currentDealerBankroll += round.dealerDelta;
    summary.actualHands += 1;
    summary.playerHandWins += round.playerHandWins;
    summary.dealerHandWins += round.dealerHandWins;
    summary.handPushes += round.handPushes;
    summary.totalResolvedHands +=
      round.playerHandWins + round.dealerHandWins + round.handPushes;
    summary.doubles += round.doubles;
    summary.splits += round.splits;
    summary.totalWagered += round.totalWagered;

    if (round.playerDelta > 0) summary.playerWins += 1;
    else if (round.playerDelta < 0) summary.dealerWins += 1;
    else summary.pushes += 1;
  }

  summary.playerEndBankroll = currentPlayerBankroll;
  summary.dealerEndBankroll = currentDealerBankroll;
  summary.playerNet = currentPlayerBankroll - playerBankroll;
  summary.dealerNet = currentDealerBankroll - dealerBankroll;

  return summary;
}

function createShuffledDeckForSimulation() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) deck.push({ suit, val: value });
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function drawSimCard(deck) {
  if (!deck.length) {
    const refill = createShuffledDeckForSimulation();
    deck.push(...refill);
  }
  return deck.pop();
}

function getPairRankForSimulation(hand) {
  if (hand.length !== 2) return null;
  if (isTenValueCard(hand[0]) && isTenValueCard(hand[1])) return 10;
  if (hand[0].val !== hand[1].val) return null;
  if (hand[0].val === "A") return "A";
  if (isTenValueCard(hand[0])) return 10;
  return Number(hand[0].val);
}

function canSplitSimulationHand(hand, handIndex, handCount, bankrolls) {
  return (
    handIndex === 0 &&
    handCount === 1 &&
    hand.length === 2 &&
    hand[0].val === hand[1].val &&
    bankrolls.player >= bankrolls.additionalStake &&
    bankrolls.dealer >= bankrolls.additionalStake
  );
}

function getSimulationStrategyAction({
  hand,
  dealerUpcard,
  canDouble,
  canSplit,
}) {
  const pairRank = canSplit ? getPairRankForSimulation(hand) : null;

  if (pairRank !== null) {
    if (pairRank === "A") return "Split";
    if (pairRank === 10) return "Stand";
    if (pairRank === 9)
      return [7, 10, 11].includes(dealerUpcard) ? "Stand" : "Split";
    if (pairRank === 8) return "Split";
    if (pairRank === 7)
      return dealerUpcard >= 2 && dealerUpcard <= 7 ? "Split" : "Hit";
    if (pairRank === 6) {
      return (dealerUpcard >= 3 && dealerUpcard <= 6) ||
        (dealerUpcard === 2 && DAS_OFFERED)
        ? "Split"
        : "Hit";
    }
    if (pairRank === 4) {
      return dealerUpcard >= 5 && dealerUpcard <= 6 && DAS_OFFERED
        ? "Split"
        : "Hit";
    }
    if (pairRank === 3 || pairRank === 2) {
      return (dealerUpcard >= 4 && dealerUpcard <= 7) ||
        ((dealerUpcard === 2 || dealerUpcard === 3) && DAS_OFFERED)
        ? "Split"
        : "Hit";
    }
  }

  const { total, isSoft } = analyzeHand(hand);
  if (isSoft && hand.length >= 2) {
    if (total >= 20) return "Stand";
    if (total === 19)
      return dealerUpcard === 6 && canDouble ? "Double" : "Stand";
    if (total === 18) {
      if (dealerUpcard >= 2 && dealerUpcard <= 6) {
        return canDouble ? "Double" : "Stand";
      }
      return dealerUpcard === 7 || dealerUpcard === 8 ? "Stand" : "Hit";
    }
    if (total === 17) {
      return dealerUpcard >= 3 && dealerUpcard <= 6 && canDouble
        ? "Double"
        : "Hit";
    }
    if (total === 16 || total === 15) {
      return dealerUpcard >= 4 && dealerUpcard <= 6 && canDouble
        ? "Double"
        : "Hit";
    }
    if (total === 14 || total === 13) {
      return dealerUpcard >= 5 && dealerUpcard <= 6 && canDouble
        ? "Double"
        : "Hit";
    }
  }

  if (total >= 17) return "Stand";
  if (total >= 13)
    return dealerUpcard >= 2 && dealerUpcard <= 6 ? "Stand" : "Hit";
  if (total === 12)
    return dealerUpcard >= 4 && dealerUpcard <= 6 ? "Stand" : "Hit";
  if (total === 11) return canDouble ? "Double" : "Hit";
  if (total === 10) {
    return dealerUpcard >= 2 && dealerUpcard <= 9 && canDouble
      ? "Double"
      : "Hit";
  }
  if (total === 9) {
    return dealerUpcard >= 3 && dealerUpcard <= 6 && canDouble
      ? "Double"
      : "Hit";
  }
  return "Hit";
}

function simulateSingleHand({
  playerBankroll,
  dealerBankroll,
  baseBet,
  blackjackPayout,
}) {
  let simulatedPlayerBankroll = playerBankroll;
  let simulatedDealerBankroll = dealerBankroll;
  let totalWagered = 0;
  let doubles = 0;
  let splits = 0;
  let playerHandWins = 0;
  let dealerHandWins = 0;
  let handPushes = 0;

  const placeStake = (amount) => {
    if (
      amount <= 0 ||
      simulatedPlayerBankroll < amount ||
      simulatedDealerBankroll < amount
    ) {
      return false;
    }
    simulatedPlayerBankroll -= amount;
    simulatedDealerBankroll -= amount;
    totalWagered += amount;
    return true;
  };

  placeStake(baseBet);

  const deck = createShuffledDeckForSimulation();
  const dealerHand = [drawSimCard(deck), drawSimCard(deck)];
  const dealerUpcard =
    dealerHand[0].val === "A"
      ? 11
      : isTenValueCard(dealerHand[0])
        ? 10
        : Number(dealerHand[0].val);

  const hands = [
    {
      cards: [drawSimCard(deck), drawSimCard(deck)],
      bet: baseBet,
      naturalEligible: true,
      aceSplitLocked: false,
      busted: false,
    },
  ];

  const playerNatural = isNaturalBlackjack(
    hands[0].cards,
    hands[0].naturalEligible,
  );
  const dealerNatural = isBlackjack(dealerHand);
  if (playerNatural && dealerNatural) {
    simulatedPlayerBankroll += baseBet;
    simulatedDealerBankroll += baseBet;
    handPushes += 1;
    return {
      playerDelta: simulatedPlayerBankroll - playerBankroll,
      dealerDelta: simulatedDealerBankroll - dealerBankroll,
      totalWagered,
      doubles,
      splits,
      playerHandWins,
      dealerHandWins,
      handPushes,
    };
  }
  if (playerNatural) {
    const profit = getBlackjackProfit(baseBet, blackjackPayout);
    const extraDealerCharge = Math.max(0, profit - baseBet);
    simulatedPlayerBankroll += baseBet + profit;
    simulatedDealerBankroll -= extraDealerCharge;
    playerHandWins += 1;
    return {
      playerDelta: simulatedPlayerBankroll - playerBankroll,
      dealerDelta: simulatedDealerBankroll - dealerBankroll,
      totalWagered,
      doubles,
      splits,
      playerHandWins,
      dealerHandWins,
      handPushes,
    };
  }
  if (dealerNatural) {
    simulatedDealerBankroll += baseBet * 2;
    dealerHandWins += 1;
    return {
      playerDelta: simulatedPlayerBankroll - playerBankroll,
      dealerDelta: simulatedDealerBankroll - dealerBankroll,
      totalWagered,
      doubles,
      splits,
      playerHandWins,
      dealerHandWins,
      handPushes,
    };
  }

  let handIndex = 0;
  while (handIndex < hands.length) {
    let hand = hands[handIndex];

    while (!hand.busted) {
      if (hand.aceSplitLocked) break;
      const value = handValue(hand.cards);
      if (value >= 21) break;

      const canDouble =
        hand.cards.length === 2 &&
        simulatedPlayerBankroll >= hand.bet &&
        simulatedDealerBankroll >= hand.bet;
      const canSplit = canSplitSimulationHand(
        hand.cards,
        handIndex,
        hands.length,
        {
          player: simulatedPlayerBankroll,
          dealer: simulatedDealerBankroll,
          additionalStake: hand.bet,
        },
      );

      const action = getSimulationStrategyAction({
        hand: hand.cards,
        dealerUpcard,
        canDouble,
        canSplit,
      });

      if (action === "Split" && canSplit) {
        if (!placeStake(hand.bet)) break;
        splits += 1;
        const [cardA, cardB] = hand.cards;
        const isAceSplit = cardA.val === "A" && cardB.val === "A";
        hands[handIndex] = {
          cards: [cardA, drawSimCard(deck)],
          bet: hand.bet,
          naturalEligible: false,
          aceSplitLocked: isAceSplit,
          busted: false,
        };
        hands.splice(handIndex + 1, 0, {
          cards: [cardB, drawSimCard(deck)],
          bet: hand.bet,
          naturalEligible: false,
          aceSplitLocked: isAceSplit,
          busted: false,
        });
        hand = hands[handIndex];
        continue;
      }

      if (action === "Double" && canDouble) {
        if (!placeStake(hand.bet)) break;
        doubles += 1;
        hand.bet *= 2;
        hand.cards.push(drawSimCard(deck));
        if (handValue(hand.cards) > 21) hand.busted = true;
        break;
      }

      if (action === "Hit") {
        hand.cards.push(drawSimCard(deck));
        if (handValue(hand.cards) > 21) hand.busted = true;
        continue;
      }

      break;
    }

    handIndex += 1;
  }

  const allBusted = hands.every((hand) => handValue(hand.cards) > 21);
  if (!allBusted) {
    while (shouldDealerHit(dealerHand)) {
      dealerHand.push(drawSimCard(deck));
    }
  }

  const dealerScore = handValue(dealerHand);
  const dealerValid = dealerScore <= 21;
  const dealerBlackjack = isBlackjack(dealerHand);
  for (const hand of hands) {
    const playerScore = handValue(hand.cards);
    const playerValid = playerScore <= 21;
    const playerBlackjack = isNaturalBlackjack(
      hand.cards,
      hand.naturalEligible,
    );
    const wager = hand.bet;

    if (playerBlackjack && dealerScore === 21 && !dealerBlackjack) {
      const profit = getBlackjackProfit(wager, blackjackPayout);
      const extraDealerCharge = Math.max(0, profit - wager);
      simulatedPlayerBankroll += wager + profit;
      simulatedDealerBankroll -= extraDealerCharge;
      playerHandWins += 1;
    } else if (dealerBlackjack && playerScore === 21 && !playerBlackjack) {
      simulatedDealerBankroll += wager * 2;
      dealerHandWins += 1;
    } else if (playerValid && (!dealerValid || playerScore > dealerScore)) {
      simulatedPlayerBankroll += wager * 2;
      playerHandWins += 1;
    } else if (dealerValid && (!playerValid || dealerScore > playerScore)) {
      simulatedDealerBankroll += wager * 2;
      dealerHandWins += 1;
    } else {
      simulatedPlayerBankroll += wager;
      simulatedDealerBankroll += wager;
      handPushes += 1;
    }
  }

  return {
    playerDelta: simulatedPlayerBankroll - playerBankroll,
    dealerDelta: simulatedDealerBankroll - dealerBankroll,
    totalWagered,
    doubles,
    splits,
    playerHandWins,
    dealerHandWins,
    handPushes,
  };
}

function onAutoBetInputChange() {
  const parsed = Number(ui.autoBetInput.value);
  const nextAmount = Number.isFinite(parsed)
    ? Math.max(0, Math.floor(parsed))
    : 0;
  state.autoBetAmount = nextAmount;
  ui.autoBetInput.value = String(nextAmount);
  savePersistentSettings();

  if (state.phase === "betting" && state.currentBet === 0) {
    applyAutomaticBetIfConfigured();
  }

  if (nextAmount > 0) {
    setStatus(`Automatic bet set to ${formatMoney(nextAmount)} per hand.`);
  } else {
    setStatus("Automatic bet disabled.");
  }
  render();
}

function formatMoney(amount) {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return `$${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2)}`;
}

function formatSignedMoney(amount) {
  const rounded = Math.round((Math.abs(amount) + Number.EPSILON) * 100) / 100;
  const formatted = Number.isInteger(rounded)
    ? rounded.toFixed(0)
    : rounded.toFixed(2);
  return `${amount >= 0 ? "+" : "-"}$${formatted}`;
}

function clearChange(id) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = "&nbsp;";
  el.className = "balance-change";
}

function showChange(id, delta) {
  const el = $(id);
  if (!el) return;
  if (!delta) {
    clearChange(id);
    return;
  }
  el.textContent = `${delta > 0 ? "+" : "-"}${formatMoney(Math.abs(delta)).slice(1)}`;
  el.className = `balance-change ${delta > 0 ? "up" : "down"}`;
  clearTimeout(el._timeout);
  el._timeout = window.setTimeout(() => clearChange(id), 3200);
}

function syncBankrollInputs() {
  ui.playerBankrollInput.value = String(state.bankrolls.player);
  ui.dealerBankrollInput.value = String(state.bankrolls.dealer);
}

function openBankrollModal() {
  if (state.phase !== "betting" && state.phase !== "done") {
    setStatus("Finish the current hand before changing bankrolls.", true);
    return;
  }
  closeSettingsMenu();
  syncBankrollInputs();
  ui.bankrollModal.classList.add("open");
  ui.bankrollModal.setAttribute("aria-hidden", "false");
}

function closeBankrollModal() {
  ui.bankrollModal.classList.remove("open");
  ui.bankrollModal.setAttribute("aria-hidden", "true");
}

function toNearestNiceBet(value) {
  if (!Number.isFinite(value) || value <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const buckets = [1, 2, 5, 10];
  let best = buckets[0];
  let bestDistance = Math.abs(normalized - best);
  for (const bucket of buckets.slice(1)) {
    const distance = Math.abs(normalized - bucket);
    if (distance < bestDistance) {
      best = bucket;
      bestDistance = distance;
    }
  }
  return Math.max(1, Math.round(best * magnitude));
}

function computeChipAmounts(baseBankroll) {
  const bankroll = Math.max(1, Math.floor(baseBankroll));
  const values = [];
  let previous = 0;
  for (const percentage of CHIP_PERCENTAGES) {
    let next = toNearestNiceBet(bankroll * percentage);
    if (next <= previous) next = previous + 1;
    next = Math.max(1, Math.min(bankroll, next));
    previous = next;
    values.push(next);
  }
  return values;
}

function refreshChipDenominations(baseBankroll = state.bankrolls.player) {
  state.chipBaseBankroll = Math.max(1, Math.floor(baseBankroll));
  state.chipAmounts = computeChipAmounts(state.chipBaseBankroll);
}

function getMaxPlayableBet() {
  return Math.max(
    0,
    Math.floor(Math.min(state.bankrolls.player, state.bankrolls.dealer)),
  );
}

function applyAutomaticBetIfConfigured() {
  if (state.phase !== "betting") return 0;
  if (state.currentBet > 0) return state.currentBet;
  if (state.autoBetAmount <= 0) return 0;

  const maxPlayable = getMaxPlayableBet();
  if (maxPlayable <= 0) return 0;

  const placed = Math.min(state.autoBetAmount, maxPlayable);
  state.currentBet = placed;
  clearChange("betChg");
  return placed;
}

function renderBalances() {
  ui.playerBal.textContent = formatMoney(state.bankrolls.player);
  ui.dealerBal.textContent = formatMoney(state.bankrolls.dealer);
  ui.betDisplay.textContent = formatMoney(state.currentBet);
  ui.playerBal.className = `balance-amount${state.bankrolls.player <= 0 ? " low" : ""}`;
  ui.dealerBal.className = `balance-amount${state.bankrolls.dealer <= 0 ? " low" : ""}`;
}

function onChipTrayClick(event) {
  const chip = event.target.closest("button.chip");
  if (!chip || chip.disabled) return;
  if (chip.dataset.action === "clear") {
    clearBet();
    return;
  }
  const amount = Number(chip.dataset.amount);
  if (Number.isFinite(amount) && amount > 0) addBet(amount);
}

function renderChips() {
  const chipButtons = Array.from(
    ui.chipTray.querySelectorAll("button.chip[data-chip-index]"),
  );
  const chipAmounts =
    state.chipAmounts.length > 0
      ? state.chipAmounts
      : computeChipAmounts(state.chipBaseBankroll);
  const maxPlayable = getMaxPlayableBet();
  const bettingOpen = state.phase === "betting";

  chipButtons.forEach((button, index) => {
    const amount =
      chipAmounts[index] ?? chipAmounts[chipAmounts.length - 1] ?? 1;
    button.textContent = formatMoney(amount);
    button.dataset.amount = String(amount);
    button.disabled =
      !bettingOpen || maxPlayable <= 0 || state.currentBet >= maxPlayable;
  });

  const clearChip = ui.chipTray.querySelector("button[data-action='clear']");
  clearChip.disabled = !bettingOpen || state.currentBet === 0;
}

function addBet(amount) {
  if (state.phase !== "betting") return;
  const maxAdditional = getMaxPlayableBet() - state.currentBet;
  if (maxAdditional <= 0) {
    setStatus("Player or dealer cannot cover a higher bet.", true);
    render();
    return;
  }
  const added = Math.min(amount, maxAdditional);
  state.currentBet += added;
  showChange("betChg", added);
  setStatus(`Bet: ${formatMoney(state.currentBet)} — press Deal when ready.`);
  render();
}

function clearBet() {
  if (state.phase !== "betting") return;
  state.currentBet = 0;
  clearChange("betChg");
  setStatus("Place your bet using the chips below, then press Deal.");
  render();
}

function applyBankrollSetup() {
  if (state.phase !== "betting" && state.phase !== "done") {
    setStatus("Finish the current hand before changing bankrolls.", true);
    return;
  }
  const playerBankroll = Number(ui.playerBankrollInput.value);
  const dealerBankroll = Number(ui.dealerBankrollInput.value);
  if (
    !Number.isFinite(playerBankroll) ||
    !Number.isFinite(dealerBankroll) ||
    playerBankroll <= 0 ||
    dealerBankroll <= 0
  ) {
    setStatus("Dealer and player bankrolls must be positive numbers.", true);
    return;
  }
  state.bankrolls.player = Math.floor(playerBankroll);
  state.bankrolls.dealer = Math.floor(dealerBankroll);
  refreshChipDenominations(state.bankrolls.player);
  resetHandStateForBetting();
  applyAutomaticBetIfConfigured();
  clearRoundChangeIndicators();
  closeBankrollModal();
  if (state.currentBet > 0) {
    setStatus(
      `Bankrolls updated. Automatic bet is ${formatMoney(state.currentBet)} — press Deal or adjust with chips.`,
    );
  } else {
    setStatus(
      "Bankrolls updated. Build the player bet with chips and press Deal.",
    );
  }
  render();
}

function clearRoundChangeIndicators() {
  clearChange("playerChg");
  clearChange("dealerChg");
  clearChange("betChg");
}

function resetHandStateForBetting() {
  state.deck = [];
  state.dealerHand = [];
  state.playerHands = [[]];
  state.playerHandBets = [0];
  state.playerHandNaturalEligible = [true];
  state.playerStood = [false];
  state.playerBusted = [false];
  state.activePlayerHand = 0;
  state.dealerHidden = true;
  state.phase = "betting";
  state.currentBet = 0;
  state.dealerAutoRunning = false;
  state.newlyDrawnCards = [];
  hideResult();
}

refreshChipDenominations(DEFAULT_BANKROLL);

function buildDeck() {
  state.deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) state.deck.push({ suit, val: value });
  }
  for (let index = state.deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [state.deck[index], state.deck[swapIndex]] = [
      state.deck[swapIndex],
      state.deck[index],
    ];
  }
}

function drawCard(target, handIndex = 0) {
  if (!state.deck.length) buildDeck();
  const card = state.deck.pop();
  if (target === "dealer") {
    state.dealerHand.push(card);
    state.newlyDrawnCards.push(card);
    return card;
  }
  state.playerHands[handIndex].push(card);
  state.newlyDrawnCards.push(card);
  const value = handValue(state.playerHands[handIndex]);
  if (value > 21) {
    state.playerBusted[handIndex] = true;
    state.playerStood[handIndex] = true;
  }
  return card;
}

function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.val === "A") {
      total += 11;
      aces += 1;
    } else if (["J", "Q", "K"].includes(card.val)) {
      total += 10;
    } else {
      total += Number(card.val);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function isTenValueCard(card) {
  return ["10", "J", "Q", "K"].includes(card.val);
}

function getDealerUpcardValue() {
  const upcard = state.dealerHand[0];
  if (!upcard) return null;
  if (upcard.val === "A") return 11;
  if (isTenValueCard(upcard)) return 10;
  return Number(upcard.val);
}

function getDealerUpcardLabel() {
  const upcard = state.dealerHand[0];
  if (!upcard) return "?";
  return upcard.val;
}

function analyzeHand(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.val === "A") {
      total += 11;
      aces += 1;
    } else if (isTenValueCard(card)) {
      total += 10;
    } else {
      total += Number(card.val);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, isSoft: aces > 0 };
}

function shouldDealerHit(hand) {
  const { total, isSoft } = analyzeHand(hand);
  if (total < 17) return true;
  if (state.dealerRule === "H17" && total === 17 && isSoft) return true;
  return false;
}

function getPairRank(hand) {
  if (hand.length !== 2) return null;
  if (isTenValueCard(hand[0]) && isTenValueCard(hand[1])) return 10;
  if (hand[0].val !== hand[1].val) return null;
  if (hand[0].val === "A") return "A";
  if (isTenValueCard(hand[0])) return 10;
  return Number(hand[0].val);
}

function getBasicStrategyRecommendation() {
  if (state.phase !== "player") {
    return {
      action: null,
      reason: "Assist is only available during the player turn.",
    };
  }

  const hand = state.playerHands[state.activePlayerHand];
  const dealerUpcard = getDealerUpcardValue();
  if (!hand?.length || !dealerUpcard) {
    return {
      action: null,
      reason: "Need an active player hand and dealer upcard first.",
    };
  }

  const doubleAllowed = canDouble();
  const splitAllowed = canSplit();
  const pairRank = splitAllowed ? getPairRank(hand) : null;
  const dealerLabel = getDealerUpcardLabel();

  if (pairRank !== null) {
    if (pairRank === "A") {
      return {
        action: "Split",
        reason: `Pair of aces vs dealer ${dealerLabel}.`,
      };
    }
    if (pairRank === 10) {
      return {
        action: "Stand",
        reason: `10-value pair vs dealer ${dealerLabel}.`,
      };
    }
    if (pairRank === 9) {
      return {
        action: [7, 10, 11].includes(dealerUpcard) ? "Stand" : "Split",
        reason: `Pair of 9s vs dealer ${dealerLabel}.`,
      };
    }
    if (pairRank === 8) {
      return {
        action: "Split",
        reason: `Pair of 8s vs dealer ${dealerLabel}.`,
      };
    }
    if (pairRank === 7) {
      return {
        action: dealerUpcard >= 2 && dealerUpcard <= 7 ? "Split" : "Hit",
        reason: `Pair of 7s vs dealer ${dealerLabel}.`,
      };
    }
    if (pairRank === 6) {
      return {
        action:
          (dealerUpcard >= 3 && dealerUpcard <= 6) ||
          (dealerUpcard === 2 && DAS_OFFERED)
            ? "Split"
            : "Hit",
        reason: `Pair of 6s vs dealer ${dealerLabel}.`,
      };
    }
    if (pairRank === 4) {
      return {
        action:
          dealerUpcard >= 5 && dealerUpcard <= 6 && DAS_OFFERED
            ? "Split"
            : "Hit",
        reason: `Pair of 4s vs dealer ${dealerLabel}.`,
      };
    }
    if (pairRank === 3 || pairRank === 2) {
      return {
        action:
          (dealerUpcard >= 4 && dealerUpcard <= 7) ||
          ((dealerUpcard === 2 || dealerUpcard === 3) && DAS_OFFERED)
            ? "Split"
            : "Hit",
        reason: `Pair of ${pairRank}s vs dealer ${dealerLabel}.`,
      };
    }
  }

  const { total, isSoft } = analyzeHand(hand);
  if (isSoft && hand.length >= 2) {
    if (total >= 20) {
      return {
        action: "Stand",
        reason: `Soft ${total} vs dealer ${dealerLabel}.`,
      };
    }
    if (total === 19) {
      return {
        action: dealerUpcard === 6 && doubleAllowed ? "Double" : "Stand",
        reason: `Soft 19 vs dealer ${dealerLabel}.`,
      };
    }
    if (total === 18) {
      if (dealerUpcard >= 2 && dealerUpcard <= 6) {
        return {
          action: doubleAllowed ? "Double" : "Stand",
          reason: `Soft 18 vs dealer ${dealerLabel}.`,
        };
      }
      return {
        action: dealerUpcard === 7 || dealerUpcard === 8 ? "Stand" : "Hit",
        reason: `Soft 18 vs dealer ${dealerLabel}.`,
      };
    }
    if (total === 17) {
      return {
        action:
          dealerUpcard >= 3 && dealerUpcard <= 6 && doubleAllowed
            ? "Double"
            : "Hit",
        reason: `Soft 17 vs dealer ${dealerLabel}.`,
      };
    }
    if (total === 16 || total === 15) {
      return {
        action:
          dealerUpcard >= 4 && dealerUpcard <= 6 && doubleAllowed
            ? "Double"
            : "Hit",
        reason: `Soft ${total} vs dealer ${dealerLabel}.`,
      };
    }
    if (total === 14 || total === 13) {
      return {
        action:
          dealerUpcard >= 5 && dealerUpcard <= 6 && doubleAllowed
            ? "Double"
            : "Hit",
        reason: `Soft ${total} vs dealer ${dealerLabel}.`,
      };
    }
  }

  if (total >= 17) {
    return {
      action: "Stand",
      reason: `Hard ${total} vs dealer ${dealerLabel}.`,
    };
  }
  if (total >= 13) {
    return {
      action: dealerUpcard >= 2 && dealerUpcard <= 6 ? "Stand" : "Hit",
      reason: `Hard ${total} vs dealer ${dealerLabel}.`,
    };
  }
  if (total === 12) {
    return {
      action: dealerUpcard >= 4 && dealerUpcard <= 6 ? "Stand" : "Hit",
      reason: `Hard 12 vs dealer ${dealerLabel}.`,
    };
  }
  if (total === 11) {
    return {
      action: doubleAllowed ? "Double" : "Hit",
      reason: `Hard 11 vs dealer ${dealerLabel}.`,
    };
  }
  if (total === 10) {
    return {
      action:
        dealerUpcard >= 2 && dealerUpcard <= 9 && doubleAllowed
          ? "Double"
          : "Hit",
      reason: `Hard 10 vs dealer ${dealerLabel}.`,
    };
  }
  if (total === 9) {
    return {
      action:
        dealerUpcard >= 3 && dealerUpcard <= 6 && doubleAllowed
          ? "Double"
          : "Hit",
      reason: `Hard 9 vs dealer ${dealerLabel}.`,
    };
  }

  return {
    action: "Hit",
    reason: `Hard ${total} vs dealer ${dealerLabel}.`,
  };
}

function showAssistRecommendation() {
  const recommendation = getBasicStrategyRecommendation();
  if (!recommendation.action) {
    setStatus(recommendation.reason, true);
    return;
  }
  const handNumber = state.activePlayerHand + 1;
  setStatus(
    `Assist: ${recommendation.action} — Hand ${handNumber}, ${recommendation.reason}`,
  );
}

function isBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}

function isNaturalBlackjack(hand, naturalEligible = true) {
  return naturalEligible && isBlackjack(hand);
}

function isPlayerHandNaturalBlackjack(handIndex) {
  return isNaturalBlackjack(
    state.playerHands[handIndex],
    state.playerHandNaturalEligible[handIndex],
  );
}

function allPlayerHandsBusted() {
  return state.playerBusted.length > 0 && state.playerBusted.every(Boolean);
}

function findNextOpenPlayerHand(startIndex) {
  for (
    let index = startIndex + 1;
    index < state.playerStood.length;
    index += 1
  ) {
    if (!state.playerStood[index]) return index;
  }
  return -1;
}

function deductStakeFromBoth(amount) {
  if (amount <= 0) return true;
  if (state.bankrolls.player < amount || state.bankrolls.dealer < amount) {
    setStatus("Player or dealer cannot cover that amount.", true);
    return false;
  }
  state.bankrolls.player -= amount;
  state.bankrolls.dealer -= amount;
  return true;
}

function deal() {
  if (state.phase !== "betting") return;
  if (state.currentBet <= 0) {
    setStatus("Place a bet first!", true);
    return;
  }
  if (state.currentBet > getMaxPlayableBet()) {
    setStatus("Player or dealer cannot cover that bet.", true);
    return;
  }

  state.roundStartBankrolls = {
    player: state.bankrolls.player,
    dealer: state.bankrolls.dealer,
  };
  const baseBet = state.currentBet;
  if (!deductStakeFromBoth(baseBet)) return;

  buildDeck();
  state.dealerHand = [];
  state.playerHands = [[]];
  state.playerHandBets = [baseBet];
  state.playerHandNaturalEligible = [true];
  state.playerStood = [false];
  state.playerBusted = [false];
  state.activePlayerHand = 0;
  state.dealerHidden = true;
  state.phase = "player";
  state.dealerAutoRunning = false;

  drawCard("dealer");
  drawCard("player", 0);
  drawCard("dealer");
  drawCard("player", 0);

  hideResult();
  setStatus("Player turn. Choose Hit, Stand, Double, or Split.");
  render();
  if (handleInitialNaturals()) render();
}

function handleInitialNaturals() {
  const playerNatural = isPlayerHandNaturalBlackjack(0);
  if (!playerNatural) return false;

  const bet = state.playerHandBets[0];
  const dealerNatural = isBlackjack(state.dealerHand);
  state.dealerHidden = false;

  if (dealerNatural) {
    state.bankrolls.player += bet;
    state.bankrolls.dealer += bet;
    concludeRound(
      "push",
      "Push!",
      "Both Blackjack — it's a tie.",
      `Bet of ${formatMoney(bet)} returned to both sides.`,
    );
    return true;
  }

  const profit = getBlackjackProfit(bet);
  const extraDealerCharge = Math.max(0, profit - bet);
  state.bankrolls.player += bet + profit;
  state.bankrolls.dealer -= extraDealerCharge;
  concludeRound(
    "win",
    "♠ Blackjack! ♠",
    "Player wins with natural 21!",
    `Player wins ${formatMoney(profit)}.`,
  );
  return true;
}

function canDouble() {
  if (state.phase !== "player") return false;
  const index = state.activePlayerHand;
  const hand = state.playerHands[index];
  return (
    hand &&
    hand.length === 2 &&
    !state.playerStood[index] &&
    state.bankrolls.player >= state.playerHandBets[index] &&
    state.bankrolls.dealer >= state.playerHandBets[index]
  );
}

function canSplit() {
  if (state.phase !== "player") return false;
  if (state.playerHands.length !== 1 || state.activePlayerHand !== 0)
    return false;
  const hand = state.playerHands[0];
  return (
    hand.length === 2 &&
    hand[0].val === hand[1].val &&
    !state.playerStood[0] &&
    state.bankrolls.player >= state.playerHandBets[0] &&
    state.bankrolls.dealer >= state.playerHandBets[0]
  );
}

function playerHit() {
  if (state.phase !== "player") return;
  const handIndex = state.activePlayerHand;
  drawCard("player", handIndex);
  const score = handValue(state.playerHands[handIndex]);
  if (score > 21) {
    state.playerBusted[handIndex] = true;
    state.playerStood[handIndex] = true;
    advanceAfterPlayerAction(`Hand ${handIndex + 1} busts with ${score}.`);
    return;
  }
  if (score === 21) {
    state.playerStood[handIndex] = true;
    advanceAfterPlayerAction(`Hand ${handIndex + 1} hits 21 and stands.`);
    return;
  }
  setStatus(`Hand ${handIndex + 1} hits and now has ${score}.`);
  render();
}

function playerStand() {
  if (state.phase !== "player") return;
  const handIndex = state.activePlayerHand;
  state.playerStood[handIndex] = true;
  advanceAfterPlayerAction(`Hand ${handIndex + 1} stands.`);
}

function playerDouble() {
  if (!canDouble()) {
    setStatus("Double Down is only available on a fresh two-card hand.", true);
    return;
  }
  const handIndex = state.activePlayerHand;
  const extra = state.playerHandBets[handIndex];
  if (!deductStakeFromBoth(extra)) return;
  state.playerHandBets[handIndex] += extra;
  state.currentBet += extra;
  showChange("betChg", extra);
  drawCard("player", handIndex);
  const score = handValue(state.playerHands[handIndex]);
  state.playerStood[handIndex] = true;
  if (score > 21) {
    state.playerBusted[handIndex] = true;
    advanceAfterPlayerAction(
      `Hand ${handIndex + 1} doubles and busts with ${score}.`,
    );
    return;
  }
  advanceAfterPlayerAction(
    `Hand ${handIndex + 1} doubles and stands on ${score}.`,
  );
}

function playerSplit() {
  if (!canSplit()) {
    setStatus("Split is only available on the first matching pair.", true);
    return;
  }
  const splitBet = state.playerHandBets[0];
  if (!deductStakeFromBoth(splitBet)) return;
  state.currentBet += splitBet;
  showChange("betChg", splitBet);
  const [cardA, cardB] = state.playerHands[0];
  const isAceSplit = cardA.val === "A" && cardB.val === "A";
  state.playerHands = [[cardA], [cardB]];
  state.playerHandBets = [splitBet, splitBet];
  state.playerHandNaturalEligible = [false, false];
  state.playerStood = isAceSplit ? [true, true] : [false, false];
  state.playerBusted = [false, false];
  state.activePlayerHand = 0;
  drawCard("player", 0);
  drawCard("player", 1);
  if (!isAceSplit) {
    if (handValue(state.playerHands[0]) === 21) state.playerStood[0] = true;
    if (handValue(state.playerHands[1]) === 21) state.playerStood[1] = true;
    setStatus("Player splits into two hands.");
    render();
    return;
  }

  setStatus(
    "Split aces: one card dealt to each ace. Hands stand automatically.",
  );
  render();
  window.setTimeout(() => beginDealerPhase(), 250);
}

function advanceAfterPlayerAction(message) {
  if (message) setStatus(message);
  const next = findNextOpenPlayerHand(state.activePlayerHand);
  if (next !== -1) {
    state.activePlayerHand = next;
    render();
    return;
  }
  beginDealerPhase();
}

function checkDealerBlackjack() {
  const dealerNatural = isBlackjack(state.dealerHand);
  if (!dealerNatural) return false;

  const results = [];
  for (let index = 0; index < state.playerHands.length; index += 1) {
    const hand = state.playerHands[index];
    const score = handValue(hand);
    const bet = state.playerHandBets[index];
    const playerBlackjack = isPlayerHandNaturalBlackjack(index);

    if (playerBlackjack) {
      state.bankrolls.player += bet;
      state.bankrolls.dealer += bet;
      results.push(`H${index + 1}: Push with blackjack`);
    } else if (score > 21) {
      state.bankrolls.dealer += bet * 2;
      results.push(`H${index + 1}: Bust (${score}) loses to dealer blackjack`);
    } else {
      state.bankrolls.dealer += bet * 2;
      results.push(`H${index + 1}: ${score} loses to dealer blackjack`);
    }
  }

  concludeRound(
    "lose",
    "Dealer Blackjack!",
    "Dealer takes the hand.",
    results.join(" • "),
  );
  return true;
}

function beginDealerPhase() {
  state.phase = "dealer";
  state.dealerHidden = false;
  render();
  if (checkDealerBlackjack()) return;
  if (allPlayerHandsBusted()) {
    setStatus("All player hands busted. Dealer wins automatically.");
    window.setTimeout(() => settleAllPlayerBusts(), 450);
    return;
  }
  state.dealerAutoRunning = true;
  setStatus("Dealer is playing automatically...");
  render();
  window.setTimeout(() => runDealerAutoTurn(), 550);
}

function runDealerAutoTurn() {
  if (state.phase !== "dealer") return;
  while (shouldDealerHit(state.dealerHand)) {
    drawCard("dealer");
  }
  const dealerScore = handValue(state.dealerHand);
  state.dealerAutoRunning = false;
  if (dealerScore > 21) setStatus(`Dealer busts with ${dealerScore}.`);
  else setStatus(`Dealer stands on ${dealerScore}.`);
  settleStandardRound();
}

function settleAllPlayerBusts() {
  if (state.phase !== "dealer") return;
  const results = [];
  for (let index = 0; index < state.playerHands.length; index += 1) {
    const bet = state.playerHandBets[index];
    const score = handValue(state.playerHands[index]);
    state.bankrolls.dealer += bet * 2;
    results.push(`H${index + 1}: Dealer wins on player bust (${score})`);
  }
  concludeRound(
    "lose",
    "Dealer Wins",
    results.join(" • "),
    `Dealer collects ${formatMoney(state.currentBet)}.`,
  );
}

function settleStandardRound() {
  const dealerScore = handValue(state.dealerHand);
  const dealerValid = dealerScore <= 21;
  const dealerBlackjack = isBlackjack(state.dealerHand);
  const results = [];
  for (let index = 0; index < state.playerHands.length; index += 1) {
    const hand = state.playerHands[index];
    const playerScore = handValue(hand);
    const playerValid = playerScore <= 21;
    const playerBlackjack = isPlayerHandNaturalBlackjack(index);
    const bet = state.playerHandBets[index];
    if (playerBlackjack && dealerScore === 21 && !dealerBlackjack) {
      const profit = getBlackjackProfit(bet);
      const extraDealerCharge = Math.max(0, profit - bet);
      state.bankrolls.player += bet + profit;
      state.bankrolls.dealer -= extraDealerCharge;
      results.push(
        `H${index + 1}: Blackjack beats dealer 21 (${playerScore} vs ${dealerScore}) for ${formatMoney(profit)}`,
      );
    } else if (dealerBlackjack && playerScore === 21 && !playerBlackjack) {
      state.bankrolls.dealer += bet * 2;
      results.push(`H${index + 1}: Dealer blackjack beats ${playerScore}`);
    } else if (playerValid && (!dealerValid || playerScore > dealerScore)) {
      state.bankrolls.player += bet * 2;
      results.push(
        `H${index + 1}: Player wins (${playerScore} vs ${dealerScore})`,
      );
    } else if (dealerValid && (!playerValid || dealerScore > playerScore)) {
      state.bankrolls.dealer += bet * 2;
      results.push(
        `H${index + 1}: Dealer wins (${dealerScore} vs ${playerScore})`,
      );
    } else {
      state.bankrolls.player += bet;
      state.bankrolls.dealer += bet;
      results.push(`H${index + 1}: Push at ${playerScore}`);
    }
  }
  const playerDelta = state.bankrolls.player - state.roundStartBankrolls.player;
  const title =
    playerDelta > 0
      ? "Player Wins!"
      : playerDelta < 0
        ? "Dealer Wins"
        : "Push!";
  const type = playerDelta > 0 ? "win" : playerDelta < 0 ? "lose" : "push";
  const payText =
    playerDelta > 0
      ? `Player profits ${formatMoney(playerDelta)}.`
      : playerDelta < 0
        ? `Dealer profits ${formatMoney(Math.abs(playerDelta))}.`
        : "No money changes hands.";
  concludeRound(type, title, results.join(" • "), payText);
}

function concludeRound(type, title, subtitle, payText) {
  const playerDelta = state.bankrolls.player - state.roundStartBankrolls.player;
  const dealerDelta = state.bankrolls.dealer - state.roundStartBankrolls.dealer;
  state.phase = "done";
  state.dealerHidden = false;
  state.dealerAutoRunning = false;
  state.currentBet = 0;
  showChange("playerChg", playerDelta);
  showChange("dealerChg", dealerDelta);
  clearChange("betChg");
  showResult(type, title, subtitle, payText);
  render();
}

function startNewHand() {
  resetHandStateForBetting();
  const placed = applyAutomaticBetIfConfigured();
  if (placed > 0) {
    setStatus(
      `Automatic bet placed: ${formatMoney(placed)}. Press Deal or adjust with chips.`,
    );
  } else {
    setStatus("Place your bet using the chips below, then press Deal.");
  }
  render();
}

function isTypingIntoField(eventTarget) {
  if (!eventTarget) return false;
  const tag = eventTarget.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    eventTarget.isContentEditable
  );
}

function triggerActionFromHotkey(action) {
  if (action === "deal" && state.phase === "betting") {
    deal();
    return true;
  }
  if (action === "hit" && state.phase === "player") {
    playerHit();
    return true;
  }
  if (action === "stand" && state.phase === "player") {
    playerStand();
    return true;
  }
  if (action === "double" && state.phase === "player") {
    playerDouble();
    return true;
  }
  if (action === "split" && state.phase === "player") {
    playerSplit();
    return true;
  }
  return false;
}

function onGlobalKeyDown(event) {
  if (event.key === "Escape") {
    closeBankrollModal();
    closeSimulationModal();
    closeSimulationWarningModal();
    closeKeybindsModal();
    closeSettingsMenu();
    return;
  }

  if (!state.hotkeysEnabled) return;
  if (isTypingIntoField(event.target)) return;
  if (
    ui.bankrollModal.classList.contains("open") ||
    ui.simulationModal.classList.contains("open") ||
    ui.simulationWarningModal.classList.contains("open") ||
    ui.keybindsModal.classList.contains("open") ||
    state.settingsOpen
  ) {
    return;
  }

  const key = normalizeKeybindChar(event.key);
  if (!key) return;

  const action = Object.keys(state.keybinds).find(
    (name) => state.keybinds[name] === key,
  );
  if (!action) return;

  const didRun = triggerActionFromHotkey(action);
  if (didRun) event.preventDefault();
}

function onActionClick(event) {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  if (button.id === "dealBtn") deal();
  else if (button.id === "hitBtn") playerHit();
  else if (button.id === "standBtn") playerStand();
  else if (button.id === "dblBtn") playerDouble();
  else if (button.id === "splitBtn") playerSplit();
  else if (button.id === "newBtn") startNewHand();
}

function cardMarkup(card, hidden, isFreshlyDrawn = false) {
  if (hidden)
    return `<div class="card hidden${isFreshlyDrawn ? " card-drawn" : ""}"></div>`;
  const isRed = card.suit === "♥" || card.suit === "♦";
  return `<div class="card ${isRed ? "red" : "black"}${isFreshlyDrawn ? " card-drawn" : ""}"><div class="card-corner">${card.val}<br>${card.suit}</div><div class="card-suit-center">${card.suit}</div><div class="card-corner bottom">${card.val}<br>${card.suit}</div></div>`;
}

function renderDealerHand() {
  ui.dealerHand.innerHTML = state.dealerHand
    .map((card, index) =>
      cardMarkup(
        card,
        state.dealerHidden && index === 1,
        state.newlyDrawnCards.includes(card),
      ),
    )
    .join("");
  if (!state.dealerHand.length) {
    ui.dealerScore.textContent = "–";
    ui.dealerScore.className = "score-badge";
    return;
  }
  ui.dealerScore.textContent = state.dealerHidden
    ? `${handValue(state.dealerHand.slice(0, 1))}+`
    : String(handValue(state.dealerHand));
  ui.dealerScore.className = "score-badge";
  if (!state.dealerHidden) {
    const score = handValue(state.dealerHand);
    if (score > 21) ui.dealerScore.className += " bust";
    else if (isBlackjack(state.dealerHand))
      ui.dealerScore.className += " blackjack";
  }
}

function getScoreBadgeClass(hand, busted, naturalEligible = true) {
  let className = "score-badge";
  if (busted) className += " bust";
  else if (isNaturalBlackjack(hand, naturalEligible)) className += " blackjack";
  return className;
}

function renderPlayerHands() {
  if (!state.playerHands.length || !state.playerHands[0].length) {
    ui.playerHandsArea.innerHTML =
      '<div class="hand-row"></div><div class="score-badge">–</div>';
    return;
  }
  const html = state.playerHands
    .map((hand, index) => {
      const active =
        state.phase === "player" &&
        state.activePlayerHand === index &&
        !state.playerStood[index];
      return `
        <div class="player-hand-panel${active ? " active" : ""}">
          <div class="player-hand-meta">
            <span class="hand-caption">Hand ${index + 1}</span>
            <span class="bet-pill">Bet ${formatMoney(state.playerHandBets[index])}</span>
          </div>
          <div class="hand-row">${hand
            .map((card) =>
              cardMarkup(card, false, state.newlyDrawnCards.includes(card)),
            )
            .join("")}</div>
          <div class="${getScoreBadgeClass(
            hand,
            state.playerBusted[index],
            state.playerHandNaturalEligible[index],
          )}">${handValue(hand)}</div>
        </div>
      `;
    })
    .join("");
  ui.playerHandsArea.innerHTML = `<div class="player-hand-stack">${html}</div>`;
}

function renderButtons() {
  let html = "";
  if (state.phase === "betting") {
    html = '<button class="btn btn-deal" id="dealBtn">Deal</button>';
  } else if (state.phase === "player") {
    html = `
      <button class="btn btn-hit" id="hitBtn">Hit</button>
      <button class="btn btn-stand" id="standBtn">Stand</button>
      ${canDouble() ? '<button class="btn btn-double" id="dblBtn">Double</button>' : ""}
      ${canSplit() ? '<button class="btn btn-double" id="splitBtn">Split</button>' : ""}
    `;
  } else if (state.phase === "dealer") {
    html =
      '<button class="btn btn-auto" disabled>Dealer Playing Automatically…</button>';
  } else if (state.phase === "done") {
    html = '<button class="btn btn-new" id="newBtn">New Hand</button>';
  }
  ui.actions.innerHTML = html;
}

function renderPhase() {
  const phases = [
    { key: "bet", label: "Bet" },
    { key: "player", label: "Player" },
    { key: "dealer", label: "Dealer" },
    { key: "done", label: "Resolve" },
  ];
  const order = ["bet", "player", "dealer", "done"];
  const current = state.phase === "betting" ? "bet" : state.phase;
  const currentIndex = order.indexOf(current);
  ui.phasePips.innerHTML = phases
    .map((phase, index) => {
      let className = "phase-pip";
      if (index < currentIndex) className += " done";
      else if (index === currentIndex) className += " active";
      else className += " pending";
      return `<span class="${className}">${phase.label}</span>`;
    })
    .join("");
}

function renderTurnIndicators() {
  [ui.dealerTurn, ui.playerTurn].forEach((element) => {
    element.style.display = "none";
  });
  if (state.phase === "dealer") {
    ui.dealerTurn.style.display = "inline";
  }
  if (state.phase === "player") {
    ui.playerTurn.style.display = "inline";
  }
}

function showResult(type, title, subtitle, payText) {
  ui.resultText.className = `result-text ${type}`;
  ui.resultText.textContent = title;
  ui.resultSub.textContent = subtitle;
  ui.resultPay.textContent = payText;
  ui.resultPay.style.color =
    type === "win" ? "#7fff7f" : type === "lose" ? "#e74c3c" : "var(--gold)";
  ui.resultBanner.style.display = "block";
  ui.table.classList.add("result-open");
}

function hideResult() {
  ui.resultBanner.style.display = "none";
  ui.table.classList.remove("result-open");
}

function setStatus(message, alert = false) {
  ui.statusBar.textContent = message;
  ui.statusBar.className = `status-bar${alert ? " alert" : ""}`;
  if (alert) {
    clearTimeout(ui.statusBar._timeout);
    ui.statusBar._timeout = window.setTimeout(() => {
      ui.statusBar.className = "status-bar";
    }, 2000);
  }
}

function render() {
  renderBalances();
  renderDealerHand();
  renderPlayerHands();
  renderButtons();
  renderPhase();
  renderTurnIndicators();
  renderChips();
  const bankrollCanOpen = state.phase === "betting" || state.phase === "done";
  ui.openBankrollBtn.disabled = !bankrollCanOpen;
  if (state.assistedGameplay && state.phase === "player") {
    showAssistRecommendation();
  }
  state.newlyDrawnCards = [];
}

document.addEventListener("DOMContentLoaded", init);

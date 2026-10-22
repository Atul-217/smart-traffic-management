(() => {
  "use strict";

  const STORAGE_KEY = "smartTrafficSimulation.v1";
  const ROADS = ["north", "south", "east", "west"];
  const LABELS = { north: "North", south: "South", east: "East", west: "West" };
  const DEFAULTS = {
    roads: { north: { vehicles: 24, water: 8 }, south: { vehicles: 18, water: 12 }, east: { vehicles: 32, water: 17 }, west: { vehicles: 13, water: 10 } },
    minGreen: 8, maxGreen: 28, warningThreshold: 35, criticalThreshold: 65
  };
  const state = {
    roads: structuredClone(DEFAULTS.roads),
    minGreen: DEFAULTS.minGreen, maxGreen: DEFAULTS.maxGreen,
    warningThreshold: DEFAULTS.warningThreshold, criticalThreshold: DEFAULTS.criticalThreshold,
    mode: "auto", running: true, phase: "allred", activeRoad: null, targetRoad: "north",
    seconds: 1, emergencyRoad: null, alerts: [], history: [], intervalId: null,
    transitionToken: 0, lastAlertStatus: {}, handledWaterStatus: {}
  };
  const $ = (id) => document.getElementById(id);
  const safeStorage = {
    read() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (error) { console.warn("Saved simulation settings could not be read.", error); return null; } },
    write(value) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (error) { console.warn("Simulation settings could not be saved.", error); } }
  };

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function isValidRoad(road) { return ROADS.includes(road); }
  function validNumber(value, min, max) {
    const number = Number(value);
    return Number.isFinite(number) ? clamp(Math.round(number), min, max) : null;
  }
  function densityFor(count) {
    if (count >= 75) return "Critical";
    if (count >= 50) return "High";
    if (count >= 25) return "Medium";
    return "Low";
  }
  function waterStatus(road) {
    const level = state.roads[road].water;
    if (level >= state.criticalThreshold) return "critical";
    if (level >= state.warningThreshold) return "warning";
    return "normal";
  }
  function safetyFor(road) {
    const status = waterStatus(road);
    if (status === "critical") return { level: "Unsafe", className: "unsafe", reason: `Critical simulated water level (${state.roads[road].water} cm)` };
    if (status === "warning") return { level: "Caution", className: "caution", reason: `Water warning at ${state.roads[road].water} cm` };
    return { level: "Safe", className: "safe", reason: "No simulated water warning" };
  }
  function isSafe(road) { return waterStatus(road) !== "critical"; }
  function calculateGreenDuration(count) {
    const span = state.maxGreen - state.minGreen;
    return Math.round(state.minGreen + clamp(count, 0, 100) / 100 * span);
  }
  function chooseRoad(excludeCurrent = false) {
    const candidates = ROADS.filter((road) => isSafe(road) && (!excludeCurrent || road !== state.activeRoad));
    if (!candidates.length) return null;
    if (state.emergencyRoad && candidates.includes(state.emergencyRoad)) return state.emergencyRoad;
    if (state.mode === "manual" && candidates.includes(state.targetRoad)) return state.targetRoad;
    return candidates.sort((a, b) => state.roads[b].vehicles - state.roads[a].vehicles)[0];
  }
  function reasonFor(road) {
    if (!road) return "No safe road is currently available; all signals remain red.";
    if (state.emergencyRoad === road) return `Ambulance request has priority on ${LABELS[road]}; the controller uses a safe transition.`;
    if (state.mode === "manual") return `Manual request for ${LABELS[road]} accepted because the road is not critically waterlogged.`;
    return `${LABELS[road]} has the highest simulated vehicle count among safe approaches.`;
  }
  function save() {
    safeStorage.write({
      roads: state.roads, minGreen: state.minGreen, maxGreen: state.maxGreen,
      warningThreshold: state.warningThreshold, criticalThreshold: state.criticalThreshold,
      mode: state.mode, history: state.history.slice(0, 30)
    });
  }
  function addEvent(kind, title, message, road = null) {
    state.history.unshift({ kind, title, message, road, time: new Date().toLocaleTimeString() });
    state.history = state.history.slice(0, 30);
    renderHistory();
    save();
  }
  function setAlert(road, status) {
    const previous = state.lastAlertStatus[road] || "normal";
    if (previous === status) return;
    state.lastAlertStatus[road] = status;
    if (status === "normal") return;
    const title = status === "critical" ? "Critical waterlogging" : "Water level warning";
    const action = status === "critical" ? "Road marked unsafe; do not schedule a green phase." : "Use caution; consider another safe route.";
    const id = `${road}-${status}`;
    if (!state.alerts.some((alert) => alert.id === id)) {
      state.alerts.unshift({ id, road, status, title, action, time: new Date().toLocaleTimeString() });
    }
    addEvent(status, `${LABELS[road]} · ${title}`, `${state.roads[road].water} cm. ${action}`, road);
  }
  function renderHistory() {
    const log = $("eventLog");
    if (!log) return;
    log.innerHTML = state.history.length ? state.history.slice(0, 12).map((event) =>
      `<div class="event-item ${event.kind}"><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(event.message)}</span><br><small>${escapeHtml(event.time)}</small></div>`
    ).join("") : '<div class="event-item info">No events recorded in this browser session.</div>';
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function buildRoadCards() {
    $("roadInputs").innerHTML = ROADS.map((road) => `
      <article class="road-card">
        <div class="road-card-top"><h3>${LABELS[road]}</h3><span id="density-${road}" class="density-badge">Low</span></div>
        <div class="field-row"><label for="vehicles-${road}">Simulated vehicles (0–100)</label>
          <div class="range-row"><input id="vehicles-${road}" data-road="${road}" type="range" min="0" max="100" value="${state.roads[road].vehicles}" aria-label="${LABELS[road]} simulated vehicle count"><output id="vehicles-value-${road}">${state.roads[road].vehicles}</output></div>
        </div>
        <div class="density-meter"><i id="density-meter-${road}"></i></div>
        <small id="road-status-${road}" class="section-note"></small>
      </article>`).join("");
    $("waterInputs").innerHTML = ROADS.map((road) => `
      <article class="road-card water-card">
        <div class="road-card-top"><h3>${LABELS[road]}</h3><span id="water-badge-${road}" class="safety-badge safe">Normal</span></div>
        <div class="field-row"><label for="water-${road}">Simulated water level (cm)</label>
          <div class="range-row"><input id="water-${road}" data-road="${road}" type="range" min="0" max="100" value="${state.roads[road].water}" aria-label="${LABELS[road]} simulated water level"><output id="water-value-${road}">${state.roads[road].water}</output></div>
        </div>
        <div class="water-meter"><i id="water-meter-${road}"></i></div>
        <div class="water-level-line"><span id="water-status-${road}">Normal</span><strong>${state.roads[road].water} cm</strong></div>
        <p id="water-action-${road}"></p>
      </article>`).join("");
  }
  function addInputListeners() {
    document.querySelectorAll("#roadInputs input[type=range]").forEach((input) => input.addEventListener("input", () => {
      const road = input.dataset.road;
      state.roads[road].vehicles = validNumber(input.value, 0, 100);
      $("vehicles-value-" + road).value = state.roads[road].vehicles;
      $("vehicles-value-" + road).textContent = state.roads[road].vehicles;
      save(); renderAll();
    }));
    document.querySelectorAll("#waterInputs input[type=range]").forEach((input) => input.addEventListener("input", () => {
      const road = input.dataset.road;
      state.roads[road].water = validNumber(input.value, 0, 100);
      $("water-value-" + road).value = `${state.roads[road].water} cm`;
      $("water-value-" + road).textContent = state.roads[road].water;
      applyWaterStatus(); save(); renderAll();
    }));
  }
  function applyWaterStatus() {
    for (const road of ROADS) setAlert(road, waterStatus(road));
    if (state.activeRoad && !isSafe(state.activeRoad)) {
      addEvent("critical", `${LABELS[state.activeRoad]} signal cancelled`, "Unsafe road detected; entering all-red clearance before selecting another road.", state.activeRoad);
      state.targetRoad = chooseRoad(true);
      beginAllRed(state.targetRoad);
    } else if (!state.activeRoad && state.phase === "allred") {
      state.targetRoad = chooseRoad();
    }
  }
  function renderTraffic() {
    for (const road of ROADS) {
      const count = state.roads[road].vehicles;
      const density = densityFor(count);
      const badge = $("density-" + road);
      badge.textContent = density; badge.className = "density-badge " + density.toLowerCase();
      $("vehicles-" + road).value = count;
      $("vehicles-value-" + road).textContent = count;
      $("density-meter-" + road).style.width = `${count}%`;
      $("road-status-" + road).textContent = `${count} simulated vehicles · ${safetyFor(road).level}`;
    }
  }
  function renderWater() {
    const alerts = [];
    for (const road of ROADS) {
      const level = state.roads[road].water;
      const status = waterStatus(road);
      const label = status === "critical" ? "Critical" : status === "warning" ? "Warning" : "Normal";
      const badge = $("water-badge-" + road);
      badge.textContent = label;
      badge.className = `safety-badge ${status === "critical" ? "unsafe" : status === "warning" ? "caution" : "safe"}`;
      $("water-" + road).value = level;
      $("water-value-" + road).textContent = `${level} cm`;
      $("water-meter-" + road).style.width = `${level}%`;
      $("water-status-" + road).textContent = label;
      $("water-status-" + road).nextElementSibling.textContent = `${level} cm`;
      const action = status === "critical" ? "Unsafe — not eligible for a green signal." : status === "warning" ? "Caution — alternate safe route recommended." : "No simulated water alert.";
      $("water-action-" + road).textContent = action;
      if (status !== "normal") alerts.push(`${LABELS[road]}: ${level} cm (${label})`);
    }
    const summary = $("waterSummary");
    summary.textContent = alerts.length ? `${alerts.join(" · ")}. ${ROADS.some(isSafe) ? "Alternative safe routes are considered." : "No safe route is available; signals remain red."}` : "No water alerts. All levels are below the configured warning threshold.";
    summary.className = `water-summary ${alerts.some((item) => item.includes("(Critical)")) ? "critical" : alerts.length ? "warning" : ""}`;
  }
  function renderSafety() {
    $("safetyList").innerHTML = ROADS.map((road) => {
      const safety = safetyFor(road);
      const alternate = ROADS.filter((other) => other !== road && isSafe(other)).sort((a, b) => state.roads[b].vehicles - state.roads[a].vehicles)[0];
      const recommendation = safety.className === "unsafe" ? (alternate ? `Alternative: ${LABELS[alternate]} (safe)` : "No safe alternative available") : safety.className === "caution" ? (alternate ? `Consider ${LABELS[alternate]} as an alternative` : "No alternative available") : "No action needed";
      return `<div class="safety-item"><strong>${LABELS[road]}</strong><span class="safety-badge ${safety.className}">${safety.level}</span><span>${safety.reason} · ${recommendation}</span></div>`;
    }).join("");
  }
  function renderAlerts() {
    const alerts = $("alertsList");
    $("alertCount").textContent = state.alerts.length;
    $("alertTag").textContent = `${state.alerts.length} active`;
    $("safeCount").textContent = `${ROADS.filter((road) => safetyFor(road).level === "Safe").length} roads safe`;
    alerts.innerHTML = state.alerts.length ? state.alerts.map((alert) =>
      `<div class="event-item ${alert.status}"><strong>${LABELS[alert.road]} · ${alert.title}</strong><span>${alert.action}</span><br><small>${alert.time} · simulated value ${state.roads[alert.road].water} cm</small></div>`
    ).join("") : '<div class="event-item info">No active simulated alerts.</div>';
  }
  function renderSignals() {
    document.querySelectorAll(".signal").forEach((signal) => {
      const road = signal.dataset.signal;
      signal.querySelector(".red").classList.toggle("active", state.phase === "allred" || road !== state.activeRoad);
      signal.querySelector(".yellow").classList.toggle("active", state.phase === "yellow" && road === state.activeRoad);
      signal.querySelector(".green").classList.toggle("active", state.phase === "green" && road === state.activeRoad && isSafe(road));
    });
    $("decisionRoad").textContent = state.phase === "green" && state.activeRoad ? LABELS[state.activeRoad] : state.phase === "yellow" && state.activeRoad ? `${LABELS[state.activeRoad]} →` : "All red";
    $("phasePill").textContent = `${state.phase.toUpperCase()} PHASE`;
    $("phasePill").style.color = state.phase === "green" ? "var(--green)" : state.phase === "yellow" ? "var(--yellow)" : "var(--red)";
    $("decisionReason").textContent = state.phase === "allred" ? "Clearance interval: all approaches are red before the next safe phase." : reasonFor(state.activeRoad);
    $("nextRoad").textContent = state.targetRoad ? LABELS[state.targetRoad] : "No safe road";
    $("activeRoad").textContent = state.phase === "green" && state.activeRoad ? LABELS[state.activeRoad] : state.phase === "yellow" && state.activeRoad ? `${LABELS[state.activeRoad]} yellow` : "All red";
    $("signalStatus").textContent = state.running ? `${state.phase} phase` : "Paused";
    $("countdown").textContent = `${state.seconds}s`;
    $("systemStatus").textContent = state.running ? (state.emergencyRoad ? "Emergency priority" : "Monitoring") : "Paused";
  }
  function renderDashboard() {
    const total = ROADS.reduce((sum, road) => sum + state.roads[road].vehicles, 0);
    $("totalVehicles").textContent = total;
    $("modeLabel").textContent = state.mode.toUpperCase();
    $("controlModeTag").textContent = state.mode === "auto" ? "Automatic scheduling" : "Manual road requests";
    $("congestionBefore").textContent = `${Math.round(total / 4)}%`;
    const safeCount = Math.max(1, ROADS.filter(isSafe).length);
    $("congestionAfter").textContent = `${Math.round(total / safeCount / 5)}%`;
  }
  function renderDecisions() {
    $("decisionTable").innerHTML = ROADS.map((road) => {
      const safety = safetyFor(road);
      const decision = safety.className === "unsafe" ? "Skip — unsafe" : state.emergencyRoad === road ? "Emergency priority" : `Green ${calculateGreenDuration(state.roads[road].vehicles)}s`;
      return `<tr><td>${LABELS[road]}</td><td>${state.roads[road].vehicles}</td><td>${densityFor(state.roads[road].vehicles)}</td><td>${state.roads[road].water} cm</td><td>${decision}</td></tr>`;
    }).join("");
  }
  function renderEmergency() {
    const active = Boolean(state.emergencyRoad);
    $("emergencyLabel").textContent = active ? "EMERGENCY ACTIVE" : "NORMAL OPERATIONS";
    $("emergencyTitle").textContent = active ? `Ambulance on ${LABELS[state.emergencyRoad]}` : "No active emergency";
    $("emergencyReason").textContent = active ? isSafe(state.emergencyRoad) ? "Priority requested. The controller will transition through yellow and all-red before granting green." : "Requested approach is critically waterlogged. Priority cannot be granted; select a safe alternative." : "Simulate an ambulance to request safe priority for a selected road.";
    $("emergencyLabel").style.color = active ? "var(--red)" : "var(--green)";
    document.querySelector(".emergency-card").classList.toggle("active", active);
  }
  function renderAll() {
    renderTraffic(); renderWater(); renderSafety(); renderAlerts(); renderSignals();
    renderDashboard(); renderDecisions(); renderEmergency();
  }

  function startGreen(road) {
    if (!road || !isSafe(road)) {
      state.activeRoad = null; state.phase = "allred"; state.targetRoad = chooseRoad(); state.seconds = 1;
      renderAll(); return;
    }
    state.activeRoad = road; state.targetRoad = road; state.phase = "green";
    state.seconds = calculateGreenDuration(state.roads[road].vehicles);
    addEvent("info", `${LABELS[road]} green phase`, `Scheduled for ${state.seconds} seconds. ${reasonFor(road)}`, road);
    renderAll();
  }
  function beginAllRed(target) {
    state.transitionToken += 1;
    state.activeRoad = null; state.phase = "allred"; state.targetRoad = target; state.seconds = 1;
    renderAll();
  }
  function beginTransition(target) {
    if (target && !isSafe(target)) target = chooseRoad(true);
    if (target === state.activeRoad && state.phase === "green") return;
    state.transitionToken += 1;
    const token = state.transitionToken;
    if (state.phase === "green" && state.activeRoad) {
      state.phase = "yellow"; state.seconds = 3; state.targetRoad = target;
      renderAll();
      window.setTimeout(() => {
        if (token !== state.transitionToken || !state.running) return;
        state.activeRoad = null; state.phase = "allred"; state.seconds = 1;
        renderAll();
      }, 3000);
      return;
    }
    state.activeRoad = null; state.phase = "allred"; state.targetRoad = target; state.seconds = 1;
    renderAll();
  }
  function tick() {
    if (!state.running) return;
    if (state.seconds > 1) { state.seconds -= 1; renderSignals(); return; }
    if (state.phase === "green") {
      const next = chooseRoad(true);
      beginTransition(next);
      return;
    }
    if (state.phase === "yellow") {
      state.activeRoad = null; state.phase = "allred"; state.seconds = 1; renderAll();
      return;
    }
    const next = state.targetRoad && isSafe(state.targetRoad) ? state.targetRoad : chooseRoad();
    startGreen(next);
  }
  function startController() {
    if (state.intervalId !== null) return;
    state.running = true;
    if (state.phase === "allred") {
      state.targetRoad = chooseRoad();
      state.seconds = 1;
    }
    state.intervalId = window.setInterval(tick, 1000);
    renderAll();
  }
  function pauseController() {
    if (state.intervalId !== null) window.clearInterval(state.intervalId);
    state.intervalId = null; state.running = false; state.transitionToken += 1;
    if (state.phase === "yellow") { state.activeRoad = null; state.phase = "allred"; state.seconds = 1; }
    renderAll();
  }
  function resetController() {
    pauseController();
    state.mode = "auto"; state.emergencyRoad = null; state.activeRoad = null; state.phase = "allred"; state.targetRoad = chooseRoad(); state.seconds = 1;
    state.running = true; startController(); renderAll();
  }
  function setMode(value) {
    state.mode = value === "manual" ? "manual" : "auto";
    state.targetRoad = chooseRoad();
    if (state.phase === "green") beginTransition(state.targetRoad);
    save(); renderAll();
  }
  function requestRoad(road) {
    if (!isValidRoad(road)) return;
    if (!isSafe(road)) {
      addEvent("warning", `${LABELS[road]} request denied`, "A critically waterlogged road cannot be selected for green.");
      renderAll(); return;
    }
    state.mode = "manual"; $("modeSelect").value = "manual"; state.targetRoad = road;
    if (!state.running) startController();
    beginTransition(road); save(); renderAll();
  }
  function runALU() {
    const a = validNumber($("operandA").value, 0, 1000);
    const b = validNumber($("operandB").value, 0, 1000);
    if (a === null || b === null) { $("aluResult").textContent = "Enter valid numbers"; return; }
    const operation = $("aluOperation").value;
    let expression = `${a} + ${b}`, result = a + b;
    if (operation === "subtract") { expression = `${a} − ${b}`; result = a - b; }
    if (operation === "compare") { expression = `${a} compared with ${b}`; result = a > b ? "A is greater" : a < b ? "B is greater" : "Equal"; }
    if (operation === "duration") { expression = `Green duration for ${a} vehicles`; result = `${calculateGreenDuration(a)} seconds`; }
    if (operation === "ambulance") { expression = `${a ? "Request active" : "No request"}; road safety required`; result = a > 0 ? "Priority if route is safe" : "Normal scheduling"; }
    if (operation === "water") { expression = `Water ${a} cm (warning ${state.warningThreshold}, critical ${state.criticalThreshold})`; result = a >= state.criticalThreshold ? "Critical — unsafe" : a >= state.warningThreshold ? "Warning" : "Normal"; }
    $("aluExpression").textContent = expression;
    $("aluResult").textContent = String(result);
  }
  function handleEmergency(road) {
    if (!isValidRoad(road)) return;
    state.emergencyRoad = road;
    addEvent(isSafe(road) ? "critical" : "warning", `Ambulance request · ${LABELS[road]}`, isSafe(road) ? "Priority queued using safe signal transitions." : "Requested route unsafe; no green will be scheduled until safe.");
    const target = isSafe(road) ? road : chooseRoad();
    if (!state.running) startController();
    beginTransition(target); renderAll();
  }
  function endEmergency() {
    if (!state.emergencyRoad) return;
    const oldRoad = state.emergencyRoad;
    state.emergencyRoad = null;
    addEvent("info", "Emergency ended", `Normal ${state.mode} scheduling resumed after safe clearance from ${LABELS[oldRoad]}.`);
    const target = chooseRoad(true);
    if (!state.running) startController();
    beginTransition(target); renderAll();
  }
  function clearResolvedAlerts() {
    state.alerts = state.alerts.filter((alert) => waterStatus(alert.road) === alert.status);
    renderAlerts();
  }
  async function delay(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
  async function runParallelDemo() {
    const button = $("runParallel");
    button.disabled = true; $("cycleStatus").textContent = "Processing…";
    const sensorTiles = Array.from(document.querySelectorAll(".sensor-tile"));
    sensorTiles.forEach((tile) => tile.classList.add("active"));
    const sample = async (road) => { await delay(80 + Math.random() * 120); return { road, vehicles: state.roads[road].vehicles }; };
    const sequentialStart = performance.now();
    for (const road of ROADS) await sample(road);
    const sequential = performance.now() - sequentialStart;
    const parallelStart = performance.now();
    const readings = await Promise.all(ROADS.map(sample));
    const parallel = performance.now() - parallelStart;
    $("sequentialTime").textContent = `${sequential.toFixed(0)} ms`;
    $("parallelTime").textContent = `${parallel.toFixed(0)} ms`;
    $("operationCount").textContent = String(readings.length);
    $("cycleStatus").textContent = "Complete";
    sensorTiles.forEach((tile) => tile.classList.remove("active"));
    button.disabled = false;
  }
  function setWater(road, value) {
    state.roads[road].water = value;
    const input = $("water-" + road);
    if (input) input.value = value;
  }
  function bindEvents() {
    addInputListeners();
    $("randomTraffic").addEventListener("click", () => {
      for (const road of ROADS) state.roads[road].vehicles = Math.floor(Math.random() * 101);
      save(); renderAll();
    });
    $("modeSelect").addEventListener("change", (event) => setMode(event.target.value));
    $("requestManual").addEventListener("click", () => requestRoad($("manualRoad").value));
    $("startButton").addEventListener("click", startController);
    $("resumeButton").addEventListener("click", startController);
    $("pauseButton").addEventListener("click", pauseController);
    $("resetButton").addEventListener("click", resetController);
    $("saveTiming").addEventListener("click", () => {
      const min = validNumber($("minGreen").value, 5, 60);
      const max = validNumber($("maxGreen").value, 6, 90);
      if (min === null || max === null || min >= max) { $("minGreen").setCustomValidity("Minimum green must be less than maximum green."); $("minGreen").reportValidity(); return; }
      $("minGreen").setCustomValidity("");
      state.minGreen = min; state.maxGreen = max;
      $("minGreen").value = min; $("maxGreen").value = max; save(); renderAll();
      addEvent("info", "Signal timing updated", `Green duration range is ${min}–${max} seconds.`);
    });
    $("runAlu").addEventListener("click", runALU);
    $("runParallel").addEventListener("click", runParallelDemo);
    $("simulateAmbulance").addEventListener("click", () => handleEmergency($("ambulanceRoad").value));
    $("endEmergency").addEventListener("click", endEmergency);
    $("risingWater").addEventListener("click", () => {
      for (const road of ROADS) setWater(road, clamp(state.roads[road].water + Math.floor(Math.random() * 21 + 10), 0, 100));
      applyWaterStatus(); save(); renderAll();
    });
    $("resetWater").addEventListener("click", () => {
      for (const road of ROADS) { setWater(road, 0); state.lastAlertStatus[road] = "normal"; }
      state.alerts = []; addEvent("info", "Water levels reset", "All simulated water readings returned to 0 cm and water alerts were resolved.");
      save(); renderAll();
    });
    $("saveThresholds").addEventListener("click", () => {
      const warning = validNumber($("warningThreshold").value, 1, 99);
      const critical = validNumber($("criticalThreshold").value, 2, 100);
      if (warning === null || critical === null || warning >= critical) { $("warningThreshold").setCustomValidity("Warning threshold must be lower than critical threshold."); $("warningThreshold").reportValidity(); return; }
      $("warningThreshold").setCustomValidity("");
      state.warningThreshold = warning; state.criticalThreshold = critical;
      applyWaterStatus(); save(); renderAll();
    });
    $("clearAlerts").addEventListener("click", clearResolvedAlerts);
    $("modeSelect").value = state.mode;
  }
  function loadSaved() {
    const saved = safeStorage.read();
    if (!saved || typeof saved !== "object") return;
    if (saved.roads && typeof saved.roads === "object") {
      for (const road of ROADS) {
        const entry = saved.roads[road];
        if (entry && Number.isFinite(entry.vehicles) && Number.isFinite(entry.water)) {
          state.roads[road] = { vehicles: clamp(entry.vehicles, 0, 100), water: clamp(entry.water, 0, 100) };
        }
      }
    }
    if (Number.isFinite(saved.minGreen)) state.minGreen = clamp(saved.minGreen, 5, 60);
    if (Number.isFinite(saved.maxGreen)) state.maxGreen = clamp(saved.maxGreen, 6, 90);
    if (state.maxGreen <= state.minGreen) { state.minGreen = DEFAULTS.minGreen; state.maxGreen = DEFAULTS.maxGreen; }
    if (Number.isFinite(saved.warningThreshold)) state.warningThreshold = clamp(saved.warningThreshold, 1, 99);
    if (Number.isFinite(saved.criticalThreshold)) state.criticalThreshold = clamp(saved.criticalThreshold, 2, 100);
    if (state.warningThreshold >= state.criticalThreshold) { state.warningThreshold = DEFAULTS.warningThreshold; state.criticalThreshold = DEFAULTS.criticalThreshold; }
    if (saved.mode === "manual" || saved.mode === "auto") state.mode = saved.mode;
    if (Array.isArray(saved.history)) state.history = saved.history.slice(0, 30);
  }
  function init() {
    loadSaved();
    buildRoadCards();
    $("minGreen").value = state.minGreen; $("maxGreen").value = state.maxGreen;
    $("warningThreshold").value = state.warningThreshold; $("criticalThreshold").value = state.criticalThreshold;
    $("modeSelect").value = state.mode;
    bindEvents();
    applyWaterStatus();
    renderAll(); renderHistory(); save();
    startController();
  }
  init();
})();

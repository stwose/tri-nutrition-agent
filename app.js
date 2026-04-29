const STORAGE_KEYS = {
  profile: "triNutritionProfile",
  sessions: "triNutritionSessions"
};

const today = new Date();
const isoToday = toIsoDate(today);

const sportOptions = ["swim", "bike", "run", "strength", "mobility", "rest"];
const environmentOptions = ["pool", "open_water", "outdoor", "indoor", "gym", "home"];
const sessionOptions = ["endurance", "intervals", "tempo", "long", "recovery", "strength", "brick", "mobility", "rest"];
const intensityOptions = ["low", "medium", "high", "race"];

let sessions = loadSessions();

const profileForm = document.querySelector("#profileForm");
const tableBody = document.querySelector("#trainingTable tbody");
const selectedDate = document.querySelector("#selectedDate");
const statusMessage = document.querySelector("#statusMessage");

selectedDate.value = isoToday;
loadProfileIntoForm();
renderTable();
renderAgentDay();

document.querySelector("#saveProfileBtn").addEventListener("click", () => {
  saveProfile();
  renderAgentDay();
});

document.querySelector("#generatePlanBtn").addEventListener("click", () => {
  saveProfile();
  renderAgentDay();
  setStatus(`Plan alimenticio actualizado para ${selectedDate.value || isoToday} usando tu calendario actual. No se ha modificado ningun entreno.`);
});

document.querySelector("#loadSampleBtn").addEventListener("click", () => {
  sessions = generateTriathlonPlan(readProfile(), new Date(selectedDate.value || isoToday), 14);
  persistSessions();
  renderTable();
  renderAgentDay();
  setStatus(`Ejemplo cargado desde ${selectedDate.value || isoToday}: ${sessions.length} sesiones en 14 dias.`);
});

document.querySelector("#addSessionBtn").addEventListener("click", () => {
  sessions.push({
    date: selectedDate.value || isoToday,
    start_time: "07:30",
    sport: "bike",
    environment: "outdoor",
    session_type: "endurance",
    duration_min: 60,
    intensity: "medium",
    planned_tss: 55,
    distance: "",
    distance_unit: "km",
    elevation_m: "",
    strength_focus: "",
    priority: "B",
    description: "Nueva sesión"
  });
  persistSessions();
  renderTable();
  renderAgentDay();
  setStatus("Sesion anadida al calendario.");
});

document.querySelector("#exportCsvBtn").addEventListener("click", () => {
  const blob = new Blob([toCsv(sessions)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "training_plan.csv";
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#csvInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  sessions = parseCsv(await file.text());
  persistSessions();
  renderTable();
  renderAgentDay();
  setStatus(`CSV importado: ${sessions.length} sesiones.`);
  event.target.value = "";
});

selectedDate.addEventListener("change", renderAgentDay);
profileForm.addEventListener("change", () => {
  saveProfile();
  renderAgentDay();
});

function readProfile() {
  const data = new FormData(profileForm);
  return {
    age: Number(data.get("age")) || 50,
    sex: data.get("sex") || "female",
    heightCm: Number(data.get("heightCm")) || 162,
    weightKg: Number(data.get("weightKg")) || 55,
    goal: data.get("goal") || "performance",
    raceType: data.get("raceType") || "full_ironman",
    raceDate: data.get("raceDate") || "2026-10-18",
    mealsPerDay: Number(data.get("mealsPerDay")) || 4,
    intolerances: splitList(data.get("intolerances")),
    preferences: splitList(data.get("preferences"))
  };
}

function saveProfile() {
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(readProfile()));
}

function loadProfileIntoForm() {
  const stored = localStorage.getItem(STORAGE_KEYS.profile);
  if (!stored) return;
  const profile = JSON.parse(stored);
  for (const [key, value] of Object.entries(profile)) {
    const field = profileForm.elements[key];
    if (!field) continue;
    field.value = Array.isArray(value) ? value.join(", ") : value;
  }
}

function loadSessions() {
  const stored = localStorage.getItem(STORAGE_KEYS.sessions);
  if (stored) return JSON.parse(stored);
  return generateTriathlonPlan({
    age: 50,
    sex: "female",
    heightCm: 162,
    weightKg: 55,
    raceDate: "2026-10-18"
  }, today, 14);
}

function persistSessions() {
  localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
}

function renderTable() {
  tableBody.innerHTML = "";
  sessions
    .sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`))
    .forEach((session, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><input data-index="${index}" data-field="date" type="date" value="${session.date}"></td>
        <td><input data-index="${index}" data-field="start_time" type="time" value="${session.start_time || ""}"></td>
        <td>${selectCell(index, "sport", sportOptions, session.sport)}</td>
        <td>${selectCell(index, "environment", environmentOptions, session.environment)}</td>
        <td>${selectCell(index, "session_type", sessionOptions, session.session_type)}</td>
        <td><input data-index="${index}" data-field="duration_min" type="number" min="0" value="${session.duration_min || 0}"></td>
        <td>${selectCell(index, "intensity", intensityOptions, session.intensity)}</td>
        <td><input data-index="${index}" data-field="planned_tss" type="number" min="0" value="${session.planned_tss || 0}"></td>
        <td class="description-cell"><input data-index="${index}" data-field="description" value="${escapeHtml(session.description || "")}"></td>
        <td><button class="delete-btn" data-delete="${index}" aria-label="Eliminar sesion">x</button></td>
      `;
      tableBody.appendChild(row);
    });

  tableBody.querySelectorAll("input, select").forEach((field) => {
    field.addEventListener("change", (event) => {
      const index = Number(event.target.dataset.index);
      const key = event.target.dataset.field;
      const numeric = ["duration_min", "planned_tss"].includes(key);
      sessions[index][key] = numeric ? Number(event.target.value) : event.target.value;
      persistSessions();
      renderAgentDay();
    });
  });

  tableBody.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      sessions.splice(Number(button.dataset.delete), 1);
      persistSessions();
      renderTable();
      renderAgentDay();
    });
  });
}

function selectCell(index, field, options, current) {
  const opts = options.map((option) => `<option value="${option}" ${option === current ? "selected" : ""}>${label(option)}</option>`).join("");
  return `<select data-index="${index}" data-field="${field}">${opts}</select>`;
}

function renderAgentDay() {
  const profile = readProfile();
  const date = selectedDate.value || isoToday;
  const daySessions = sessions.filter((session) => session.date === date);
  const tomorrow = addDays(new Date(`${date}T00:00:00`), 1);
  const tomorrowSessions = sessions.filter((session) => session.date === toIsoDate(tomorrow));
  const analysis = classifyDay(daySessions, tomorrowSessions);
  const targets = calculateNutrition(profile, daySessions, analysis);
  const meals = buildMeals(profile, daySessions, analysis, targets);

  document.querySelector("#trainingAnalysis").innerHTML = renderAnalysis(date, daySessions, tomorrowSessions, analysis);
  document.querySelector("#nutritionTargets").innerHTML = renderTargets(targets);
  document.querySelector("#mealPlan").innerHTML = meals.map(renderMeal).join("");
  document.querySelector("#raceFueling").innerHTML = renderFueling(daySessions, analysis, profile);
  document.querySelector("#weekPlan").innerHTML = renderWeekPlan(profile, date);
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function classifyDay(daySessions, tomorrowSessions) {
  const totalMinutes = daySessions.reduce((sum, session) => sum + Number(session.duration_min || 0), 0);
  const totalTss = daySessions.reduce((sum, session) => sum + Number(session.planned_tss || 0), 0);
  const hasLong = daySessions.some((session) => session.session_type === "long" || Number(session.duration_min) >= 120);
  const hasHigh = daySessions.some((session) => ["high", "race"].includes(session.intensity));
  const hasStrength = daySessions.some((session) => session.sport === "strength");
  const isBrick = daySessions.length > 1 && daySessions.some((session) => session.sport === "bike") && daySessions.some((session) => session.sport === "run");
  const tomorrowLong = tomorrowSessions.some((session) => session.session_type === "long" || Number(session.duration_min) >= 120);

  let type = "rest_day";
  if (isBrick && hasLong) type = "long_brick_day";
  else if (isBrick) type = "brick_day";
  else if (hasLong) type = "long_endurance_day";
  else if (hasHigh) type = "high_intensity_day";
  else if (daySessions.length > 1) type = "double_session_day";
  else if (hasStrength) type = "strength_day";
  else if (totalMinutes > 0) type = "easy_or_moderate_day";

  return {
    type,
    totalMinutes,
    totalTss,
    hasLong,
    hasHigh,
    hasStrength,
    isBrick,
    tomorrowLong,
    outdoorMinutes: daySessions
      .filter((session) => ["outdoor", "open_water"].includes(session.environment))
      .reduce((sum, session) => sum + Number(session.duration_min || 0), 0)
  };
}

function calculateNutrition(profile, daySessions, analysis) {
  const weight = profile.weightKg;
  const bmr = profile.sex === "female"
    ? 10 * weight + 6.25 * profile.heightCm - 5 * profile.age - 161
    : 10 * weight + 6.25 * profile.heightCm - 5 * profile.age + 5;
  const exerciseKcal = daySessions.reduce((sum, session) => sum + estimateKcal(session, weight), 0);
  const baseKcal = bmr * 1.35;
  const proteinFactor = analysis.hasStrength || analysis.hasHigh ? 1.9 : 1.75;
  const carbFactorByType = {
    rest_day: 3.2,
    easy_or_moderate_day: 4.5,
    strength_day: 4.4,
    high_intensity_day: 6.2,
    double_session_day: 6.4,
    long_endurance_day: 7.2,
    brick_day: 6.8,
    long_brick_day: 7.8
  };
  const proteinG = Math.round(weight * proteinFactor);
  const carbsG = Math.round(weight * (carbFactorByType[analysis.type] || 4.5));
  const kcalFromProteinCarbs = proteinG * 4 + carbsG * 4;
  const targetKcal = Math.round(baseKcal + exerciseKcal * 0.72 + (analysis.tomorrowLong ? 180 : 0));
  const fatG = Math.max(45, Math.round((targetKcal - kcalFromProteinCarbs) / 9));
  const hydrationL = Math.round((weight * 0.035 + analysis.outdoorMinutes / 60 * 0.45) * 10) / 10;

  return {
    kcal: Math.max(targetKcal, kcalFromProteinCarbs + fatG * 9),
    proteinG,
    carbsG,
    fatG,
    hydrationL,
    sodiumMgTraining: analysis.totalMinutes >= 90 ? "400-900 mg/h" : "segun sed y calor",
    carbTiming: timingText(analysis)
  };
}

function estimateKcal(session, weightKg) {
  const minutes = Number(session.duration_min || 0);
  const intensityMultiplier = { low: 0.85, medium: 1, high: 1.18, race: 1.28 }[session.intensity] || 1;
  const met = {
    swim: 8,
    bike: session.environment === "outdoor" ? 8.2 : 7.2,
    run: 9.5,
    strength: 5.2,
    mobility: 2.5,
    rest: 0
  }[session.sport] || 6;
  return Math.round((met * 3.5 * weightKg / 200) * minutes * intensityMultiplier);
}

function timingText(analysis) {
  if (analysis.type === "rest_day") return "Carbohidrato moderado y verduras repartidas; proteina estable.";
  if (analysis.hasLong) return "Desayuno alto en carbohidratos, baja fibra antes de salir, carbohidratos durante y recuperacion al terminar.";
  if (analysis.hasHigh) return "Carbohidrato claro en comida previa y recuperacion con proteina + carbohidrato.";
  if (analysis.hasStrength) return "Proteina repartida en 4 tomas y carbohidrato suficiente antes/despues de fuerza.";
  return "Reparto estable, con una toma rica en carbohidrato cerca del entreno.";
}

function buildMeals(profile, daySessions, analysis, targets) {
  const firstSession = [...daySessions].sort((a, b) => (a.start_time || "23:59").localeCompare(b.start_time || "23:59"))[0];
  const preWorkout = firstSession && firstSession.start_time && firstSession.start_time < "10:00";
  const longDay = analysis.hasLong || analysis.totalMinutes >= 150;
  const highDay = analysis.hasHigh || longDay;
  const carbScale = longDay ? 1.25 : highDay ? 1.12 : analysis.type === "rest_day" ? 0.72 : 1;
  const proteinScale = analysis.hasStrength ? 1.08 : 1;
  const breakfast = preWorkout
    ? quantities([
      ["pan sin gluten", 70 * carbScale, "g"],
      ["mermelada", 25 * carbScale, "g"],
      ["platano", 1, "unidad"],
      ["bebida de soja", 250, "ml"],
      ["cafe o infusion", 1, "taza"]
    ])
    : quantities([
      ["avena certificada sin gluten", 55 * carbScale, "g"],
      ["bebida de soja", 250, "ml"],
      ["proteina vegetal o whey sin lactosa", 20 * proteinScale, "g"],
      ["frutos rojos", 100, "g"],
      ["nueces", 15, "g"],
      ["miel", 12 * carbScale, "g"]
    ]);
  const lunch = highDay
    ? quantities([
      ["arroz blanco en crudo", 95 * carbScale, "g"],
      ["pechuga de pollo o tofu firme", 140 * proteinScale, "g"],
      ["calabacin", 160, "g"],
      ["zanahoria", 80, "g"],
      ["aceite de oliva", 12, "g"],
      ["limon y hierbas", 1, "al gusto"]
    ])
    : quantities([
      ["quinoa en crudo", analysis.type === "rest_day" ? 55 : 75, "g"],
      ["huevos", 2, "unidades"],
      ["atun al natural o pollo", 90 * proteinScale, "g"],
      ["verduras suaves", 200, "g"],
      ["aceite de oliva", 12, "g"]
    ]);
  const snack = highDay
    ? quantities([
      ["pan sin gluten", 60 * carbScale, "g"],
      ["crema de cacahuete", 12, "g"],
      ["mermelada o miel", 25 * carbScale, "g"],
      ["bebida isotónica si entrenas >75 min", 500, "ml"]
    ])
    : quantities([
      ["fruta", 1, "pieza"],
      ["yogur sin lactosa o vegetal alto en proteina", 170, "g"],
      ["tortitas de maiz", 2, "unidades"],
      ["semillas o nueces", 10, "g"]
    ]);
  const dinner = longDay
    ? quantities([
      ["pasta sin gluten en crudo", 90 * carbScale, "g"],
      ["pavo, pollo o tempeh", 140 * proteinScale, "g"],
      ["tomate natural triturado sin ajo", 120, "g"],
      ["verdura cocinada baja en fibra", 150, "g"],
      ["aceite de oliva", 12, "g"],
      ["fruta madura", 1, "pieza"]
    ])
    : quantities([
      ["salmon o merluza", 140 * proteinScale, "g"],
      ["huevos si eliges tortilla en vez de pescado", 2, "unidades"],
      ["patata cocida o arroz", analysis.type === "rest_day" ? 180 : 260, "g cocido"],
      ["ensalada sencilla sin ajo", 120, "g"],
      ["aceite de oliva", 10, "g"],
      ["fruta", 1, "pieza"]
    ]);

  return [
    { title: "Desayuno", text: breakfast },
    { title: "Comida", text: lunch },
    { title: "Merienda / pre-entreno", text: snack },
    { title: "Cena", text: dinner },
    { title: "Regla del dia", text: `${targets.carbTiming} Todo el plan evita lactosa, gluten y ajo.` }
  ];
}

function quantities(items) {
  return items
    .map(([name, amount, unit]) => {
      const formatted = Number.isFinite(amount) ? roundAmount(amount) : amount;
      return `${formatted} ${unit} ${name}`;
    })
    .join(" + ");
}

function roundAmount(value) {
  if (value < 3) return Number(value.toFixed(1)).toString();
  return String(Math.round(value / 5) * 5);
}

function renderAnalysis(date, daySessions, tomorrowSessions, analysis) {
  const sessionsHtml = daySessions.length
    ? daySessions.map((session) => `<div class="note"><strong>${label(session.sport)} · ${label(session.session_type)}</strong><br>${session.start_time || "--:--"} · ${session.duration_min} min · ${label(session.environment)} · ${label(session.intensity)}<br>${escapeHtml(session.description || "")}</div>`).join("")
    : `<div class="note">No hay entrenos cargados para este dia. Se trata como dia de recuperacion.</div>`;
  const tags = [
    label(analysis.type),
    `${analysis.totalMinutes} min`,
    `${analysis.totalTss} TSS`,
    analysis.tomorrowLong ? "preparar tirada larga mañana" : ""
  ].filter(Boolean).map((text, index) => `<span class="tag ${index === 3 ? "warn" : ""}">${text}</span>`).join("");
  return `<div class="tag-row">${tags}</div>${sessionsHtml}`;
}

function renderTargets(targets) {
  return `
    <div class="metric-grid">
      <div class="metric"><strong>${targets.kcal}</strong><span>kcal aprox.</span></div>
      <div class="metric"><strong>${targets.carbsG} g</strong><span>carbohidratos</span></div>
      <div class="metric"><strong>${targets.proteinG} g</strong><span>proteina</span></div>
      <div class="metric"><strong>${targets.fatG} g</strong><span>grasas</span></div>
    </div>
    <div class="note">Agua objetivo: ${targets.hydrationL} L. Sodio en entreno: ${targets.sodiumMgTraining}.</div>
    <div class="note">${targets.carbTiming}</div>
  `;
}

function renderMeal(meal) {
  return `<div class="meal"><h3>${meal.title}</h3><p>${meal.text}</p></div>`;
}

function renderFueling(daySessions, analysis) {
  const endurance = daySessions.filter((session) => ["bike", "run", "swim"].includes(session.sport));
  if (!endurance.length) {
    return `<div class="note">Sin sesion larga de resistencia hoy. Mantener proteina repartida y buena recuperacion.</div>`;
  }
  const longest = endurance.reduce((winner, session) => Number(session.duration_min) > Number(winner.duration_min) ? session : winner, endurance[0]);
  const carbs = Number(longest.duration_min) >= 150 ? "60-90 g/h en bici; 40-70 g/h corriendo" : Number(longest.duration_min) >= 75 ? "30-60 g/h si hay intensidad o hambre" : "agua; carbohidrato opcional";
  return `
    <div class="note"><strong>${label(longest.sport)} ${longest.duration_min} min</strong><br>${carbs}.</div>
    <div class="note">Practicar productos sin gluten, sin lactosa y sin ajo. Para salidas outdoor largas: 400-800 ml/h y 400-900 mg sodio/h segun calor y sudoracion.</div>
    <div class="note">En bloques Ironman, no estrenar geles ni bebidas en la semana de carrera; probar tolerancia en entrenos A.</div>
  `;
}

function renderWeekPlan(profile, startDateText) {
  const startDate = new Date(`${startDateText}T00:00:00`);
  return Array.from({ length: 7 }, (_, offset) => {
    const date = toIsoDate(addDays(startDate, offset));
    const nextDate = toIsoDate(addDays(startDate, offset + 1));
    const daySessions = sessions.filter((session) => session.date === date);
    const tomorrowSessions = sessions.filter((session) => session.date === nextDate);
    const analysis = classifyDay(daySessions, tomorrowSessions);
    const targets = calculateNutrition(profile, daySessions, analysis);
    const meals = buildMeals(profile, daySessions, analysis, targets);
    return renderWeekDay(date, offset, daySessions, analysis, targets, meals);
  }).join("");
}

function renderWeekDay(date, offset, daySessions, analysis, targets, meals) {
  const sessionSummary = daySessions.length
    ? daySessions.map((session) => `
      <div class="mini-session">
        <strong>${session.start_time || "--:--"} · ${label(session.sport)}</strong><br>
        ${label(session.session_type)} · ${session.duration_min} min · ${label(session.intensity)}
      </div>
    `).join("")
    : `<div class="mini-session"><strong>Descanso</strong><br>Sin entrenos cargados.</div>`;
  const mealSummary = meals.slice(0, 4).map((meal) => `
    <div class="mini-meal"><strong>${meal.title}</strong><br>${meal.text}</div>
  `).join("");
  return `
    <article class="day-card ${offset === 0 ? "today" : ""}">
      <div>
        <h3>${relativeDayLabel(date, offset)}</h3>
        <div class="day-date">${formatShortDate(date)} · ${label(analysis.type)}</div>
      </div>
      <div class="day-sessions">${sessionSummary}</div>
      <div class="mini-targets">${targets.kcal} kcal · ${targets.carbsG} g CH · ${targets.proteinG} g P · ${targets.fatG} g G</div>
      <div class="day-meals">${mealSummary}</div>
    </article>
  `;
}

function generateTriathlonPlan(profile, startDate, days) {
  const templates = [
    [
      { start_time: "07:00", sport: "swim", environment: "pool", session_type: "endurance", duration_min: 60, intensity: "medium", planned_tss: 55, description: "Tecnica + aerobico continuo" },
      { start_time: "19:00", sport: "strength", environment: "gym", session_type: "strength", duration_min: 45, intensity: "medium", planned_tss: 40, description: "Fuerza general: pierna, core y estabilidad" }
    ],
    [
      { start_time: "18:30", sport: "bike", environment: "outdoor", session_type: "intervals", duration_min: 90, intensity: "high", planned_tss: 95, description: "Bloques Z4 en bici; calidad de fuerza-resistencia" }
    ],
    [
      { start_time: "07:30", sport: "run", environment: "outdoor", session_type: "recovery", duration_min: 45, intensity: "low", planned_tss: 35, description: "Rodaje suave + movilidad" },
      { start_time: "19:00", sport: "swim", environment: "pool", session_type: "intervals", duration_min: 70, intensity: "high", planned_tss: 70, description: "Series 20x100 ritmo controlado" }
    ],
    [
      { start_time: "18:30", sport: "run", environment: "outdoor", session_type: "tempo", duration_min: 70, intensity: "high", planned_tss: 80, description: "Tempo progresivo con bloques a ritmo medio Ironman" }
    ],
    [
      { start_time: "07:00", sport: "bike", environment: "indoor", session_type: "tempo", duration_min: 75, intensity: "medium", planned_tss: 70, description: "Sweet spot / cadencia" },
      { start_time: "18:30", sport: "strength", environment: "gym", session_type: "strength", duration_min: 40, intensity: "medium", planned_tss: 35, description: "Fuerza tren superior + core" }
    ],
    [
      { start_time: "09:00", sport: "bike", environment: "outdoor", session_type: "long", duration_min: 210, intensity: "medium", planned_tss: 165, description: "Salida larga; practicar nutricion Ironman" },
      { start_time: "12:45", sport: "run", environment: "outdoor", session_type: "brick", duration_min: 25, intensity: "medium", planned_tss: 25, description: "Transicion corta tras bici" }
    ],
    [
      { start_time: "09:30", sport: "run", environment: "outdoor", session_type: "long", duration_min: 95, intensity: "medium", planned_tss: 105, description: "Tirada larga aerobica" }
    ]
  ];
  const raceDate = new Date(`${profile.raceDate || "2026-10-18"}T00:00:00`);
  const plan = [];
  for (let index = 0; index < days; index += 1) {
    const date = addDays(startDate, index);
    const daysToRace = Math.ceil((raceDate - date) / 86400000);
    const weekNumber = Math.floor(index / 7);
    const recoveryWeek = weekNumber % 4 === 3;
    const buildScale = 1 + Math.min(weekNumber, 8) * 0.045;
    const phaseScale = daysToRace < 21 ? 0.7 : daysToRace < 42 ? 0.9 : daysToRace < 84 ? 1.12 : 1;
    const weekScale = recoveryWeek ? buildScale * 0.82 : buildScale * phaseScale;
    const dayTemplate = templates[index % templates.length];
    dayTemplate.forEach((template) => {
      plan.push({
        date: toIsoDate(date),
        distance: "",
        distance_unit: ["swim"].includes(template.sport) ? "m" : "km",
        elevation_m: "",
        strength_focus: template.sport === "strength" ? "full_body" : "",
        priority: ["long", "intervals", "brick"].includes(template.session_type) ? "A" : "B",
        ...template,
        duration_min: Math.round(template.duration_min * weekScale),
        planned_tss: Math.round(template.planned_tss * weekScale)
      });
    });
  }
  return plan;
}

function toCsv(rows) {
  const headers = ["date", "start_time", "sport", "environment", "session_type", "duration_min", "intensity", "planned_tss", "distance", "distance_unit", "elevation_m", "strength_focus", "priority", "description"];
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(","))].join("\n");
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines.shift());
  return lines.map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = ["duration_min", "planned_tss"].includes(header) ? Number(values[index] || 0) : values[index] || "";
      return row;
    }, {});
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function csvEscape(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toIsoDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function label(value) {
  const labels = {
    swim: "Natacion",
    bike: "Bici",
    run: "Carrera",
    strength: "Fuerza",
    mobility: "Movilidad",
    rest: "Descanso",
    pool: "Piscina",
    open_water: "Aguas abiertas",
    outdoor: "Outdoor",
    indoor: "Indoor",
    gym: "Gimnasio",
    home: "Casa",
    endurance: "Aerobico",
    intervals: "Series",
    tempo: "Tempo",
    long: "Largo",
    recovery: "Recuperacion",
    brick: "Brick",
    low: "Baja",
    medium: "Media",
    high: "Alta",
    race: "Carrera",
    rest_day: "Dia descanso",
    easy_or_moderate_day: "Dia moderado",
    strength_day: "Dia fuerza",
    high_intensity_day: "Dia intenso",
    double_session_day: "Doble sesion",
    long_endurance_day: "Fondo largo",
    brick_day: "Dia brick",
    long_brick_day: "Brick largo"
  };
  return labels[value] || value;
}

function weekdayLabel(dateText) {
  const date = new Date(`${dateText}T00:00:00`);
  const formatter = new Intl.DateTimeFormat("es-ES", { weekday: "long" });
  const text = formatter.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function relativeDayLabel(dateText, offset) {
  if (offset === 0) return "Hoy";
  if (offset === 1) return `Mañana ${weekdayLabel(dateText).toLowerCase()}`;
  return weekdayLabel(dateText);
}

function formatShortDate(dateText) {
  const date = new Date(`${dateText}T00:00:00`);
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

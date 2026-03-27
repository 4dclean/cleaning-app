const STORAGE_KEY = "cleaning-app-rules-v1";
const RECORDS_KEY = "cleaning-app-records-v1";
const SHEET_URL_KEY = "cleaning-app-sheet-url-v1";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const BUILDINGS = ["백산빌딩", "효성빌딩"];

const defaultSeed = {
  defaultRules: [
    {
      id: crypto.randomUUID(),
      building: "백산빌딩",
      weekday: "월",
      tasks: "현관 바닥 청소\n화장실 소모품 보충\n1층 복도 정리",
    },
    {
      id: crypto.randomUUID(),
      building: "효성빌딩",
      weekday: "월",
      tasks: "복도 바닥 청소\n계단 손잡이 닦기\n쓰레기 분리수거",
    },
  ],
  monthlyRules: [
    {
      id: crypto.randomUUID(),
      building: "백산빌딩",
      weekOrder: "첫째",
      weekday: "토",
      tasks: "4층 사무실 청소",
    },
  ],
  eventRules: [
    {
      id: crypto.randomUUID(),
      building: "백산빌딩",
      date: toDateOnly(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      tasks: "옥상 청소",
    },
  ],
};

const state = {
  rules: loadRules(),
  checklist: [],
  checklistSource: "",
};

const workDateTime = document.getElementById("workDateTime");
const buildingSelect = document.getElementById("buildingSelect");
const sourceText = document.getElementById("sourceText");
const checklistItems = document.getElementById("checklistItems");
const resultBox = document.getElementById("resultBox");
const sheetWebhookUrl = document.getElementById("sheetWebhookUrl");
const sheetStatus = document.getElementById("sheetStatus");

const defaultRulesEl = document.getElementById("defaultRules");
const monthlyRulesEl = document.getElementById("monthlyRules");
const eventRulesEl = document.getElementById("eventRules");
const extraPhotosEl = document.getElementById("extraPhotos");

bootstrap();

function bootstrap() {
  workDateTime.value = toDateTimeLocal(new Date());
  sheetWebhookUrl.value = localStorage.getItem(SHEET_URL_KEY) || "";
  updateSheetStatusText();
  renderRules();
  renderChecklist();
  bindPhotoCaptureButtons(document);
}

function updateSheetStatusText(text) {
  if (text) {
    sheetStatus.value = text;
    return;
  }
  sheetStatus.value = sheetWebhookUrl.value.trim() ? "연결주소 저장됨" : "미연결";
}

function loadRules() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return structuredClone(defaultSeed);
  }
  try {
    return JSON.parse(raw);
  } catch {
    return structuredClone(defaultSeed);
  }
}

function saveRules() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.rules));
}

function renderRules() {
  renderDefaultRules();
  renderMonthlyRules();
  renderEventRules();
}

function renderDefaultRules() {
  defaultRulesEl.innerHTML = "";
  state.rules.defaultRules.forEach((rule) => {
    const row = document.createElement("div");
    row.className = "rule-row";
    row.innerHTML = `
      <select data-k="building">${options(BUILDINGS, rule.building)}</select>
      <select data-k="weekday">${options(WEEKDAYS, rule.weekday)}</select>
      <textarea data-k="tasks" rows="2" placeholder="한 줄에 하나씩">${escapeHtml(rule.tasks)}</textarea>
      <button type="button" data-act="remove">삭제</button>
    `;
    bindRuleRow(row, rule, "defaultRules");
    defaultRulesEl.appendChild(row);
  });
}

function renderMonthlyRules() {
  monthlyRulesEl.innerHTML = "";
  const orders = ["첫째", "둘째", "셋째", "넷째", "마지막"];
  state.rules.monthlyRules.forEach((rule) => {
    const row = document.createElement("div");
    row.className = "rule-row";
    row.innerHTML = `
      <select data-k="building">${options(BUILDINGS, rule.building)}</select>
      <select data-k="weekOrder">${options(orders, rule.weekOrder)}</select>
      <select data-k="weekday">${options(WEEKDAYS, rule.weekday)}</select>
      <textarea data-k="tasks" rows="2" placeholder="한 줄에 하나씩">${escapeHtml(rule.tasks)}</textarea>
      <button type="button" data-act="remove">삭제</button>
    `;
    bindRuleRow(row, rule, "monthlyRules");
    monthlyRulesEl.appendChild(row);
  });
}

function renderEventRules() {
  eventRulesEl.innerHTML = "";
  state.rules.eventRules.forEach((rule) => {
    const row = document.createElement("div");
    row.className = "rule-row";
    row.innerHTML = `
      <select data-k="building">${options(BUILDINGS, rule.building)}</select>
      <input data-k="date" type="date" value="${rule.date}" />
      <textarea data-k="tasks" rows="2" placeholder="한 줄에 하나씩">${escapeHtml(rule.tasks)}</textarea>
      <button type="button" data-act="remove">삭제</button>
    `;
    bindRuleRow(row, rule, "eventRules");
    eventRulesEl.appendChild(row);
  });
}

function bindRuleRow(row, rule, bucketName) {
  row.querySelectorAll("[data-k]").forEach((el) => {
    el.addEventListener("change", () => {
      rule[el.dataset.k] = el.value;
    });
  });
  row.querySelector('[data-act="remove"]').addEventListener("click", () => {
    state.rules[bucketName] = state.rules[bucketName].filter((x) => x.id !== rule.id);
    renderRules();
  });
}

function renderChecklist() {
  checklistItems.innerHTML = "";
  state.checklist.forEach((item, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <label>
        <input type="checkbox" data-index="${i}" ${item.checked ? "checked" : ""} />
        ${escapeHtml(item.text)}
      </label>
    `;
    checklistItems.appendChild(li);
  });

  checklistItems.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", () => {
      const idx = Number(cb.dataset.index);
      state.checklist[idx].checked = cb.checked;
    });
  });
}

function computeChecklist() {
  const dt = new Date(workDateTime.value);
  if (Number.isNaN(dt.getTime())) {
    alert("작업 일시를 먼저 확인해주세요.");
    return;
  }
  const building = buildingSelect.value;
  const dateOnly = toDateOnly(dt);
  const weekday = WEEKDAYS[dt.getDay()];

  const eventHit = state.rules.eventRules.find(
    (r) => r.building === building && r.date === dateOnly
  );
  if (eventHit) {
    applyChecklistFromTasks(eventHit.tasks, `특별 이벤트 규칙(${building}, ${dateOnly})`);
    return;
  }

  const monthlyHit = state.rules.monthlyRules.find((r) => {
    if (r.building !== building || r.weekday !== weekday) {
      return false;
    }
    return isMatchingWeekOrder(dt, r.weekOrder);
  });
  if (monthlyHit) {
    applyChecklistFromTasks(
      monthlyHit.tasks,
      `월정기 규칙(${building}, ${monthlyHit.weekOrder} ${weekday})`
    );
    return;
  }

  const defaultHit = state.rules.defaultRules.find(
    (r) => r.building === building && r.weekday === weekday
  );
  if (defaultHit) {
    applyChecklistFromTasks(defaultHit.tasks, `기본 규칙(${building}, ${weekday})`);
    return;
  }

  // 테스트 단계에서는 요일 규칙이 없더라도 건물 기본 규칙 하나를 대신 사용합니다.
  const buildingFallback = state.rules.defaultRules.find((r) => r.building === building);
  if (buildingFallback) {
    applyChecklistFromTasks(
      buildingFallback.tasks,
      `기본 규칙 대체(${building}, 등록된 요일: ${buildingFallback.weekday})`
    );
    return;
  }

  state.checklist = [];
  state.checklistSource = "일치하는 규칙이 없어서 빈 체크리스트가 표시됩니다.";
  sourceText.textContent = state.checklistSource;
  renderChecklist();
}

function applyChecklistFromTasks(tasksText, source) {
  state.checklist = tasksText
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((text) => ({ text, checked: false }));
  state.checklistSource = source;
  sourceText.textContent = `적용 규칙: ${source}`;
  renderChecklist();
}

function isMatchingWeekOrder(date, weekOrder) {
  const day = date.getDate();
  if (weekOrder === "첫째") return day >= 1 && day <= 7;
  if (weekOrder === "둘째") return day >= 8 && day <= 14;
  if (weekOrder === "셋째") return day >= 15 && day <= 21;
  if (weekOrder === "넷째") return day >= 22 && day <= 28;
  if (weekOrder === "마지막") {
    const nextWeek = new Date(date);
    nextWeek.setDate(day + 7);
    return nextWeek.getMonth() !== date.getMonth();
  }
  return false;
}

function addExtraPhotoRow() {
  const row = document.createElement("div");
  row.className = "extra-row";
  const inputId = `extraPhoto_${crypto.randomUUID()}`;
  row.innerHTML = `
    <input type="text" placeholder="사진 이름(예: 옥상 배수구)" />
    <input id="${inputId}" class="hidden-file" type="file" accept="image/*" capture="environment" />
    <button class="capture-btn" type="button" data-target="${inputId}">사진 촬영</button>
    <span class="photo-status" data-status-for="${inputId}">미촬영</span>
    <button class="delete-btn" type="button">삭제</button>
  `;
  bindPhotoCaptureButtons(row);
  row.querySelector(".delete-btn").addEventListener("click", () => row.remove());
  extraPhotosEl.appendChild(row);
}

function bindPhotoCaptureButtons(scope) {
  scope.querySelectorAll(".capture-btn").forEach((btn) => {
    if (btn.dataset.bound === "true") return;
    btn.dataset.bound = "true";
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (input) input.click();
    });
  });

  scope.querySelectorAll('input[type="file"]').forEach((input) => {
    if (input.dataset.bound === "true") return;
    input.dataset.bound = "true";
    input.addEventListener("change", () => {
      const status = document.querySelector(`[data-status-for="${input.id}"]`);
      if (!status) return;
      status.textContent = input.files?.[0] ? "촬영완료" : "미촬영";
    });
  });
}

function buildPhotoRecords() {
  const dt = new Date(workDateTime.value);
  const date = toDateOnly(dt);
  const ym = date.slice(0, 7);
  const building = buildingSelect.value;
  const folderBase = `${building}/${ym}`;

  const fixed = [
    { id: "photoToiletBefore", label: "화장실_전" },
    { id: "photoToiletAfter", label: "화장실_후" },
    { id: "photoHallBefore", label: "1층복도_전" },
    { id: "photoHallAfter", label: "1층복도_후" },
  ];

  const fixedRecords = fixed
    .map((x) => {
      const input = document.getElementById(x.id);
      if (!input.files?.[0]) {
        return null;
      }
      const fileName = `${date}_${x.label}.jpg`;
      return {
        type: "고정",
        title: x.label,
        fileName,
        path: `${folderBase}/${fileName}`,
      };
    })
    .filter(Boolean);

  const extraRecords = [...extraPhotosEl.querySelectorAll(".extra-row")]
    .map((row) => {
      const name = row.querySelector('input[type="text"]').value.trim();
      const fileInput = row.querySelector('input[type="file"]');
      if (!name || !fileInput.files?.[0]) {
        return null;
      }
      const safe = sanitizeName(name);
      const fileName = `${date}_${safe}.jpg`;
      return {
        type: "추가",
        title: name,
        fileName,
        path: `${folderBase}/${fileName}`,
      };
    })
    .filter(Boolean);

  return [...fixedRecords, ...extraRecords];
}

async function saveTodayRecord() {
  const dt = new Date(workDateTime.value);
  if (Number.isNaN(dt.getTime())) {
    alert("작업 일시를 먼저 확인해주세요.");
    return;
  }
  const todayRecord = {
    savedAt: new Date().toISOString(),
    workDateTime: dt.toISOString(),
    building: buildingSelect.value,
    appliedRuleSource: state.checklistSource,
    checklist: state.checklist,
    photos: buildPhotoRecords(),
  };

  const records = loadRecords();
  records.push(todayRecord);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));

  const url = sheetWebhookUrl.value.trim();
  let sheetSendResult = "구글시트 미전송(연동주소 없음)";

  if (url) {
    updateSheetStatusText("전송 중...");
    const ok = await sendToGoogleSheet(url, todayRecord);
    if (ok) {
      sheetSendResult = "구글시트 전송 요청 완료";
      updateSheetStatusText("전송 완료(요청)");
    } else {
      sheetSendResult = "구글시트 전송 실패(주소/권한 확인 필요)";
      updateSheetStatusText("전송 실패");
    }
  }

  resultBox.textContent = JSON.stringify(
    { message: sheetSendResult, record: todayRecord },
    null,
    2
  );
}

function loadRecords() {
  const raw = localStorage.getItem(RECORDS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function options(items, selected) {
  return items
    .map((x) => `<option value="${x}" ${x === selected ? "selected" : ""}>${x}</option>`)
    .join("");
}

function toDateOnly(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateTimeLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function sanitizeName(text) {
  return text.replace(/[^\w가-힣-]/g, "_");
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function saveSheetUrl() {
  const url = sheetWebhookUrl.value.trim();
  if (!url) {
    localStorage.removeItem(SHEET_URL_KEY);
    updateSheetStatusText("미연결");
    alert("연동 주소를 비웠습니다.");
    return;
  }
  localStorage.setItem(SHEET_URL_KEY, url);
  updateSheetStatusText("연결주소 저장됨");
  alert("연동 주소가 저장되었습니다.");
}

async function sendToGoogleSheet(url, payload) {
  try {
    // 브라우저 보안 때문에 JSON 전송이 막히는 경우가 있어,
    // 가장 단순한 폼 전송(application/x-www-form-urlencoded)으로 보냅니다.
    const form = new URLSearchParams();
    form.set("payload", JSON.stringify(payload));

    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: form.toString(),
    });
    return true;
  } catch {
    return false;
  }
}

document.getElementById("loadChecklistBtn").addEventListener("click", computeChecklist);
document.getElementById("checkAllBtn").addEventListener("click", () => {
  state.checklist.forEach((x) => {
    x.checked = true;
  });
  renderChecklist();
});
document.getElementById("uncheckAllBtn").addEventListener("click", () => {
  state.checklist.forEach((x) => {
    x.checked = false;
  });
  renderChecklist();
});
document.getElementById("saveTodayRecordBtn").addEventListener("click", saveTodayRecord);
document.getElementById("saveSheetUrlBtn").addEventListener("click", saveSheetUrl);
document.getElementById("addExtraPhotoBtn").addEventListener("click", addExtraPhotoRow);

document.getElementById("addDefaultRuleBtn").addEventListener("click", () => {
  state.rules.defaultRules.push({
    id: crypto.randomUUID(),
    building: "백산빌딩",
    weekday: "월",
    tasks: "",
  });
  renderDefaultRules();
});

document.getElementById("addMonthlyRuleBtn").addEventListener("click", () => {
  state.rules.monthlyRules.push({
    id: crypto.randomUUID(),
    building: "백산빌딩",
    weekOrder: "첫째",
    weekday: "토",
    tasks: "",
  });
  renderMonthlyRules();
});

document.getElementById("addEventRuleBtn").addEventListener("click", () => {
  state.rules.eventRules.push({
    id: crypto.randomUUID(),
    building: "백산빌딩",
    date: toDateOnly(new Date()),
    tasks: "",
  });
  renderEventRules();
});

document.getElementById("saveRulesBtn").addEventListener("click", () => {
  saveRules();
  alert("규칙이 저장되었습니다.");
});

document.getElementById("resetRulesBtn").addEventListener("click", () => {
  state.rules = structuredClone(defaultSeed);
  saveRules();
  renderRules();
  alert("규칙을 초기값으로 되돌렸습니다.");
});

/**
 * 구글 앱스 스크립트 웹앱 코드
 * 1) 새 Apps Script 프로젝트 생성
 * 2) 이 코드 전체 붙여넣기
 * 3) Deploy > New deployment > Web app
 * 4) Execute as: Me, Access: Anyone
 * 5) 생성된 /exec URL을 웹앱의 "구글시트 웹앱 주소"에 붙여넣기
 */

const SHEET_NAME = "청소기록";

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, message: "청소기록 웹앱이 정상입니다. POST로 데이터를 보내주세요." })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet_(ss, SHEET_NAME);
    ensureHeader_(sheet);

    const payload = parsePayload_(e);
    const rows = buildRows_(payload);

    if (rows.length > 0) {
      sheet
        .getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length)
        .setValues(rows);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ ok: true, count: rows.length })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(error) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function parsePayload_(e) {
  const raw = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : "";
  if (!raw) return {};

  // 1) JSON이 바로 온 경우
  try {
    return JSON.parse(raw);
  } catch (ignore) {}

  // 2) application/x-www-form-urlencoded 로 온 경우: payload=...
  const params = raw.split("&").reduce((acc, part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return acc;
    const k = decodeURIComponent(part.slice(0, idx).replace(/\+/g, " "));
    const v = decodeURIComponent(part.slice(idx + 1).replace(/\+/g, " "));
    acc[k] = v;
    return acc;
  }, {});

  if (params.payload) {
    try {
      return JSON.parse(params.payload);
    } catch (ignore) {}
  }

  return {};
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    "저장시각",
    "작업일시",
    "건물",
    "적용규칙",
    "체크항목",
    "체크여부",
    "사진유형",
    "사진제목",
    "파일명",
    "파일경로",
  ]);
}

function buildRows_(payload) {
  const savedAt = payload.savedAt || "";
  const workDateTime = payload.workDateTime || "";
  const building = payload.building || "";
  const rule = payload.appliedRuleSource || "";
  const checklist = Array.isArray(payload.checklist) ? payload.checklist : [];
  const photos = Array.isArray(payload.photos) ? payload.photos : [];

  if (checklist.length === 0 && photos.length === 0) {
    return [[savedAt, workDateTime, building, rule, "", "", "", "", "", ""]];
  }

  const maxLen = Math.max(checklist.length, photos.length);
  const rows = [];

  for (let i = 0; i < maxLen; i += 1) {
    const c = checklist[i] || {};
    const p = photos[i] || {};
    rows.push([
      savedAt,
      workDateTime,
      building,
      rule,
      c.text || "",
      typeof c.checked === "boolean" ? (c.checked ? "Y" : "N") : "",
      p.type || "",
      p.title || "",
      p.fileName || "",
      p.path || "",
    ]);
  }

  return rows;
}

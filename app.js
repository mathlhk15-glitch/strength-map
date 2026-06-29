/**
 * 우리 반 강점지도 - Frontend Logic
 */

// ===================== 전역 상태 =====================
const state = {
  classNo: null,
  number: null,
  code: null,
  name: null,
  roster: [],          // 같은 반 친구 전체 (자기 제외)
  writtenTargets: [],  // 작성 완료된 대상 번호 목록 (문자열)
  currentTarget: null, // 현재 작성 중인 대상 {number, name, career}
  selectedStrengths: [],
  selectedReason: null,
  pendingSaveData: null // 저장 실패 시 재시도용
};

// ===================== 화면 전환 =====================
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(function (el) {
    el.classList.remove("active");
  });
  document.getElementById(id).classList.add("active");
}

function showLoading(text) {
  document.getElementById("loading-text").textContent = text || "처리 중...";
  document.getElementById("loading-overlay").classList.remove("hidden");
}
function hideLoading() {
  document.getElementById("loading-overlay").classList.add("hidden");
}

function showErrorModal(message, retryFn) {
  document.getElementById("error-modal-text").textContent = message;
  document.getElementById("error-modal").classList.remove("hidden");
  document.getElementById("btn-retry").classList.remove("hidden");
  state.pendingSaveData = retryFn || null;
}

// 완료한 친구 카드 클릭 시 안내 (재시도 버튼 없음)
function showAlreadyDoneModal() {
  document.getElementById("error-modal-text").textContent = "이미 작성한 친구입니다. 수정이 필요하면 선생님께 말하세요.";
  document.getElementById("error-modal").classList.remove("hidden");
  document.getElementById("btn-retry").classList.add("hidden");
  state.pendingSaveData = null;
}

function hideErrorModal() {
  document.getElementById("error-modal").classList.add("hidden");
  document.getElementById("btn-retry").classList.remove("hidden"); // 다음 사용을 위해 복원
}

// ===================== HTML 안전 처리 =====================
function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===================== 금칙어 필터 =====================
function containsBannedWord(text) {
  if (!text) return false;
  return BANNED_WORDS.some(function (w) { return text.includes(w); });
}

// 의미 없는 한마디 차단 (자음/모음/구두점만 반복 등)
function isMeaninglessMessage(text) {
  const onlyConsonantsVowels = /^[ㄱ-ㅎㅏ-ㅣ\s.…!?~]+$/;
  const tooRepetitive = /^(.)\1{2,}$/;
  return onlyConsonantsVowels.test(text) || tooRepetitive.test(text);
}

// ===================== API 호출 =====================
// GAS doGet 호출 (조회)
function apiGet(params) {
  const query = new URLSearchParams(params).toString();
  return fetch(GAS_URL + "?" + query)
    .then(function (res) { return res.json(); });
}

// GAS doPost 호출 (저장) - text/plain으로 보내 CORS 프리플라이트 회피
function apiPost(body) {
  return fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  }).then(function (res) { return res.json(); });
}

// ===================== 화면 1: 로그인 =====================
function initLoginScreen() {
  const classSelect = document.getElementById("select-class");
  const numberSelect = document.getElementById("select-number");

  classSelect.innerHTML = '<option value="">반 선택</option>' +
    CLASS_LIST.map(function (c) { return '<option value="' + c + '">' + c + '반</option>'; }).join("");

  numberSelect.innerHTML = '<option value="">번호 선택</option>' +
    NUMBER_LIST.map(function (n) { return '<option value="' + n + '">' + n + '번</option>'; }).join("");

  document.getElementById("btn-login").addEventListener("click", handleLogin);
}

function handleLogin() {
  const classNo = document.getElementById("select-class").value;
  const number = document.getElementById("select-number").value;
  const code = document.getElementById("input-code").value.trim();
  const errorEl = document.getElementById("login-error");
  errorEl.classList.add("hidden");

  if (!classNo || !number || !code) {
    errorEl.textContent = "반, 번호, 개인 코드를 모두 입력해 주세요.";
    errorEl.classList.remove("hidden");
    return;
  }

  showLoading("확인 중...");
  apiGet({ action: "login", classNo: classNo, number: number, code: code })
    .then(function (res) {
      hideLoading();
      if (!res.ok) {
        errorEl.textContent = res.message || "로그인에 실패했습니다.";
        errorEl.classList.remove("hidden");
        return;
      }
      state.classNo = res.data.classNo;
      state.number = res.data.number;
      state.code = code;
      state.name = res.data.name;
      loadRosterAndProgress();
    })
    .catch(function () {
      hideLoading();
      errorEl.textContent = "서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.";
      errorEl.classList.remove("hidden");
    });
}

// 명단 + 진행상황을 함께 불러와 대시보드 진입
function loadRosterAndProgress() {
  showLoading("불러오는 중...");
  Promise.all([
    apiGet({ action: "getRoster", classNo: state.classNo, number: state.number, code: state.code }),
    apiGet({ action: "getProgress", classNo: state.classNo, number: state.number, code: state.code })
  ]).then(function (results) {
    hideLoading();
    const rosterRes = results[0];
    const progressRes = results[1];

    if (!rosterRes.ok || !progressRes.ok) {
      showErrorModal(rosterRes.message || progressRes.message || "데이터를 불러오지 못했습니다.", loadRosterAndProgress);
      return;
    }

    state.roster = rosterRes.data.filter(function (s) { return s.number !== state.number; });
    state.writtenTargets = progressRes.data.writtenTargets;

    if (progressRes.data.submitted) {
      showScreen("screen-done");
      return;
    }

    renderDashboard();
    showScreen("screen-dashboard");
  }).catch(function () {
    hideLoading();
    showErrorModal("네트워크 오류가 발생했습니다.", loadRosterAndProgress);
  });
}

// ===================== 화면 2: 대시보드 =====================
function renderDashboard() {
  document.getElementById("dash-class-number").textContent = state.classNo + "반 " + state.number + "번";
  document.getElementById("dash-name").textContent = state.name;

  const total = state.roster.length;
  const done = state.writtenTargets.length;

  document.getElementById("progress-current").textContent = done;
  document.getElementById("progress-total").textContent = total;
  document.getElementById("progress-fill").style.width = (total > 0 ? (done / total * 100) : 0) + "%";

  const grid = document.getElementById("friend-grid");
  grid.innerHTML = state.roster.map(function (friend) {
    const isDone = state.writtenTargets.includes(friend.number);
    return '<div class="friend-card ' + (isDone ? "done" : "") + '" data-number="' + escapeHTML(friend.number) + '" data-done="' + isDone + '">' +
      '<div class="f-number">' + escapeHTML(friend.number) + '번</div>' +
      '<div class="f-name">' + escapeHTML(friend.name) + '</div>' +
      '</div>';
  }).join("");

  grid.querySelectorAll(".friend-card").forEach(function (card) {
    card.addEventListener("click", function () {
      const isDone = card.getAttribute("data-done") === "true";
      const num = card.getAttribute("data-number");

      if (isDone) {
        showAlreadyDoneModal();
        return;
      }

      const friend = state.roster.find(function (f) { return f.number === num; });
      openWriteScreen(friend);
    });
  });

  const submitBtn = document.getElementById("btn-final-submit");
  submitBtn.disabled = !(done >= total && total > 0);
}

// ===================== 화면 3: 작성 화면 =====================
function openWriteScreen(friend) {
  state.currentTarget = friend;
  state.selectedStrengths = [];
  state.selectedReason = null;

  document.getElementById("write-target-number").textContent = friend.number + "번";
  document.getElementById("write-target-name").textContent = friend.name;
  document.getElementById("write-target-career").textContent = friend.career ? "관심진로: " + friend.career : "";

  renderStrengthOptions();
  renderReasonOptions();

  document.getElementById("other-strength-input").value = "";
  document.getElementById("other-reason-input").value = "";
  document.getElementById("message-input").value = "";
  document.getElementById("message-counter").textContent = "0/60";
  document.getElementById("other-strength-wrap").classList.add("hidden");
  document.getElementById("other-reason-wrap").classList.add("hidden");
  document.getElementById("write-error").classList.add("hidden");

  showScreen("screen-write");
}

function renderStrengthOptions() {
  const wrap = document.getElementById("strength-options");
  const allOptions = STRENGTH_LIST.concat(["기타 직접 입력"]);

  wrap.innerHTML = allOptions.map(function (s) {
    return '<button type="button" class="option-btn" data-value="' + escapeHTML(s) + '">' + escapeHTML(s) + '</button>';
  }).join("");

  wrap.querySelectorAll(".option-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      toggleStrength(btn.getAttribute("data-value"), btn);
    });
  });

  updateStrengthCount();
}

function toggleStrength(value, btn) {
  const idx = state.selectedStrengths.indexOf(value);

  if (idx >= 0) {
    state.selectedStrengths.splice(idx, 1);
    btn.classList.remove("selected");
  } else {
    if (state.selectedStrengths.length >= 2) return; // 2개 제한
    state.selectedStrengths.push(value);
    btn.classList.add("selected");
  }

  // 기타 입력칸 표시 여부
  const otherWrap = document.getElementById("other-strength-wrap");
  if (state.selectedStrengths.includes("기타 직접 입력")) {
    otherWrap.classList.remove("hidden");
  } else {
    otherWrap.classList.add("hidden");
    document.getElementById("other-strength-input").value = "";
  }

  // 2개 다 채워지면 나머지 버튼 비활성화 느낌 주기(선택 안 된 버튼 dim)
  const allBtns = document.querySelectorAll("#strength-options .option-btn");
  const reachedLimit = state.selectedStrengths.length >= 2;
  allBtns.forEach(function (b) {
    const isSelected = b.classList.contains("selected");
    b.disabled = reachedLimit && !isSelected;
  });

  updateStrengthCount();
}

function updateStrengthCount() {
  document.getElementById("strength-count").textContent = state.selectedStrengths.length + "/2";
}

function renderReasonOptions() {
  const wrap = document.getElementById("reason-options");
  const allOptions = REASON_LIST.concat(["기타 직접 입력"]);

  wrap.innerHTML = allOptions.map(function (r) {
    return '<button type="button" class="option-btn" data-value="' + escapeHTML(r) + '">' + escapeHTML(r) + '</button>';
  }).join("");

  wrap.querySelectorAll(".option-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      selectReason(btn.getAttribute("data-value"), btn);
    });
  });

  updateReasonCount();
}

function selectReason(value, btn) {
  const wrap = document.getElementById("reason-options");

  if (state.selectedReason === value) {
    // 같은 걸 다시 누르면 선택 해제
    state.selectedReason = null;
    btn.classList.remove("selected");
  } else {
    state.selectedReason = value;
    wrap.querySelectorAll(".option-btn").forEach(function (b) { b.classList.remove("selected"); });
    btn.classList.add("selected");
  }

  const otherWrap = document.getElementById("other-reason-wrap");
  if (state.selectedReason === "기타 직접 입력") {
    otherWrap.classList.remove("hidden");
  } else {
    otherWrap.classList.add("hidden");
    document.getElementById("other-reason-input").value = "";
  }

  updateReasonCount();
}

function updateReasonCount() {
  document.getElementById("reason-count").textContent = (state.selectedReason ? "1" : "0") + "/1";
}

// 한마디 글자수 표시
function initMessageCounter() {
  const input = document.getElementById("message-input");
  input.addEventListener("input", function () {
    document.getElementById("message-counter").textContent = input.value.length + "/60";
  });
}

// ===================== 작성 내용 검증 + 저장 =====================
function validateAndBuildPayload() {
  const errorEl = document.getElementById("write-error");
  errorEl.classList.add("hidden");

  if (state.selectedStrengths.length !== 2) {
    return { error: "강점을 정확히 2개 선택해 주세요." };
  }
  if (!state.selectedReason) {
    return { error: "이유를 1개 선택해 주세요." };
  }

  let otherStrength = "";
  if (state.selectedStrengths.includes("기타 직접 입력")) {
    otherStrength = document.getElementById("other-strength-input").value.trim();
    if (otherStrength.length < LIMITS.otherStrengthMin || otherStrength.length > LIMITS.otherStrengthMax) {
      return { error: "기타 강점은 " + LIMITS.otherStrengthMin + "~" + LIMITS.otherStrengthMax + "자로 입력해 주세요." };
    }
    if (containsBannedWord(otherStrength)) {
      return { error: "강점 입력에 적절하지 않은 표현이 포함되어 있습니다." };
    }
  }

  let otherReason = "";
  if (state.selectedReason === "기타 직접 입력") {
    otherReason = document.getElementById("other-reason-input").value.trim();
    if (otherReason.length < LIMITS.otherReasonMin || otherReason.length > LIMITS.otherReasonMax) {
      return { error: "기타 이유는 " + LIMITS.otherReasonMin + "~" + LIMITS.otherReasonMax + "자로 입력해 주세요." };
    }
    if (containsBannedWord(otherReason)) {
      return { error: "이유 입력에 적절하지 않은 표현이 포함되어 있습니다." };
    }
  }

  // 한마디: 필수
  const message = document.getElementById("message-input").value.trim();

  if (!message) {
    return { error: "이 친구에게 해주고 싶은 응원의 한마디를 남겨 주세요." };
  }
  if (message.length < LIMITS.messageMin || message.length > LIMITS.messageMax) {
    return { error: "한마디는 " + LIMITS.messageMin + "~" + LIMITS.messageMax + "자로 입력해 주세요." };
  }
  if (containsBannedWord(message)) {
    return { error: "한마디에 적절하지 않은 표현이 포함되어 있습니다." };
  }
  if (isMeaninglessMessage(message)) {
    return { error: "조금 더 진심이 담긴 한마디를 남겨 주세요. (예: ㅇㅇ, ㅎㅎ만으로는 부족해요)" };
  }

  const payload = {
    action: "saveFeedback",
    classNo: state.classNo,
    number: state.number,
    code: state.code,
    targetNumber: state.currentTarget.number,
    strength1: state.selectedStrengths[0],
    strength2: state.selectedStrengths[1],
    reason: state.selectedReason,
    otherStrength: otherStrength,
    otherReason: otherReason,
    message: message
  };

  return { payload: payload };
}

function saveFeedback(nextAction) {
  const result = validateAndBuildPayload();
  if (result.error) {
    const errorEl = document.getElementById("write-error");
    errorEl.textContent = result.error;
    errorEl.classList.remove("hidden");
    return;
  }

  showLoading("저장 중...");
  apiPost(result.payload)
    .then(function (res) {
      hideLoading();
      if (!res.ok) {
        showErrorModal(res.message || "저장에 실패했습니다.", function () { saveFeedback(nextAction); });
        return;
      }

      // 로컬 상태 갱신
      if (!state.writtenTargets.includes(state.currentTarget.number)) {
        state.writtenTargets.push(state.currentTarget.number);
      }

      if (nextAction === "next") {
        goToNextUnwrittenFriend();
      } else {
        renderDashboard();
        showScreen("screen-dashboard");
      }
    })
    .catch(function () {
      hideLoading();
      showErrorModal("네트워크 오류로 저장에 실패했습니다.", function () { saveFeedback(nextAction); });
    });
}

function goToNextUnwrittenFriend() {
  const next = state.roster.find(function (f) {
    return !state.writtenTargets.includes(f.number);
  });

  if (next) {
    openWriteScreen(next);
  } else {
    renderDashboard();
    showScreen("screen-dashboard");
  }
}

// ===================== 화면 4: 최종 제출 =====================
function handleFinalSubmitClick() {
  showScreen("screen-confirm");
}

function handleConfirmSubmit() {
  showLoading("제출 중...");
  apiPost({
    action: "finalSubmit",
    classNo: state.classNo,
    number: state.number,
    code: state.code
  }).then(function (res) {
    hideLoading();
    if (!res.ok) {
      showErrorModal(res.message || "제출에 실패했습니다.", handleConfirmSubmit);
      return;
    }
    showScreen("screen-done");
  }).catch(function () {
    hideLoading();
    showErrorModal("네트워크 오류로 제출에 실패했습니다.", handleConfirmSubmit);
  });
}

// ===================== 이벤트 바인딩 =====================
function bindEvents() {
  document.getElementById("btn-back-dashboard").addEventListener("click", function () {
    renderDashboard();
    showScreen("screen-dashboard");
  });

  document.getElementById("btn-save-next").addEventListener("click", function () {
    saveFeedback("next");
  });

  document.getElementById("btn-save-dashboard").addEventListener("click", function () {
    saveFeedback("dashboard");
  });

  document.getElementById("btn-final-submit").addEventListener("click", handleFinalSubmitClick);
  document.getElementById("btn-confirm-submit").addEventListener("click", handleConfirmSubmit);
  document.getElementById("btn-cancel-submit").addEventListener("click", function () {
    showScreen("screen-dashboard");
  });

  document.getElementById("btn-retry").addEventListener("click", function () {
    hideErrorModal();
    if (typeof state.pendingSaveData === "function") {
      state.pendingSaveData();
    }
  });

  document.getElementById("btn-error-close").addEventListener("click", hideErrorModal);
}

// ===================== 초기화 =====================
document.addEventListener("DOMContentLoaded", function () {
  initLoginScreen();
  initMessageCounter();
  bindEvents();
});

const TOTAL_LEVELS = 100;
const HEART_LEVEL = 52;
const TARGET = 24;
const EPS = 1e-9;
const ANSWER_PASSWORD = "123123";
const STORAGE_KEY = "math24:lastLevel";
const START_LEVEL = 1;

const levelNow = document.querySelector("#levelNow");
const tilesEl = document.querySelector("#tiles");
const messageEl = document.querySelector("#message");
const expressionEl = document.querySelector("#expression");
const resetBtn = document.querySelector("#resetBtn");
const answerBtn = document.querySelector("#answerBtn");
const undoBtn = document.querySelector("#undoBtn");
const nextBtn = document.querySelector("#nextBtn");
const operatorsEl = document.querySelector(".operators");
const answerDialog = document.querySelector("#answerDialog");
const answerText = document.querySelector("#answerText");
const gameView = document.querySelector("#gameView");
const heartView = document.querySelector("#heartView");
const heartNextBtn = document.querySelector("#heartNextBtn");

function syncViewportHeight() {
  const height = window.visualViewport?.height || window.innerHeight;
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--app-height", `${height}px`);
  rootStyle.setProperty("--board-height-default", `${height * 0.5}px`);
  rootStyle.setProperty("--board-height-compact", `${height * 0.45}px`);
  rootStyle.setProperty("--board-height-small", `${height * 0.44}px`);
  rootStyle.setProperty("--board-height-short", `${height * 0.39}px`);
  rootStyle.setProperty("--board-height-tiny", `${height * 0.37}px`);
}

syncViewportHeight();
window.addEventListener("resize", syncViewportHeight);
window.visualViewport?.addEventListener("resize", syncViewportHeight);

const state = {
  level: 1,
  puzzle: null,
  items: [],
  currentValue: null,
  currentExpr: "",
  activeId: null,
  selectedOp: null,
  history: [],
  solved: false,
};

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function shuffle(random, list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function fmt(value) {
  if (Math.abs(value - Math.round(value)) < EPS) return String(Math.round(value));
  return Number(value.toFixed(3)).toString();
}

function combine(a, b, op) {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "*") return a * b;
  if (Math.abs(b) < EPS) return null;
  return a / b;
}

function evaluateExpression(numbers, ops, shape) {
  const [a, b, c, d] = numbers;
  const [op1, op2, op3] = ops;
  let r1;
  let r2;
  let r3;

  if (shape === 0) {
    r1 = combine(a, b, op1);
    if (r1 === null) return null;
    r2 = combine(r1, c, op2);
    if (r2 === null) return null;
    r3 = combine(r2, d, op3);
    return r3 === null ? null : { value: r3, text: `((${a}${op1}${b})${op2}${c})${op3}${d}` };
  }

  r1 = combine(a, b, op1);
  r2 = combine(c, d, op3);
  if (r1 === null || r2 === null) return null;
  r3 = combine(r1, r2, op2);
  return r3 === null ? null : { value: r3, text: `(${a}${op1}${b})${op2}(${c}${op3}${d})` };
}

function hasSolution(numbers) {
  const ops = ["+", "-", "*", "/"];
  const random = rng(numbers.join("") + 24);
  const permutations = [];

  function permute(arr, start = 0) {
    if (start === arr.length) {
      permutations.push([...arr]);
      return;
    }
    for (let i = start; i < arr.length; i += 1) {
      [arr[start], arr[i]] = [arr[i], arr[start]];
      permute(arr, start + 1);
      [arr[start], arr[i]] = [arr[i], arr[start]];
    }
  }

  permute([...numbers]);
  shuffle(random, permutations);

  for (const nums of permutations) {
    for (const op1 of ops) {
      for (const op2 of ops) {
        for (const op3 of ops) {
          for (const shape of [0, 1]) {
            const result = evaluateExpression(nums, [op1, op2, op3], shape);
            if (result && Math.abs(result.value - TARGET) < EPS) {
              return result.text.replaceAll("*", "×").replaceAll("/", "÷");
            }
          }
        }
      }
    }
  }

  return "";
}

function makePuzzle(level) {
  const random = rng(level * 9173 + 2407);
  const difficulty = Math.min(4, Math.floor(level / 20));
  const maxByDifficulty = [9, 12, 15, 18, 20];
  const max = maxByDifficulty[difficulty];
  const min = difficulty < 2 ? 1 : 2;

  for (let tries = 0; tries < 6000; tries += 1) {
    const numbers = Array.from({ length: 4 }, () => min + Math.floor(random() * (max - min + 1)));
    const solution = hasSolution(numbers);
    if (!solution) continue;

    const spread = Math.max(...numbers) - Math.min(...numbers);
    const hasLarge = numbers.some((n) => n > 10);
    if (difficulty >= 2 && !hasLarge) continue;
    if (difficulty >= 3 && spread < 5) continue;
    if (difficulty >= 4 && spread < 7) continue;

    return { numbers, solution };
  }

  return { numbers: [8, 8, 3, 3], solution: "(8÷(3-8÷3))" };
}

function isHeartLevel() {
  return state.level === HEART_LEVEL;
}

function clampLevel(level) {
  return Math.max(1, Math.min(TOTAL_LEVELS, level));
}

function readSavedLevel() {
  try {
    const saved = Number.parseInt(window.localStorage.getItem(STORAGE_KEY), 10);
    return Number.isFinite(saved) ? clampLevel(saved) : START_LEVEL;
  } catch {
    return START_LEVEL;
  }
}

function saveLevel(level) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(clampLevel(level)));
  } catch {
    // Storage can be unavailable in private browsing; gameplay should continue.
  }
}

function snapshot() {
  return JSON.stringify({
    items: state.items,
    currentValue: state.currentValue,
    currentExpr: state.currentExpr,
    activeId: state.activeId,
    selectedOp: state.selectedOp,
  });
}

function restore(snapshotText) {
  const previous = JSON.parse(snapshotText);
  state.items = previous.items;
  state.currentValue = previous.currentValue;
  state.currentExpr = previous.currentExpr;
  state.activeId = previous.activeId;
  state.selectedOp = previous.selectedOp;
}

function revealHeart() {
  if (!isHeartLevel() || heartView.hidden) return;
  heartView.classList.add("revealed");
}

function loadLevel(level) {
  state.level = clampLevel(level);
  saveLevel(state.level);
  state.currentValue = null;
  state.currentExpr = "";
  state.activeId = null;
  state.selectedOp = null;
  state.history = [];
  state.solved = false;
  levelNow.textContent = state.level;
  messageEl.textContent = "";
  expressionEl.textContent = "";
  nextBtn.hidden = true;

  if (isHeartLevel()) {
    gameView.hidden = true;
    heartView.hidden = false;
    heartView.classList.remove("revealed");
    return;
  }

  gameView.hidden = false;
  heartView.hidden = true;
  heartView.classList.remove("revealed");
  state.puzzle = makePuzzle(state.level);
  state.items = state.puzzle.numbers.map((number, index) => ({
    id: `${Date.now()}-${index}`,
    value: number,
    label: String(number),
    expr: String(number),
    used: false,
  }));
  render();
}

function render() {
  tilesEl.innerHTML = "";
  const unused = state.items.filter((item) => !item.used);
  expressionEl.textContent = state.currentExpr;

  state.items.forEach((item) => {
    const button = document.createElement("button");
    button.className = "tile";
    button.type = "button";
    button.dataset.id = item.id;
    button.dataset.used = item.used ? "true" : "false";
    button.disabled = item.used || state.solved;
    button.classList.toggle("selected", state.activeId === item.id && !state.selectedOp);
    button.textContent = item.label;
    button.addEventListener("click", () => selectTile(item.id));
    tilesEl.appendChild(button);
  });

  document.querySelectorAll(".operators button").forEach((button) => {
    button.classList.toggle("active", button.dataset.op === state.selectedOp);
  });

  undoBtn.disabled = state.history.length === 0;
  if (unused.length === 1 && !state.selectedOp) {
    if (Math.abs(unused[0].value - TARGET) < EPS) {
      state.currentValue = unused[0].value;
      state.currentExpr = unused[0].expr;
      expressionEl.textContent = state.currentExpr;
      passLevel();
    } else {
      messageEl.textContent = "";
    }
  }
}

function selectTile(id) {
  if (state.solved) return;
  const item = state.items.find((entry) => entry.id === id);
  if (!item || item.used) return;

  if (!state.activeId) {
    state.activeId = id;
    state.currentValue = item.value;
    state.currentExpr = item.expr;
    render();
    return;
  }

  if (!state.selectedOp) {
    state.activeId = id;
    state.currentValue = item.value;
    state.currentExpr = item.expr;
    render();
    return;
  }

  applyOperation(state.activeId, id, state.selectedOp);
}

function applyOperation(leftId, rightId, op) {
  const left = state.items.find((item) => item.id === leftId);
  const right = state.items.find((item) => item.id === rightId);
  if (!left || !right || left.used || right.used || leftId === rightId) return;

  const value = combine(left.value, right.value, op);
  if (value === null) {
    messageEl.textContent = "不能除以 0";
    return;
  }

  state.history.push(snapshot());
  const expr = nextExpression(left.expr, op, right.expr);
  left.used = true;
  right.value = value;
  right.label = fmt(value);
  right.expr = expr;
  right.used = false;
  state.activeId = right.id;
  state.currentValue = value;
  state.currentExpr = expr;
  state.selectedOp = null;
  messageEl.textContent = "";
  render();
}

function displayOp(op) {
  if (op === "*") return "×";
  if (op === "/") return "÷";
  return op;
}

function wrapExpr(expr) {
  return /[+\-×÷]/.test(expr) ? `(${expr})` : expr;
}

function nextExpression(leftExpr, op, rightExpr) {
  return `${wrapExpr(leftExpr)}${displayOp(op)}${wrapExpr(rightExpr)}`;
}

function passLevel() {
  if (state.solved) return;
  state.solved = true;
  messageEl.textContent = "";
  nextBtn.hidden = state.level === TOTAL_LEVELS;
}

operatorsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-op]");
  if (!button || state.solved) return;
  if (!state.activeId) {
    messageEl.textContent = "先选择一个数字";
    return;
  }
  const active = state.items.find((item) => item.id === state.activeId);
  if (!active || active.used) return;
  state.selectedOp = button.dataset.op;
  messageEl.textContent = "";
  render();
});

resetBtn.addEventListener("click", () => loadLevel(state.level));

undoBtn.addEventListener("click", () => {
  const previous = state.history.pop();
  if (!previous) return;
  restore(previous);
  state.solved = false;
  messageEl.textContent = "";
  nextBtn.hidden = true;
  render();
});

nextBtn.addEventListener("click", () => loadLevel(state.level + 1));
heartNextBtn.addEventListener("click", () => loadLevel(state.level + 1));
heartView.addEventListener("click", revealHeart);

answerBtn.addEventListener("click", () => {
  const password = window.prompt("请输入答案密码");
  if (password !== ANSWER_PASSWORD) {
    messageEl.textContent = "密码不对哦";
    return;
  }

  if (isHeartLevel()) {
    answerText.textContent = "第 52 关没有题目，送你一颗爱心。";
  } else {
    answerText.textContent = `${state.puzzle.solution} = 24`;
  }
  answerDialog.showModal();
});

document.querySelector(".back-btn").addEventListener("click", () => {
  loadLevel(Math.max(1, state.level - 1));
});

loadLevel(readSavedLevel());

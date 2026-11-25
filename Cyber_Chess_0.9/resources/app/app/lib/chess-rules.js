// Campaign rules shared by the bundled UI and the automated tests.
// The board still constructs positions with the Chess implementation that
// loaded this module (the copy bundled in app.js, or chess.js in tests).

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const PIECE_MATERIAL = { p: 1, n: 3, b: 3, r: 5, q: 9 };
export const STARTING_MATERIAL = 39;
const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE_SCORE = 100000;

export function sanitizePlayerName(value) {
  const compact = String(value ?? "").replace(/\s+/g, " ").trim();
  const safe = compact.replace(/[^a-zA-Z0-9 _.-]/g, "").slice(0, 14).trim();
  return safe || "PLAYER 1";
}

export function clampAudioVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 100;
  return Math.max(0, Math.min(200, Math.round(numeric)));
}

export function soundtrackTitle(src) {
  const fileName = String(src).split("/").pop()?.replace(/\.[^.]+$/, "") ?? String(src);
  return fileName
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function sideMaterial(fen, color) {
  const board = String(fen || "").split(" ")[0] || "";
  let score = 0;
  for (const char of board) {
    const value = PIECE_MATERIAL[char.toLowerCase()] ?? 0;
    if (!value) continue;
    const white = char !== char.toLowerCase();
    if (color === "w" ? white : !white) score += value;
  }
  return score;
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getFightHudState(fen, playerColor, aiColor, Chess) {
  const playerMaterial = sideMaterial(fen, playerColor);
  const enemyMaterial = sideMaterial(fen, aiColor);
  const playerHealth = clampPercent(playerMaterial / STARTING_MATERIAL * 100);
  const enemyHealth = clampPercent(enemyMaterial / STARTING_MATERIAL * 100);
  const playerAdvantage = (playerColor === "w" ? 1 : -1) * (sideMaterial(fen, "w") - sideMaterial(fen, "b"));
  let playerInCheck = false;
  let enemyInCheck = false;
  if (typeof Chess === "function") {
    try {
      const game = new Chess(fen);
      if (game.isCheck()) {
        playerInCheck = game.turn() === playerColor;
        enemyInCheck = game.turn() === aiColor;
      }
    } catch {
      // Illegal FEN still produces a material readout.
    }
  }
  const playerMood = playerHealth <= 68 ? "damaged" : enemyHealth <= 58 ? "dominating" : "normal";
  const enemyMood = enemyHealth <= 68 ? "damaged" : playerHealth <= 58 ? "dominating" : "neutral";
  return {
    playerAdvantage,
    playerHealth,
    enemyHealth,
    playerInCheck,
    enemyInCheck,
    playerMood,
    enemyMood,
    pressure: playerInCheck ? "CHECK DANGER" : enemyInCheck ? "CHECK PRESSURE" : playerAdvantage >= 4 ? "ADVANTAGE" : playerAdvantage <= -4 ? "DANGER" : "EVEN FIGHT"
  };
}

export function classifyGameEnd(game, playerColor) {
  if (!game.isGameOver()) return null;
  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "b" : "w";
    return winner === playerColor ? "win" : "loss";
  }
  return "draw";
}

export function livesAfterOutcome(outcome, lives) {
  const current = Number.isFinite(lives) ? lives : 0;
  if (outcome === "win" || outcome === "draw") return current;
  return Math.max(0, current - 1);
}

export function resultKindForOutcome(outcome, { lives, hasNextOpponent }) {
  if (outcome === "win") return hasNextOpponent ? "win" : "clear";
  if (outcome === "draw") return "draw";
  return livesAfterOutcome(outcome, lives) > 0 ? "loss" : "game-over";
}

export function expireLossResult(result) {
  if (!result || result.kind !== "loss") return result;
  return { ...result, kind: "game-over", livesAfter: 0 };
}

export function scoreRun({ outcome, opponentIndex, livesAfter, seconds, opponentCount }) {
  if (outcome !== "clear" && outcome !== "game-over") return null;
  const safeSeconds = Math.max(1, Math.round(Number(seconds) || 0));
  const wins = outcome === "clear" ? opponentCount : Math.max(0, opponentIndex);
  const speedBonus = outcome === "clear" ? Math.max(0, 900 - safeSeconds) : 0;
  return wins * 1000 + livesAfter * 250 + speedBonus;
}

export function materialScore(game, perspective) {
  let score = 0;
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;
      const value = PIECE_VALUE[piece.type] ?? 0;
      score += piece.color === perspective ? value : -value;
    }
  }
  return score;
}

export function evaluatePosition(game, perspective) {
  if (game.isCheckmate()) return game.turn() === perspective ? -MATE_SCORE : MATE_SCORE;
  if (game.isDraw()) return 0;
  return materialScore(game, perspective);
}

function sample(items, rng) {
  if (!items.length) return null;
  const index = Math.min(items.length - 1, Math.max(0, Math.floor(rng() * items.length)));
  return items[index];
}

function moveSpec(move) {
  const spec = { from: move.from, to: move.to };
  if (move.promotion) spec.promotion = move.promotion;
  else if (move.piece === "p" && (move.to[1] === "1" || move.to[1] === "8")) spec.promotion = "q";
  return spec;
}

function playMove(game, move) {
  return game.move(moveSpec(move));
}

function moveScore(Chess, game, move, perspective, depthBonus = 0) {
  let score = 0;
  const flags = String(move.flags || "");
  if (move.captured) score += (PIECE_VALUE[move.captured] ?? 0) + 8;
  if (move.promotion) score += PIECE_VALUE[move.promotion] ?? 700;
  if (flags.includes("k") || flags.includes("q")) score += 18;
  const clone = new Chess(game.fen());
  playMove(clone, move);
  if (clone.isCheckmate()) score += evaluatePosition(clone, perspective);
  else if (clone.isCheck()) score += clone.turn() === perspective ? -55 : 55;
  if (depthBonus) score += materialScore(clone, perspective) * depthBonus;
  return score;
}

function minimax(Chess, game, depth, alpha, beta, perspective) {
  if (game.isCheckmate()) return game.turn() === perspective ? -MATE_SCORE : MATE_SCORE;
  if (game.isDraw()) return 0;
  if (depth === 0) return materialScore(game, perspective);
  const maximizing = game.turn() === perspective;
  const moves = game.moves({ verbose: true })
    .map((move) => ({ move, score: moveScore(Chess, game, move, perspective, 0) }))
    .sort((a, b) => maximizing ? b.score - a.score : a.score - b.score)
    .map((entry) => entry.move);
  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      playMove(game, move);
      best = Math.max(best, minimax(Chess, game, depth - 1, alpha, beta, perspective));
      game.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const move of moves) {
    playMove(game, move);
    best = Math.min(best, minimax(Chess, game, depth - 1, alpha, beta, perspective));
    game.undo();
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export function moveFromUci(game, uci) {
  if (typeof uci !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(uci.trim())) return null;
  const token = uci.trim().toLowerCase();
  const from = token.slice(0, 2);
  const to = token.slice(2, 4);
  const promotion = token[4];
  return game.moves({ verbose: true }).find((move) => {
    if (move.from !== from || move.to !== to) return false;
    if (!promotion) return !move.promotion;
    return move.promotion === promotion;
  }) ?? null;
}

export function createAi(Chess, { rng = Math.random } = {}) {
  function chooseEasy(game) {
    const moves = game.moves({ verbose: true });
    const captures = moves.filter((move) => move.captured);
    if (captures.length && rng() < 0.35) return sample(captures, rng);
    return sample(moves, rng);
  }

  function chooseMedium(game, perspective) {
    const moves = game.moves({ verbose: true });
    if (!moves.length) return null;
    const scored = moves
      .map((move) => ({ move, score: moveScore(Chess, game, move, perspective, 0.02) + rng() * 36 }))
      .sort((a, b) => b.score - a.score);
    return sample(scored.slice(0, Math.min(3, scored.length)).map((entry) => entry.move), rng);
  }

  function chooseHard(game, perspective) {
    const moves = game.moves({ verbose: true });
    if (!moves.length) return null;
    let bestScore = -Infinity;
    const bestMoves = [];
    for (const move of moves) {
      playMove(game, move);
      const score = minimax(Chess, game, 2, -Infinity, Infinity, perspective);
      game.undo();
      const total = score + moveScore(Chess, game, move, perspective, 0) * 0.1 + rng() * 8;
      if (total > bestScore + 0.001) {
        bestScore = total;
        bestMoves.length = 0;
        bestMoves.push(move);
      } else if (Math.abs(total - bestScore) <= 0.001) {
        bestMoves.push(move);
      }
    }
    return sample(bestMoves, rng);
  }

  function chooseLozza(fen, aiColor) {
    const game = new Chess(fen);
    if (game.isGameOver() || game.turn() !== aiColor) return Promise.resolve(null);
    const fallback = () => chooseHard(new Chess(fen), aiColor);
    const WorkerCtor = globalThis.Worker;
    if (typeof WorkerCtor !== "function" || typeof globalThis.window === "undefined") {
      return Promise.resolve(fallback());
    }
    return new Promise((resolve) => {
      let worker = null;
      let settled = false;
      let timer = 0;
      const finish = (move) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        if (worker) worker.terminate();
        resolve(move ?? fallback());
      };
      try {
        worker = new WorkerCtor(new URL("../media/engines/lozza.js", import.meta.url));
        worker.onmessage = (event) => {
          const line = String(event.data).trim();
          const match = /^bestmove\s+(\S+)/i.exec(line);
          if (match) finish(moveFromUci(game, match[1]));
        };
        worker.onerror = () => finish(null);
        worker.postMessage("uci");
        worker.postMessage("isready");
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage("go depth 5");
        timer = globalThis.setTimeout(() => finish(null), 5000);
      } catch {
        finish(null);
      }
    });
  }

  async function chooseAiMove(fen, profile, aiColor = "b") {
    let game;
    try {
      game = new Chess(fen);
    } catch {
      return null;
    }
    if (game.isGameOver() || game.turn() !== aiColor) return null;
    try {
      if (profile === "goop") return chooseEasy(game);
      if (profile === "frostd4d") return chooseMedium(game, aiColor);
      if (profile === "gordo") return chooseLozza(fen, aiColor);
      return chooseHard(game, aiColor);
    } catch {
      return null;
    }
  }

  return { chooseAiMove, chooseEasy, chooseMedium, chooseHard };
}

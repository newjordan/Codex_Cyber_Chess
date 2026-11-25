import assert from "node:assert/strict";
import test from "node:test";
import { Chess } from "chess.js";
import {
  STARTING_MATERIAL,
  START_FEN,
  clampAudioVolume,
  classifyGameEnd,
  createAi,
  evaluatePosition,
  expireLossResult,
  getFightHudState,
  livesAfterOutcome,
  materialScore,
  moveFromUci,
  resultKindForOutcome,
  sanitizePlayerName,
  scoreRun,
  sideMaterial,
  soundtrackTitle,
} from "../Cyber_Chess_0.9/resources/app/app/lib/chess-rules.js";

const STALEMATE = "k7/2Q5/1K6/8/8/8/8/8 b - - 0 1";
const MATE_IN_ONE = "7k/8/6K1/7Q/8/8/8/8 w - - 0 1";
const WHITE_QUEEN_LESS = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1";
const WHITE_PAWN_LESS = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPP1/RNBQKBNR w KQkq - 0 1";
const CAPTURE = "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1";
const PROMOTE = "8/4P3/8/8/4k3/8/8/4K3 w - - 0 1";

test("starting material matches both armies", () => {
  assert.equal(sideMaterial(START_FEN, "w"), STARTING_MATERIAL);
  assert.equal(sideMaterial(START_FEN, "b"), STARTING_MATERIAL);
  assert.equal(STARTING_MATERIAL, 39);
});

test("health tracks material instead of piece count", () => {
  const queenLoss = getFightHudState(WHITE_QUEEN_LESS, "w", "b", Chess);
  const pawnLoss = getFightHudState(WHITE_PAWN_LESS, "w", "b", Chess);
  const start = getFightHudState(START_FEN, "b", "w", Chess);
  assert.equal(start.playerHealth, 100);
  assert.equal(start.enemyHealth, 100);
  assert.ok(queenLoss.playerHealth < pawnLoss.playerHealth);
  assert.equal(queenLoss.enemyHealth, 100);
  assert.equal(queenLoss.pressure, "DANGER");
  assert.equal(pawnLoss.pressure, "EVEN FIGHT");
});

test("a king and rook check is reported for the side to move", () => {
  const blackToMove = getFightHudState("4k2R/8/8/8/8/8/8/4K3 b - - 0 1", "b", "w", Chess);
  assert.equal(blackToMove.playerInCheck, true);
  assert.equal(blackToMove.pressure, "CHECK DANGER");
  assert.equal(blackToMove.enemyInCheck, false);
});

test("draws do not cost a life and checkmates do", () => {
  const drawn = new Chess(STALEMATE);
  assert.equal(drawn.isDraw(), true);
  assert.equal(classifyGameEnd(drawn, "b"), "draw");
  assert.equal(classifyGameEnd(drawn, "w"), "draw");
  assert.equal(evaluatePosition(drawn, "b"), 0);
  assert.notEqual(materialScore(drawn, "w"), 0);

  const mate = new Chess("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1");
  assert.equal(mate.isCheckmate(), true);
  assert.equal(classifyGameEnd(mate, "w"), "win");
  assert.equal(classifyGameEnd(mate, "b"), "loss");
  assert.equal(livesAfterOutcome("draw", 2), 2);
  assert.equal(livesAfterOutcome("win", 1), 1);
  assert.equal(livesAfterOutcome("loss", 2), 1);
  assert.equal(livesAfterOutcome("loss", 1), 0);
  assert.equal(resultKindForOutcome("draw", { lives: 1, hasNextOpponent: true }), "draw");
  assert.equal(resultKindForOutcome("win", { lives: 2, hasNextOpponent: true }), "win");
  assert.equal(resultKindForOutcome("win", { lives: 2, hasNextOpponent: false }), "clear");
  assert.equal(resultKindForOutcome("loss", { lives: 2, hasNextOpponent: true }), "loss");
  assert.equal(resultKindForOutcome("loss", { lives: 1, hasNextOpponent: true }), "game-over");
});

test("an expired continue timer records a game over", () => {
  const expired = expireLossResult({ kind: "loss", livesAfter: 1, opponent: "Goop" });
  assert.deepEqual(expired, { kind: "game-over", livesAfter: 0, opponent: "Goop" });
  assert.equal(expireLossResult({ kind: "win", livesAfter: 2 }).kind, "win");
  assert.equal(scoreRun({ outcome: "draw", opponentIndex: 1, livesAfter: 2, seconds: 10, opponentCount: 4 }), null);
  assert.equal(scoreRun({ outcome: "clear", opponentIndex: 3, livesAfter: 2, seconds: 100, opponentCount: 4 }), 5300);
  assert.equal(scoreRun({ outcome: "game-over", opponentIndex: 2, livesAfter: 0, seconds: 40, opponentCount: 4 }), 2000);
});

test("names, volume, and soundtrack titles are normalized", () => {
  assert.equal(sanitizePlayerName("  Frosty  "), "Frosty");
  assert.equal(sanitizePlayerName("***"), "PLAYER 1");
  assert.equal(sanitizePlayerName("a".repeat(30)).length, 14);
  assert.equal(clampAudioVolume("nope"), 100);
  assert.equal(clampAudioVolume(250), 200);
  assert.equal(clampAudioVolume(-4), 0);
  assert.equal(clampAudioVolume(73.2), 73);
  assert.equal(soundtrackTitle("media/audio/Synesthetic Circuit.mp3"), "Synesthetic Circuit");
  assert.equal(soundtrackTitle("media/audio/dont twist the bishop.mp3"), "Dont Twist The Bishop");
  assert.equal(soundtrackTitle("media/audio/The_Pulse_of_the_Board_2.mp3"), "The Pulse Of The Board 2");
});

test("UCI promotion letters are honored and omitted letters are not guessed as a knight", () => {
  const game = new Chess(PROMOTE);
  assert.equal(moveFromUci(game, "e7e8"), null);
  assert.equal(moveFromUci(game, "e7e8q").promotion, "q");
  assert.equal(moveFromUci(game, "e7e8n").promotion, "n");
  assert.equal(moveFromUci(game, "zzzz"), null);
  assert.equal(moveFromUci(new Chess(), "e2e4").san, "e4");
  assert.equal(moveFromUci(new Chess(), "e2e5"), null);
});

test("easy mode can prefer a capture and hard mode finds mate in one", () => {
  const captureGame = new Chess(CAPTURE);
  const easy = createAi(Chess, { rng: () => 0 });
  const capture = easy.chooseEasy(captureGame);
  assert.equal(capture.to, "d5");
  assert.equal(capture.captured, "p");

  const hard = createAi(Chess, { rng: () => 0 });
  const game = new Chess(MATE_IN_ONE);
  const move = hard.chooseHard(game, "w");
  game.move({ from: move.from, to: move.to, promotion: move.promotion });
  assert.equal(game.isCheckmate(), true);
});

test("opponent profiles return a legal move or nothing when it is not their turn", async () => {
  const ai = createAi(Chess, { rng: () => 0.99 });
  assert.equal(await ai.chooseAiMove(START_FEN, "goop", "b"), null);
  const goop = await ai.chooseAiMove(START_FEN, "goop", "w");
  const legal = new Chess(START_FEN).moves({ verbose: true }).some((move) => move.from === goop.from && move.to === goop.to);
  assert.equal(legal, true);
  const mate = await ai.chooseAiMove(MATE_IN_ONE, "razorblade", "w");
  const proof = new Chess(MATE_IN_ONE);
  proof.move({ from: mate.from, to: mate.to, promotion: mate.promotion });
  assert.equal(proof.isCheckmate(), true);
  const boss = await ai.chooseAiMove(MATE_IN_ONE, "gordo", "w");
  const bossProof = new Chess(MATE_IN_ONE);
  bossProof.move({ from: boss.from, to: boss.to, promotion: boss.promotion });
  assert.equal(bossProof.isCheckmate(), true);
  assert.equal(await ai.chooseAiMove("not a fen", "goop", "w"), null);
});

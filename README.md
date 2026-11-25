# Cyber Chess 0.9

Neon campaign chess. You climb a four-opponent ladder on a wireframe board, with a soundtrack, a 10 second continue timer, and a 2D board when WebGL is unavailable.

<p align="center">
 <img width="1672" height="941" alt="Cyber Chess" src="https://github.com/user-attachments/assets/69251c15-25bc-49c3-8086-34437878199a" />
</p>

## Setup

Node.js 20 or newer is required. This workspace was checked with Node.js 22.23.4. Install dependencies from the repository root:

```bash
npm ci
```

Artwork, the Windows portable executable, and the zip downloads are Git LFS objects. `git lfs pull` fetches them. Until then, image files are pointer text and `Cyber_Chess_0.9/Codex_Cyber_Chess_0.9.exe` is not a runnable binary. The LFS pointer for that executable records an object size of 224118272 bytes. The music files under `Cyber_Chess_0.9/resources/app/app/media/audio/` are normal Git files and play without LFS.

## Play

Browser, from the repository root:

```bash
npm run serve
```

The server prints a `http://127.0.0.1:` URL and only listens on loopback. It serves `Cyber_Chess_0.9/resources/app/app/`.

Desktop shell, using the Electron 45.5.0 dev dependency:

```bash
npm start
```

The shell opens a borderless window, serves the same files on `127.0.0.1`, and adds minimize and close controls. The archived Windows build remains `Cyber_Chess_0.9/Codex_Cyber_Chess_0.9.exe` after `git lfs pull`. Its `version` file reads `42.3.2`.

## How to play

1. Press Play to start the intro, then press Play again to enter your name.
2. Names keep letters, numbers, spaces, and `._-`, and are cut at 14 characters. An empty name becomes `PLAYER 1`. Entering `gordo` skips to the final match.
3. Step through the story, or skip it.
4. Choose white or black. Your side is at the bottom of the board.
5. Ascend. The ladder is fixed: Goop (easy), Frostd4d (medium), Razorblade (hard search), then GORDO.
6. GORDO asks the bundled Lozza engine for a move and falls back to the hard search if the engine does not answer.
7. You start with 2 lives. A checkmate loss spends a life and starts a 10 second continue timer. Letting the timer expire ends the run and writes a leaderboard row. A draw, including stalemate, does not spend a life; rematch the same opponent.
8. Pawn promotion is automatic to a queen.
9. Escape opens settings. Full audio, sound effects only, or mute; the output level runs from 0 to 200. Save and load remember the ladder position. `+` and `-` change soundtrack tracks while full audio is on.
10. If the 3D board cannot start, the game switches to the labeled 2D board.

## Soundtrack

The jukebox is the `SOUNDTRACK_SOURCES` list in `Cyber_Chess_0.9/resources/app/app/app.js`: 25 files, all present in `media/audio/`. Titles below are the names the game shows. Lengths are the ffprobe durations rounded to the nearest second. The 25 measured durations sum to 5432.61 seconds, which rounds to 90:33.

| # | In-game title | Length | File |
|---|---|---:|---|
| 01 | The Pulse Long Song | 4:00 | `the_pulse_long_song.mp3` |
| 02 | Pawn2queen | 4:18 | `pawn2queen.mp3` |
| 03 | Fapponacci Twister | 7:59 | `fapponacci_twister.mp3` |
| 04 | Dont Twist The Bishop | 4:10 | `dont twist the bishop.mp3` |
| 05 | Floppie Discs | 2:14 | `floppie_discs.mp3` |
| 06 | Rooks And Kings | 3:58 | `rooks and kings.mp3` |
| 07 | Synesthetic Circuit | 7:59 | `Synesthetic Circuit.mp3` |
| 08 | Velvet Queen | 4:10 | `Velvet Queen.mp3` |
| 09 | Glitch Relaxor | 5:44 | `Glitch Relaxor.mp3` |
| 10 | Glitch Reliable | 4:33 | `Glitch Reliable.mp3` |
| 11 | Moonbowl Smoke | 3:15 | `Moonbowl_Smoke.mp3` |
| 12 | Pixelot | 2:50 | `Pixelot.mp3` |
| 13 | Cyber Chess Music | 3:00 | `cyber_chess_music.mp3` |
| 14 | Chrome Gambit | 6:43 | `Chrome Gambit.mp3` |
| 15 | Chrome Fresh | 3:35 | `Chrome fresh.mp3` |
| 16 | Chrome Chess Mode | 3:13 | `Chrome_Chess_Mode.mp3` |
| 17 | Chrome City | 3:22 | `Chrome_city.mp3` |
| 18 | Boogie Knights | 3:30 | `boogie_knights.mp3` |
| 19 | Drummin Pawns | 3:25 | `drummin_pawns.mp3` |
| 20 | Cybercrimes | 0:36 | `cybercrimes.mp3` |
| 21 | The Pulse Of The Board 2 | 2:00 | `The_Pulse_of_the_Board_2.mp3` |
| 22 | Checkmeat Freakazoid | 1:00 | `checkmeat_freakazoid.mp3` |
| 23 | Checkmeat You Lose Song | 1:00 | `checkmeat_you_lose_song.mp3` |
| 24 | Victorious 1 | 0:30 | `victorious_1.mp3` |
| 25 | Synthetic Dreams Cyber Eyes | 3:30 | `synthetic_dreams_cyber_eyes.mp3` |

`victorioius_2.mp3` is not in that rotation. ffprobe measured it at 25.051 seconds, and the game loops it on the cabinet-clear screen. `Pawns_of_Destiny.mp3` is also in the audio folder (ffprobe duration 119.980 seconds) and is not part of the jukebox or the result music. Provenance notes for the playlist are in `media/audio/TRACKLIST.txt`.

## Tests

```bash
npm test
```

`npm test` runs 14 tests: campaign rules (draws, lives, mate search, promotion UCI, material health), the desktop static server (path escape, symlink escape, byte ranges), the 25 soundtrack files, and the license text. GitHub Actions runs the same command on pushes and pull requests. The workflow skips the Electron binary download because the tests do not launch a window.

## License

`Cyber_Chess_0.9/LICENSE` is the Electron MIT license and is unchanged. Lozza stays under the MIT text in `Cyber_Chess_0.9/resources/app/app/media/engines/lozza-LICENSE.txt`. Notices for the bundled React, chess.js, and Three.js builds are at the bottom of `Cyber_Chess_0.9/resources/app/app/app.js`.

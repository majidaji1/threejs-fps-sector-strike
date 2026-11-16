# threejs-fps-sector-strike

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/majidaji1/threejs-fps-sector-strike/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/majidaji1/threejs-fps-sector-strike/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

**Sector Strike** — a round-based tactical first-person shooter in the style Counter-Strike made famous, built with three.js 0.187.0. Two teams, short rounds won by eliminating the other team or planting/defusing a bomb, money between rounds to buy weapons, and gunfire where accuracy counts more than speed. Original map, art, names — not a copy.

## Features

- **Round-based gameplay**: buy phase → play phase → bomb plant/defuse → round end
- **Two teams**: Attack (T) plants bomb, Defend (CT) prevents it
- **Buy menu**: pistol (free), SMG, rifle, sniper + armor + grenades
- **Tactical shooting**: recoil, spread, ADS zoom, headshot multipliers, crouch accuracy bonus
- **Bot AI**: patrol waypoints, detect via line-of-sight, aim, fire, react to damage
- **Original map "Sector Delta"**: two bomb sites (A/B), mid corridor, choke points, lighting
- **Full HUD**: health, ammo, timer, score, money, kill feed, objective text

## Run it

```sh
node serve.ts --port 8123
```

Then open http://localhost:8123 in desktop Chrome (WebGL 2 required).

### Controls

- **W A S D** — move
- **Shift** — sprint
- **Mouse** — look
- **Left click** — fire
- **Right click** — aim down sights
- **R** — reload
- **G** — cycle weapon
- **Space** — jump
- **Ctrl** — crouch
- **B** — buy menu
- **F** — use (plant/defuse)

## Build entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Screenshots

See `screenshots/` for 4 gameplay captures (1280×720 PNG).

---

<sub>Entered on [make.fun](https://make.fun/?ref=LBS16ST&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
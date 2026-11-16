// Round logic: spawn teams, play phase, objective (bomb plant/defuse), elimination, win/loss,
// money reward, round restart. Standard CS-style: T attack, CT defend, 1:45 timer, bomb timer 40s.
import * as THREE from 'three';

const ROUND_TIME = 105; // 1:45 in seconds
const BOMB_TIME = 40;
const DEFUSE_TIME = 5;
const PLANT_TIME = 3;

export function createRound(world, playerTeam = 'T') {
  const state = {
    phase: 'buy', // buy | play | plant | defuse | end
    roundNumber: 0,
    timer: ROUND_TIME,
    bombPlanted: false,
    bombTimer: 0,
    bombPosition: null,
    defuseProgress: 0,
    plantProgress: 0,
    scoreT: 0,
    scoreCT: 0,
    money: 800,
    kills: 0,
    deaths: 0,
    lastObjective: '-',
    earnings: 0,
    winner: null,
  };

  function startRound() {
    state.roundNumber++;
    state.phase = 'buy';
    state.timer = ROUND_TIME;
    state.bombPlanted = false;
    state.bombTimer = 0;
    state.bombPosition = null;
    state.defuseProgress = 0;
    state.plantProgress = 0;
    state.winner = null;
    state.earnings = 0;
  }

  function startPlayPhase() {
    state.phase = 'play';
    state.timer = ROUND_TIME;
  }

  function plantBomb(position) {
    state.bombPlanted = true;
    state.bombPosition = position.clone();
    state.bombTimer = BOMB_TIME;
    state.phase = 'plant';
    state.lastObjective = 'Planted';
  }

  function tickPlant(dt) {
    state.plantProgress += dt;
    return state.plantProgress >= PLANT_TIME;
  }

  function tickDefuse(dt) {
    state.defuseProgress += dt;
    return state.defuseProgress >= DEFUSE_TIME;
  }

  function endRound(winner, reason) {
    state.phase = 'end';
    state.winner = winner;
    if (winner === 'T') state.scoreT++;
    else state.scoreCT++;

    // Money reward
    const baseReward = 3000;
    const killReward = state.kills * 300;
    const objectiveReward = state.lastObjective !== '-' ? 1000 : 0;
    state.earnings = baseReward + killReward + objectiveReward;
    state.money += state.earnings;
    state.money = Math.min(state.money, 16000);
  }

  function step(dt, aliveT, aliveCT) {
    if (state.phase === 'buy') return;

    if (state.phase === 'play') {
      state.timer -= dt;

      // Elimination check
      if (aliveT === 0) {
        endRound('CT', 'Elimination');
        return;
      }
      if (aliveCT === 0) {
        endRound('T', 'Elimination');
        return;
      }

      // Time out: CT win (bomb not planted)
      if (state.timer <= 0) {
        endRound('CT', 'Time expired');
        return;
      }
    } else if (state.phase === 'plant') {
      state.bombTimer -= dt;

      // Check if all CT dead
      if (aliveCT === 0) {
        endRound('T', 'Bomb explosion imminent');
        return;
      }

      // Bomb timer
      if (state.bombTimer <= 0) {
        endRound('T', 'Bomb exploded');
        state.lastObjective = 'Bomb exploded';
        return;
      }

      // Defuse (checked in main loop via player interaction)
    } else if (state.phase === 'defuse') {
      // Defusing in progress, checked via tickDefuse
    }
  }

  function reset() {
    state.roundNumber = 0;
    state.scoreT = 0;
    state.scoreCT = 0;
    state.money = 800;
    state.kills = 0;
    state.deaths = 0;
    state.lastObjective = '-';
    startRound();
  }

  return {
    state,
    startRound,
    startPlayPhase,
    plantBomb,
    tickPlant,
    tickDefuse,
    endRound,
    step,
    reset,
  };
}
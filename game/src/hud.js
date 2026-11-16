// HUD updates: health, ammo, timer, score, money, kill feed, objective text, round result overlay.
export function createHud() {
  const el = {
    crosshair: document.getElementById('crosshair'),
    hitmarker: document.getElementById('hitmarker'),
    ammo: document.getElementById('ammo'),
    ammoMag: document.getElementById('ammo-mag'),
    ammoReserve: document.getElementById('ammo-reserve'),
    health: document.getElementById('health'),
    healthFill: document.getElementById('health-fill'),
    healthText: document.getElementById('health-text'),
    score: document.getElementById('score-value'),
    roundTeam: document.getElementById('round-team'),
    roundSideText: document.getElementById('round-side-text'),
    timer: document.getElementById('timer'),
    money: document.getElementById('money-value'),
    killfeed: document.getElementById('killfeed'),
    objective: document.getElementById('objective-text'),

    startOverlay: document.getElementById('start-overlay'),
    startPlay: document.getElementById('start-play'),

    buyMenu: document.getElementById('buy-menu'),
    buyGrid: document.getElementById('buy-grid'),
    buyMoney: document.getElementById('buy-money'),

    resultOverlay: document.getElementById('result-overlay'),
    resultTitle: document.getElementById('result-title'),
    resultSubtitle: document.getElementById('result-subtitle'),
    resultKills: document.getElementById('result-kills'),
    resultDeaths: document.getElementById('result-deaths'),
    resultObjective: document.getElementById('result-objective'),
    resultEarnings: document.getElementById('result-earnings'),
    resultNext: document.getElementById('result-next'),
  };

  function setAmmo(mag, reserve) {
    el.ammoMag.textContent = String(mag);
    el.ammoReserve.textContent = `/ ${reserve}`;
    el.ammo.classList.toggle('empty', mag === 0);
  }

  function setHealth(hp) {
    const pct = Math.max(0, Math.min(100, hp));
    el.healthFill.style.width = `${pct}%`;
    el.healthText.textContent = String(Math.round(hp));
    el.health.classList.toggle('empty', hp < 30);
  }

  function setScore(score) {
    el.score.textContent = String(score);
  }

  function setMoney(money) {
    el.money.textContent = String(money);
  }

  function setTimer(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    el.timer.textContent = `${m}:${String(sec).padStart(2, '0')}`;
    el.timer.classList.toggle('urgent', s <= 10);
  }

  function setRoundInfo(team, side) {
    el.roundTeam.textContent = team === 'T' ? 'ATTACK' : 'DEFEND';
    el.roundSideText.textContent = side;
  }

  function setObjective(text) {
    el.objective.textContent = text;
  }

  function hitMarker() {
    el.hitmarker.classList.add('on');
    setTimeout(() => el.hitmarker.classList.remove('on'), 120);
  }

  function addKillFeed(message) {
    const line = document.createElement('div');
    line.className = 'kill-feed-line';
    line.textContent = message;
    el.killfeed.appendChild(line);
    setTimeout(() => line.remove(), 4000);
  }

  function showStart() {
    el.startOverlay.hidden = false;
  }

  function hideStart() {
    el.startOverlay.hidden = true;
  }

  function onStartPlay(callback) {
    el.startPlay.addEventListener('click', callback);
  }

  function showBuyMenu(money) {
    el.buyMenu.hidden = false;
    el.buyMoney.textContent = String(money);
  }

  function hideBuyMenu() {
    el.buyMenu.hidden = true;
  }

  function renderBuyItems(items, money, onBuy) {
    el.buyGrid.innerHTML = '';
    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'buy-item';
      const disabled = item.price > money || item.owned;
      if (disabled) div.classList.add('disabled');
      div.innerHTML = `
        <span class="name">${item.name}</span>
        <span class="cost">$${item.price}</span>
        <span class="desc">${item.desc}</span>
      `;
      if (!disabled) {
        div.addEventListener('click', () => onBuy(item.id));
      }
      el.buyGrid.appendChild(div);
    }
  }

  function showResult({ title, subtitle, kills, deaths, objective, earnings }) {
    el.resultOverlay.hidden = false;
    el.resultTitle.textContent = title;
    el.resultSubtitle.textContent = subtitle;
    el.resultKills.textContent = String(kills);
    el.resultDeaths.textContent = String(deaths);
    el.resultObjective.textContent = objective;
    el.resultEarnings.textContent = `$${earnings}`;
  }

  function hideResult() {
    el.resultOverlay.hidden = true;
  }

  function onResultNext(callback) {
    el.resultNext.addEventListener('click', callback);
  }

  return {
    setAmmo,
    setHealth,
    setScore,
    setMoney,
    setTimer,
    setRoundInfo,
    setObjective,
    hitMarker,
    addKillFeed,
    showStart,
    hideStart,
    onStartPlay,
    showBuyMenu,
    hideBuyMenu,
    renderBuyItems,
    showResult,
    hideResult,
    onResultNext,
  };
}
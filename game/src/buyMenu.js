// Buy menu: weapon and equipment purchase between rounds. Weapons: pistol (free), SMG, rifle,
// sniper. Equipment: armor, grenades. Money carried between rounds, reset on new match.
import { WEAPONS } from './weapon.js';

export const BUY_ITEMS = [
  { id: 'smg', name: 'MP9', kind: 'weapon', price: 1250, desc: 'Fast fire, low damage', weapon: 'smg' },
  { id: 'rifle', name: 'AK-7', kind: 'weapon', price: 2700, desc: 'High damage, accurate', weapon: 'rifle' },
  { id: 'sniper', name: 'LR-50', kind: 'weapon', price: 4750, desc: 'One-shot headshot', weapon: 'sniper' },
  { id: 'armor', name: 'Armor', kind: 'equipment', price: 1000, desc: 'Absorbs 50% damage', armor: 100 },
  { id: 'grenade', name: 'Frag', kind: 'equipment', price: 500, desc: 'Area damage', grenade: true },
];

export function createBuyMenu(hud) {
  const state = {
    open: false,
    buyTimer: 15,
    autoClose: true,
  };

  function toggle() {
    state.open = !state.open;
    if (state.open) {
      hud.showBuyMenu(0); // money set by caller
      state.buyTimer = 15;
    } else {
      hud.hideBuyMenu();
    }
    return state.open;
  }

  function close() {
    state.open = false;
    hud.hideBuyMenu();
  }

  function render(money, owned, onBuy) {
    const items = BUY_ITEMS.map((item) => ({
      ...item,
      owned: owned.has(item.id),
    }));
    hud.renderBuyItems(items, money, onBuy);
  }

  function step(dt) {
    if (!state.open || !state.autoClose) return;
    state.buyTimer -= dt;
    if (state.buyTimer <= 0) close();
  }

  function purchase(itemId, money) {
    const item = BUY_ITEMS.find((i) => i.id === itemId);
    if (!item) return null;
    if (money < item.price) return null;
    return { item, cost: item.price };
  }

  return {
    state,
    toggle,
    close,
    render,
    step,
    purchase,
  };
}
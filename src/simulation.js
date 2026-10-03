// Combat is independent of Three.js and advances at a fixed 60 Hz.
import { defaults, attackSpec } from './tuning.js';
export class Combat {
  constructor(onHit = () => {}, options = {}) { this.onHit = onHit; this.settings = options.settings ?? [defaults('leonardo'), defaults('raphael')]; this.training = options.training ?? false; this.unlimitedTime = options.unlimitedTime ?? false; this.rollPlayers = options.rollPlayers ?? [false,false]; this.kickPlayers = options.kickPlayers ?? [false,false]; this.reset(); }
  reset() {
    this.fighters = [-3, 3].map((x, i) => ({ x, y: 0, vy: 0, speed: 0, facing: i ? -1 : 1, health: 100, attack: null, roll: null, stun: 0, blockStun: false, crouching: false, blocking: false, previous: {} }));
    this.time = 99; this.winner = null; this.hitstop = 0;
  }
  step(dt, inputs) {
    if (this.winner !== null) return;
    if (this.hitstop > 0) { this.hitstop = Math.max(0, this.hitstop - dt); return; }
    if (!this.training && !this.unlimitedTime) this.time = Math.max(0, this.time - dt);
    this.fighters.forEach((f, i) => {
      const input = inputs[i], opponent = this.fighters[1 - i], settings = this.settings[i];
      if (!f.attack && !f.roll) f.facing = opponent.x >= f.x ? 1 : -1;
      f.stun = Math.max(0, f.stun - dt);
      if (f.stun === 0) f.blockStun = false;
      if (this.rollPlayers[i] && input.roll && !f.previous.roll && f.y === 0 && !f.attack && !f.roll && !f.stun && !input.block) {
        const direction = Number(Boolean(input.right)) - Number(Boolean(input.left));
        f.roll = { duration: .7, remaining: .7, direction: direction || f.facing };
      }
      f.crouching = Boolean(input.crouch) && f.y === 0 && f.vy <= 0 && !f.attack && !f.roll && (f.stun === 0 || f.blockStun);
      f.blocking = (Boolean(input.block) || f.blockStun) && f.y === 0 && !f.attack && !f.roll && (f.stun === 0 || f.blockStun);
      f.speed = f.roll ? f.roll.direction * 3 : !f.attack && !f.blocking && f.stun === 0 ? (Number(Boolean(input.right)) - Number(Boolean(input.left))) * settings.movement.speed * (f.crouching ? .45 : 1) : 0;
      f.x = Math.max(-6, Math.min(6, f.x + f.speed * dt));
      if (input.jump && !f.previous.jump && f.y === 0 && !f.crouching && !f.attack && !f.roll && !f.blocking && !f.stun) f.vy = settings.movement.jumpVelocity;
      f.vy -= settings.movement.gravity * dt; f.y = Math.max(0, f.y + f.vy * dt);
      if (f.y === 0) f.vy = 0;
      if (!f.attack && !f.roll && !f.blocking && !f.stun) {
        const kick = this.kickPlayers[i] && f.y === 0 && input.kick && !f.previous.kick;
        const spin = this.kickPlayers[i] && f.y === 0 && input.spinKick && !f.previous.spinKick;
        const special = this.kickPlayers[i] && f.y===0 && input.blueFlame && !f.previous.blueFlame;
        const type = special ? 'blueFlame' : spin ? 'spinKick' : kick ? 'kick' : input.heavy && !f.previous.heavy ? 'heavy' : input.strike && !f.previous.strike ? 'strike' : null;
        if (type) { const move = attackSpec(settings, type); f.crouching = false; f.attack = { ...move, type, remaining: move.duration, hit: false, hitWindows:[] }; }
      }
      if (f.attack) f.attack.remaining -= dt;
      if (f.roll) { f.roll.remaining -= dt; if (f.roll.remaining <= 1e-8) f.roll = null; }
      f.previous = { ...input };
    });
    const [a, b] = this.fighters;
    const gap = b.x - a.x;
    if (Math.abs(gap) < 1.15 && Math.abs(a.y - b.y) < 1.5) {
      const mid = Math.max(-5.425, Math.min(5.425, (a.x + b.x) / 2));
      const sign = gap >= 0 ? 1 : -1;
      a.x = mid - sign * .575; b.x = mid + sign * .575;
    }
    // Collect contacts first so simultaneous attacks can trade fairly.
    const contacts = [];
    this.fighters.forEach((f, i) => {
      const attack = f.attack, target = this.fighters[1 - i];
      if (!attack) return;
      const age = attack.duration - attack.remaining;
      const windows=attack.type==='blueFlame' ? [[0,.10],[.5,.60],[.90,1]] : [[0,1]];
      const window=windows.findIndex(([start,end])=>age+1e-8>=attack.startup+start*attack.active&&age+1e-8<attack.startup+end*attack.active);
      const available=attack.type==='blueFlame' ? window>=0&&!attack.hitWindows.includes(window) : !attack.hit&&window>=0;
      if (available && Math.abs(f.x - target.x) < attack.range && (target.x - f.x) * f.facing > 0 && Math.abs(f.y - target.y) < 1.1) contacts.push({ source: i, target: 1 - i, attack, window });
      if (attack.remaining <= 0) f.attack = null;
    });
    for (const contact of contacts) {
      const f = this.fighters[contact.source], target = this.fighters[contact.target], attack = contact.attack;
      attack.hit = true;
      attack.hitWindows.push(contact.window);
      const blocked = target.blocking && (f.x - target.x) * target.facing > 0;
      target.health = Math.max(0, target.health - (blocked ? 1 : attack.damage));
      target.stun = blocked ? .08 : attack.stun;
      target.blockStun = blocked;
      if (!blocked) { target.attack = null; target.roll = null; }
      target.x = Math.max(-6, Math.min(6, target.x + f.facing * attack.push * (blocked ? .3 : 1)));
      const heavy = attack.type === 'heavy' || attack.type === 'spinKick';
      this.hitstop = heavy ? .075 : .045;
      this.onHit({ source: contact.source, target: contact.target, blocked, heavy, type: attack.type, damage: blocked ? 1 : attack.damage });
    }
    if (!this.training && (this.fighters.some(f => f.health <= 0) || this.time === 0)) this.winner = a.health === b.health ? 'draw' : a.health > b.health ? 0 : 1;
  }
}

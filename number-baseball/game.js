export const TURN_MS = 45000;
export const COOLDOWN_MS = 1200;
export const validNumber = (value, digits) => typeof value === 'string' && new RegExp(`^[0-9]{${digits}}$`).test(value) && new Set(value).size === digits;
export function randomNumber(digits) {
  const pool = [...'0123456789'];
  for (let i = pool.length - 1; i > 0; i--) {
    // Rejection sampling avoids modulo bias.
    let n; const bound = Math.floor(4294967296 / (i + 1)) * (i + 1);
    do { n = crypto.getRandomValues(new Uint32Array(1))[0]; } while (n >= bound);
    const j = n % (i + 1); [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, digits).join('');
}
export function score(secret, guess) {
  let strikes = 0, balls = 0;
  [...guess].forEach((digit, i) => { if (secret[i] === digit) strikes++; else if (secret.includes(digit)) balls++; });
  return { strikes, balls };
}
export class Game {
  constructor(hostId, name, code) {
    this.state = { code, hostId, round: 1, revision: 0, phase: 'lobby', settings: { digits: 3, mode: 'turn', puzzle: 'personal' }, players: [{ id: hostId, name, ready: false, online: true }], history: [], solved: {}, turn: 0, deadline: 0, startedAt: 0, winner: null, reason: '', paused: false };
    this.state.configVersion = 0;
    this.secrets = {}; this.lastGuess = {};
  }
  player(id) { return this.state.players.find(p => p.id === id); }
  join(id, name) {
    if (this.player(id)) { this.player(id).online = true; return; }
    if (this.state.phase !== 'lobby') throw Error('이미 게임이 시작된 방이에요.');
    if (this.state.players.length >= 3) throw Error('방이 꽉 찼어요. 최대 3명까지 들어올 수 있어요.');
    if (typeof name !== 'string' || !name.trim() || name.length > 10) throw Error('별명을 1~10글자로 적어 주세요.');
    this.state.players.push({ id, name: name.trim(), ready: false, online: true });
  }
  configure(id, settings) {
    if (id !== this.state.hostId || this.state.phase !== 'lobby') throw Error('대기실에서 방장만 바꿀 수 있어요.');
    if (![3, 4].includes(settings.digits) || !['turn', 'speed'].includes(settings.mode) || !['personal', 'common'].includes(settings.puzzle)) throw Error('설정이 올바르지 않아요.');
    this.state.settings = { digits: settings.digits, mode: settings.mode, puzzle: settings.puzzle };
    this.state.configVersion++;
    this.state.players.forEach(p => p.ready = false); this.secrets = {};
  }
  ready(id, secret) {
    const p = this.player(id); if (!p || this.state.phase !== 'lobby') throw Error('대기실에서 준비해 주세요.');
    if (this.state.settings.puzzle === 'personal') {
      if (!validNumber(secret, this.state.settings.digits)) throw Error('서로 다른 숫자로 채워 주세요. 맨 앞 0도 괜찮아요!');
      this.secrets[id] = secret;
    }
    p.ready = true;
  }
  start(id, now = Date.now()) {
    const s = this.state;
    if (id !== s.hostId || s.phase !== 'lobby' || s.players.length < 2 || !s.players.every(p => p.ready && p.online)) throw Error('2~3명 모두 준비되면 시작할 수 있어요.');
    if (s.settings.puzzle === 'common') this.secrets.common = randomNumber(s.settings.digits);
    s.phase = 'playing'; s.turn = (s.round - 1) % s.players.length; s.startedAt = now; s.deadline = now + TURN_MS;
    s.history = []; s.solved = Object.fromEntries(s.players.map(p => [p.id, []])); this.lastGuess = {};
  }
  guess(id, guess, target, now = Date.now()) {
    const s = this.state;
    if (s.phase !== 'playing' || !this.player(id) || s.paused) throw Error('지금은 추측할 수 없어요.');
    if (s.settings.mode === 'turn' && (s.players[s.turn].id !== id || now >= s.deadline)) throw Error('내 차례를 기다려 주세요.');
    if (now - (this.lastGuess[id] ?? -Infinity) < COOLDOWN_MS) throw Error('잠깐! 숫자를 다시 생각하고 던져 주세요.');
    if (!validNumber(guess, s.settings.digits)) throw Error(`중복 없는 ${s.settings.digits}자리 숫자를 적어 주세요.`);
    if (s.settings.puzzle === 'common') target = 'common';
    if (target !== 'common' && (!this.player(target) || target === id)) throw Error('다른 친구를 골라 주세요.');
    if (s.settings.puzzle === 'personal' && target === 'common') throw Error('다른 친구를 골라 주세요.');
    if (s.solved[id].includes(target)) throw Error('이미 맞힌 친구예요. 다른 친구에게 도전해 보세요.');
    if (s.history.some(h => h.player === id && h.target === target && h.guess === guess)) throw Error('이미 던져 본 숫자예요. 기록을 확인해 보세요.');
    if (s.history.length >= 600) { this.finish(null, '600번의 도전! 잠깐 쉬고 새 게임을 시작해요.'); return; }
    const result = score(this.secrets[target], guess);
    s.history.push({ id: s.history.length + 1, player: id, target, guess, ...result, at: now }); this.lastGuess[id] = now;
    if (result.strikes === s.settings.digits) s.solved[id].push(target);
    const needed = s.settings.puzzle === 'common' ? 1 : s.players.length - 1;
    if (s.solved[id].length === needed) this.finish(id, '');
    else if (s.settings.mode === 'turn') this.nextTurn(now);
  }
  nextTurn(now) { this.state.turn = (this.state.turn + 1) % this.state.players.length; this.state.deadline = now + TURN_MS; }
  tick(now = Date.now()) {
    const s = this.state;
    if (s.phase !== 'playing') return false;
    const paused = s.players.some(p => !p.online);
    if (paused !== s.paused) { s.paused = paused; s.deadline = now + TURN_MS; return true; }
    if (!paused && s.settings.mode === 'turn' && now >= s.deadline) { this.nextTurn(now); return true; }
    return false;
  }
  leave(id) {
    if (this.state.phase === 'playing') this.finish(null, `${this.player(id)?.name || '친구'} 님이 나가서 게임을 마쳤어요.`);
    if (id !== this.state.hostId) this.state.players = this.state.players.filter(p => p.id !== id);
    delete this.secrets[id];
  }
  finish(winner, reason) { this.state.phase = 'finished'; this.state.winner = winner; this.state.reason = reason; this.state.answers = { ...this.secrets }; this.state.finishedPlayers = structuredClone(this.state.players); this.state.finishedAt = Date.now(); }
  rematch(id) {
    if (id !== this.state.hostId || this.state.phase !== 'finished') throw Error('방장이 다음 경기를 열 수 있어요.');
    this.state.phase = 'lobby'; this.state.round++; this.state.players.forEach(p => p.ready = false);
    this.state.history = []; this.state.solved = {}; this.state.winner = null; this.state.reason = ''; this.state.paused = false;
    delete this.state.answers; delete this.state.finishedPlayers; this.secrets = {}; this.lastGuess = {};
  }
}

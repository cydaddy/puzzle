import { Game, validNumber } from './game.js';

// Keep this namespace identical for every copy of this game. Children only type the six digits.
export const TOPIC_PREFIX = 'school-playground/number-baseball/8c273e9a-41fd-4d60-b802-a5967e21f04c/v1';
export const BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';
const uid = () => crypto.randomUUID();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const bytesToBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const base64ToBytes = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));

export class Room {
  constructor(name, onState, onStatus, onClosed) {
    this.id = uid(); this.name = name; this.onState = onState; this.onStatus = onStatus; this.onClosed = onClosed;
    this.pending = new Map(); this.seen = new Map(); this.lastSeen = new Map(); this.queue = Promise.resolve(); this.closed = false;
    this.clockOffset = 0;
  }
  async connect() {
    if (!globalThis.mqtt) throw Error('통신 파일을 불러오지 못했어요. 새로고침해 주세요.');
    if (!crypto.subtle) throw Error('HTTPS 주소 또는 localhost에서 열어 주세요.');
    this.onStatus('connecting');
    this.client = mqtt.connect(BROKER_URL, { clientId: `nb-${this.id}`, clean: true, keepalive: 15, connectTimeout: 12000, reconnectPeriod: 2000, resubscribe: true, queueQoSZero: false });
    this.client.on('message', (topic, bytes) => {
      try { if (bytes.length > 250000) return; const message = JSON.parse(bytes.toString()); this.receive(topic, message); } catch { /* Ignore other applications and malformed packets. */ }
    });
    this.client.on('offline', () => this.onStatus('reconnecting'));
    this.client.on('error', () => { /* Initial timeout or MQTT reconnect handles failures. */ });
    this.client.on('connect', () => {
      this.onStatus('online');
      if (this.game) { this.game.state.deadline = Date.now() + 45000; this.advertise(); this.broadcast(); }
      else if (this.base) this.request('sync').catch(() => {});
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.client.end(true); reject(Error('연결이 늦어지고 있어요. 인터넷이나 학교 네트워크를 확인한 뒤 다시 눌러 주세요.')); }, 15000);
      this.client.once('connect', () => { clearTimeout(timeout); resolve(); });
    });
    this.timer = setInterval(() => this.heartbeat(), 3000);
    this.tickTimer = setInterval(() => { if (this.game && this.client.connected && this.game.tick()) this.broadcast(); }, 250);
  }
  subscribe(topic) {
    return new Promise((resolve, reject) => this.client.subscribe(topic, { qos: 1 }, (err, granted) => {
      if (err || granted?.some(g => g.qos === 128)) reject(Error('방 연결을 허용받지 못했어요. 다시 시도해 주세요.')); else resolve();
    }));
  }
  publish(topic, payload, retain = false) {
    if (this.client?.connected) this.client.publish(topic, JSON.stringify(payload), { qos: 1, retain });
  }
  async discover(code) {
    this.code = code; this.descriptor = null; this.discoveryTopic = `${TOPIC_PREFIX}/rooms/${code}`;
    await this.subscribe(this.discoveryTopic); await wait(1200);
    return this.descriptor && this.descriptor.expires > Date.now() ? this.descriptor : null;
  }
  async create() {
    this.keyPair = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
      const occupied = await this.discover(code);
      if (occupied) { this.client.unsubscribe(this.discoveryTopic); continue; }
      this.session = uid();
      this.ownDescriptor = { session: this.session, hostId: this.id, key: await crypto.subtle.exportKey('jwk', this.keyPair.publicKey) };
      this.advertise(); await wait(1000);
      if (this.descriptor?.session !== this.session) { this.client.unsubscribe(this.discoveryTopic); continue; }
      this.base = `${TOPIC_PREFIX}/games/${code}/${this.session}`;
      await this.subscribe(`${this.base}/request`);
      await this.subscribe(`${this.base}/reply/${this.id}`);
      this.game = new Game(this.id, this.name, code); this.lastSeen.set(this.id, Date.now());
      this.broadcast(); return;
    }
    throw Error('방 코드를 만드는 중 겹쳤어요. 한 번 더 눌러 주세요.');
  }
  async join(code) {
    const descriptor = await this.discover(code);
    if (!descriptor) throw Error('이 번호의 방을 찾지 못했어요. 방 코드 6자리를 확인해 주세요.');
    this.session = descriptor.session; this.ownDescriptor = descriptor;
    this.base = `${TOPIC_PREFIX}/games/${code}/${this.session}`;
    await this.subscribe(`${this.base}/state`); await this.subscribe(`${this.base}/reply/${this.id}`);
    await this.request('join', { name: this.name });
  }
  advertise() { if (this.ownDescriptor && this.keyPair) this.publish(this.discoveryTopic, { ...this.ownDescriptor, expires: Date.now() + 20000 }, true); }
  async ready(secret) {
    let encrypted;
    if (secret) {
      const key = await crypto.subtle.importKey('jwk', this.ownDescriptor.key, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
      encrypted = bytesToBase64(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, new TextEncoder().encode(secret)));
    }
    return this.request('ready', { encrypted });
  }
  request(type, data = {}) {
    if (this.closed || !this.client?.connected) return Promise.reject(Error('다시 연결하고 있어요. 잠시 기다려 주세요.'));
    const id = uid(); const packet = { id, player: this.id, session: this.session, type, data, round: this.state?.round, configVersion: this.state?.configVersion, sentAt: this.now() };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(Error('응답이 늦어지고 있어요. 연결 상태를 확인하고 다시 시도해 주세요.')); }, 10000);
      this.pending.set(id, { resolve, reject, timer });
      this.publish(`${this.base}/request`, packet);
    });
  }
  receive(topic, message) {
    if (this.closed || !message || typeof message !== 'object') return;
    if (topic === this.discoveryTopic) {
      if (typeof message.session !== 'string' || typeof message.expires !== 'number') return;
      this.descriptor = message;
      if (!this.game && this.session === message.session && message.expires > Date.now()) this.lastHost = Date.now();
      if (this.base && this.session === message.session && message.expires === 0) this.terminate('방장이 방을 닫았어요. 새 방에서 다시 만나요!');
      return;
    }
    if (topic === `${this.base}/state` && message.session === this.session) this.acceptState(message.state);
    if (topic === `${this.base}/reply/${this.id}` && message.session === this.session) {
      const pending = this.pending.get(message.id); if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(message.id);
      if (message.state) this.acceptState(message.state);
      if (message.error) pending.reject(Error(message.error)); else pending.resolve();
    }
    if (this.game && topic === `${this.base}/request` && message.session === this.session) {
      this.queue = this.queue.then(() => this.handle(message)).catch(() => {});
    }
  }
  acceptState(state) {
    if (!validState(state) || state.hostId !== this.ownDescriptor?.hostId || state.code !== this.code || !state.players.some(p => p.id === this.id)) return;
    if (this.state && state.revision <= this.state.revision) return;
    if (Number.isFinite(state.serverTime)) this.clockOffset = state.serverTime - Date.now();
    this.state = state; this.onState(state);
  }
  now() { return Date.now() + this.clockOffset; }
  async handle(m) {
    if (typeof m.id !== 'string' || typeof m.player !== 'string' || m.id.length > 80 || m.player.length > 80 || !m.data || typeof m.data !== 'object') return;
    const replyTopic = `${this.base}/reply/${m.player}`;
    if (this.seen.has(m.id)) { this.publish(replyTopic, this.seen.get(m.id)); return; }
    let error;
    try {
      if (m.type === 'join') this.game.join(m.player, m.data.name);
      else {
        if (!this.game.player(m.player)) throw Error('이 방에 다시 입장해 주세요.');
        if (!['sync', 'ping', 'leave'].includes(m.type) && m.round !== this.game.state.round) throw Error('새 경기가 시작됐어요. 다시 시도해 주세요.');
        if (!['sync', 'ping', 'leave'].includes(m.type) && (!Number.isFinite(m.sentAt) || Math.abs(Date.now() - m.sentAt) > 10000)) throw Error('늦게 도착한 요청이에요. 한 번 더 시도해 주세요.');
        if (m.type === 'ready') {
          if (m.configVersion !== this.game.state.configVersion) throw Error('방 설정이 바뀌었어요. 확인하고 다시 준비해 주세요.');
          let secret;
          if (m.data.encrypted) secret = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, this.keyPair.privateKey, base64ToBytes(m.data.encrypted)));
          this.game.ready(m.player, secret);
        } else if (m.type === 'settings') this.game.configure(m.player, m.data);
        else if (m.type === 'start') this.game.start(m.player);
        else if (m.type === 'guess') this.game.guess(m.player, m.data.guess, m.data.target);
        else if (m.type === 'rematch') this.game.rematch(m.player);
        else if (m.type === 'leave') this.game.leave(m.player);
        else if (!['sync', 'ping'].includes(m.type)) throw Error('알 수 없는 요청이에요.');
      }
      let rejoined = false;
      if (m.type !== 'leave') { this.lastSeen.set(m.player, Date.now()); const p = this.game.player(m.player); if (p) { rejoined = !p.online; p.online = true; } }
      if (m.type !== 'ping' || rejoined) { this.game.tick(); this.broadcast(); }
    } catch (err) { error = err.message || '요청을 처리하지 못했어요.'; }
    const reply = { id: m.id, session: this.session, error, state: this.game.state };
    this.seen.set(m.id, structuredClone(reply)); if (this.seen.size > 500) this.seen.delete(this.seen.keys().next().value);
    this.publish(replyTopic, reply);
  }
  broadcast() {
    this.game.state.serverTime = Date.now();
    this.game.state.revision++;
    this.state = structuredClone(this.game.state); this.onState(this.state);
    this.publish(`${this.base}/state`, { session: this.session, state: this.state });
  }
  heartbeat() {
    if (this.closed) return;
    if (this.game && this.client.connected) {
      this.advertise(); let changed = false;
      for (const p of [...this.game.state.players]) {
        if (p.id === this.id) continue;
        const elapsed = Date.now() - (this.lastSeen.get(p.id) || 0);
        if (elapsed > 60000) { this.game.leave(p.id); changed = true; }
        else if (p.online !== (elapsed < 14000)) { p.online = elapsed < 14000; changed = true; }
      }
      if (changed) { this.game.tick(); this.broadcast(); }
    } else if (this.base) {
      if (this.client.connected) this.request('ping').catch(() => {});
      const elapsed = Date.now() - (this.lastHost || Date.now());
      if (elapsed > 60000) this.terminate('방장과 연결이 끊어졌어요. 새 방을 만들어 다시 만나요.');
      else if (elapsed > 18000) this.onStatus('host-away');
      else if (this.client.connected) this.onStatus('online');
    }
  }
  terminate(message) { this.close(false); this.onClosed(message); }
  close(notify = true) {
    if (this.closed) return;
    if (notify && this.game) this.publish(this.discoveryTopic, { ...this.ownDescriptor, expires: 0 }, true);
    else if (notify && this.base) this.publish(`${this.base}/request`, { id: uid(), player: this.id, session: this.session, type: 'leave', data: {} });
    this.closed = true; clearInterval(this.timer); clearInterval(this.tickTimer);
    this.pending.forEach(p => { clearTimeout(p.timer); p.reject(Error('방을 나왔어요.')); }); this.pending.clear();
    if (this.client) { this.client.options.reconnectPeriod = 0; this.client.end(false); setTimeout(() => this.client.end(true), 1200); }
  }
}

// MQTT is a public transport: do not render arbitrary incoming strings as game data.
export function validState(s) {
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
  const short = value => typeof value === 'string' && value.length <= 160;
  return !!s && /^\d{6}$/.test(s.code) && id(s.hostId) && Number.isInteger(s.revision) && s.revision >= 0
    && Number.isInteger(s.round) && s.round >= 1 && ['lobby', 'playing', 'finished'].includes(s.phase)
    && [3, 4].includes(s.settings?.digits) && ['turn', 'speed'].includes(s.settings?.mode) && ['personal', 'common'].includes(s.settings?.puzzle)
    && Array.isArray(s.players) && s.players.length >= 1 && s.players.length <= 3 && s.players.every(p => id(p.id) && short(p.name) && typeof p.online === 'boolean')
    && (!s.finishedPlayers || Array.isArray(s.finishedPlayers) && s.finishedPlayers.length <= 3 && s.finishedPlayers.every(p => id(p.id) && short(p.name)))
    && Number.isInteger(s.turn) && s.turn >= 0 && s.turn < 3 && Number.isFinite(s.deadline) && Number.isFinite(s.startedAt)
    && s.solved && typeof s.solved === 'object' && Object.values(s.solved).every(list => Array.isArray(list) && list.length <= 2 && list.every(id))
    && Array.isArray(s.history) && s.history.length <= 600 && s.history.every(h => Number.isInteger(h.id) && id(h.player) && id(h.target) && validNumber(h.guess, s.settings.digits) && Number.isInteger(h.strikes) && h.strikes >= 0 && Number.isInteger(h.balls) && h.balls >= 0 && h.strikes + h.balls <= s.settings.digits)
    && (!s.answers || Object.entries(s.answers).every(([key, answer]) => id(key) && validNumber(answer, s.settings.digits)))
    && (!s.reason || short(s.reason));
}

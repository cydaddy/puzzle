import { Room } from './network.js';
import { validNumber, randomNumber, COOLDOWN_MS } from './game.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const animals = ['🐻', '🐰', '🐱'];
let room = null, state = null, status = 'idle', busy = false, actionBusy = false;
let entryTab = /^#\d{6}$/.test(location.hash) ? 'join' : 'create';
let nickname = '', codeDraft = location.hash.slice(1), secretDraft = '', guessDraft = '', target = '', filter = 'all';
let showSecret = false, localSecret = '', lastSettings = '', lastRound = 0, lastCount = 0, cooldownUntil = 0, sound = false, audioContext;
let toastTimer;

function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 5000); }
function tone(won = false) {
  if (!sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume();
    (won ? [523, 659, 784, 1047] : [620, 780]).forEach((frequency, i) => {
      const osc = audioContext.createOscillator(), gain = audioContext.createGain(), at = audioContext.currentTime + i * .1;
      osc.type = 'sine'; osc.frequency.value = frequency; gain.gain.setValueAtTime(.045, at); gain.gain.exponentialRampToValueAtTime(.001, at + .18);
      osc.connect(gain); gain.connect(audioContext.destination); osc.start(at); osc.stop(at + .2);
    });
  } catch { /* Sound is optional. */ }
}
function connection(next) {
  status = next;
  const labels = { idle: '친구와 머리 쓰는 한 판!', connecting: '운동장에 연결하는 중…', online: '실시간으로 함께하는 중', reconnecting: '연결이 끊겼어요 · 다시 연결 중…', 'host-away': '방장 연결을 기다리고 있어요…' };
  $('#connection').textContent = labels[next]; $('#connection').className = `connection ${next === 'online' ? 'live' : next === 'idle' ? '' : 'warn'}`;
  const notice = $('#connection-notice'); if (notice) { notice.hidden = next === 'online'; notice.textContent = `${labels[next]} 연결되면 이어서 할 수 있어요.`; }
  updateClock();
}
function onState(next) {
  const changedPhase = state?.phase !== next.phase;
  if (lastSettings !== JSON.stringify(next.settings) || lastRound !== next.round) {
    secretDraft = ''; localSecret = ''; guessDraft = ''; target = ''; showSecret = false;
    lastSettings = JSON.stringify(next.settings); lastRound = next.round;
  }
  if (next.history.length > lastCount) tone(next.history.at(-1).strikes === next.settings.digits);
  lastCount = next.history.length; state = next; render();
  if (changedPhase) window.scrollTo({ top: 0, behavior: 'instant' });
}
function closeRoom(message) {
  room?.close(false); room = null; state = null; busy = false; actionBusy = false;
  secretDraft = ''; localSecret = ''; guessDraft = ''; lastSettings = ''; lastRound = 0; lastCount = 0; target = ''; showSecret = false;
  connection('idle'); history.replaceState(null, '', location.pathname + location.search); render(); if (message) toast(message);
}
const roster = () => state?.phase === 'finished' ? state.finishedPlayers || state.players : state?.players || [];
const nameOf = id => id === 'common' ? '공통 정답' : roster().find(p => p.id === id)?.name || '나간 친구';
const avatar = (p, i) => `<span class="avatar a${i}">${animals[i] || '⚾'}</span>`;
const isHost = () => state?.hostId === room?.id;
const me = () => state?.players.find(p => p.id === room?.id);
const settingsLabel = () => `${state.settings.digits}자리 · ${state.settings.puzzle === 'personal' ? '각자 출제' : '공통 정답'} · ${state.settings.mode === 'speed' ? '스피드 대전' : '턴제 대전'}`;

function landing() {
  return `<section class="landing"><div class="hero"><span class="eyebrow badge">✦ LITTLE NUMBERS, BIG FUN</span><h1>너의 숫자,<br>내가 <em>맞혀볼게!</em></h1><p>숫자 하나, 힌트 하나. 두근두근 머리 쓰는 한 판!<br>친구들과 모여 우리만의 숫자야구를 시작해요.</p><div class="hero-art" aria-hidden="true"><span class="number-tile one">0</span><span class="number-tile two">2</span><span class="number-tile three">7</span><span class="art-ball">⚾</span><span class="art-star">✳</span><span class="art-note">쉿, 이 숫자는 우리끼리 비밀!</span></div></div><section class="card entry-card"><span class="eyebrow">READY, SET, PLAY</span><h2>오늘의 선수, 누구인가요?</h2><p class="subtext">가입 없이, 친구와 방 코드만 나누면 준비 끝.</p><div class="tabs" role="tablist" aria-label="입장 방법"><button role="tab" aria-selected="${entryTab === 'create'}" data-entry="create" class="${entryTab === 'create' ? 'active' : ''}">새 방 만들기</button><button role="tab" aria-selected="${entryTab === 'join'}" data-entry="join" class="${entryTab === 'join' ? 'active' : ''}">친구 방 들어가기</button></div><form id="entry-form"><div class="field"><label class="field-label" for="nickname">내 별명 <small>친구들이 알아볼 수 있게!</small></label><input class="text-input" id="nickname" name="nickname" autocomplete="off" maxlength="10" placeholder="예: 홈런왕 곰돌이" value="${esc(nickname)}" required ${busy ? 'disabled' : ''}></div>${entryTab === 'join' ? `<div class="field"><label class="field-label" for="room-code">방 코드 <small>친구가 알려준 숫자 6개</small></label><input class="text-input" id="room-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" placeholder="예: 123456" value="${esc(codeDraft)}" required ${busy ? 'disabled' : ''}></div>` : ''}<button class="button primary full" ${busy ? 'disabled' : ''}>${busy ? '<span class="loading-dot">연결하는 중…</span>' : entryTab === 'create' ? '우리 방 만들기 <span>↗</span>' : '친구 만나러 가기 <span>↗</span>'}</button></form><div class="entry-note"><i></i> 2~3명 함께 · 휴대폰, 태블릿, 컴퓨터 모두 OK</div></section></section><section class="mini-rules" aria-label="숫자야구 힌트"><div class="mini-rule"><span class="rule-icon s">S</span><div><b>스트라이크!</b><p>숫자도 맞고, 자리도 맞아요.</p></div></div><div class="mini-rule"><span class="rule-icon b">B</span><div><b>볼!</b><p>숫자는 맞는데, 자리가 달라요.</p></div></div><div class="mini-rule"><span class="rule-icon o">O</span><div><b>아웃!</b><p>이 숫자는 정답에 없어요.</p></div></div></section>`;
}
function pageTop() {
  return `<div class="page-top"><div><span class="eyebrow">OUR LITTLE BALLPARK / ROUND ${state.round.toString().padStart(2, '0')}</span><h2>${state.phase === 'lobby' ? '친구들, 여기 모여라!' : state.phase === 'finished' ? '멋진 경기였어요!' : '자, 머리 쓰는 시간!'}</h2>${state.phase !== 'lobby' ? `<div class="round-label">${settingsLabel()}</div>` : ''}</div><div class="code-share"><div class="code-box"><div class="code-caption">우리 방 코드</div><div class="room-code" aria-label="방 코드 ${[...state.code].join(' ')}">${state.code.slice(0, 3)} ${state.code.slice(3)}</div></div><button class="button secondary" data-action="copy-code">코드 복사</button><button class="text-button" data-action="copy-link">초대 링크</button><button class="text-button" data-action="leave">나가기</button></div></div><div class="notice" id="connection-notice" ${status === 'online' ? 'hidden' : ''}>연결을 기다리는 중이에요. 연결되면 이어서 할 수 있어요.</div>`;
}
function settingGroup(title, key, options) {
  return `<div class="setting-group"><div class="setting-title">${title}</div><div class="choices">${options.map(([value, label, description]) => `<button class="choice ${String(state.settings[key]) === String(value) ? 'selected' : ''}" aria-pressed="${String(state.settings[key]) === String(value)}" data-setting="${key}" data-value="${value}" ${!isHost() || actionBusy ? 'disabled' : ''}><b>${label}</b><small>${description}</small></button>`).join('')}</div></div>`;
}
function lobby() {
  const mine = me();
  return `<div class="lobby-layout"><section class="card"><div class="section-top"><h3>우리만의 경기 규칙</h3><small>${isHost() ? '방장이 골라요' : '방장이 고르는 중'}</small></div>${settingGroup('01. 어떤 숫자를 맞힐까요?', 'puzzle', [['personal', '🤫 각자 출제', '내 비밀 숫자를 정해요'], ['common', '🎲 공통 정답', '같은 랜덤 숫자를 맞혀요']])}${settingGroup('02. 어떻게 겨룰까요?', 'mode', [['turn', '↻ 턴제 대전', '차례대로 한 번씩 · 45초'], ['speed', 'ϟ 스피드 대전', '동시에 자유롭게 추측!']])}${settingGroup('03. 몇 자리로 할까요?', 'digits', [[3, '3자리', '가볍게 시작해요'], [4, '4자리', '조금 더 짜릿하게!']])}<p class="setting-note">숫자 중복은 안 돼요. 맨 앞에 0은 괜찮아요.</p><div class="room-tip">${state.settings.puzzle === 'personal' ? '🤫 다른 친구 모두의 비밀 숫자를 먼저 맞히면 승리! 내 숫자가 들켜도 게임은 계속돼요.' : '🎲 모두 같은 정답에 도전해요. 가장 먼저 맞히면 승리! 정답은 시작할 때 새로 뽑아요.'}<br>👀 서로의 추측과 결과는 모두에게 보여요.</div></section><section class="card"><div class="section-top"><h3>오늘의 선수들</h3><small>${state.players.length} / 3명</small></div><div class="players">${state.players.map((p, i) => `<div class="player-chip">${avatar(p, i)}<div><div class="player-name">${esc(p.name)}<small>${p.id === room.id ? '나' : ''}${p.id === state.hostId ? ' ♛' : ''}</small></div><div class="player-status ${p.ready ? 'ready-dot' : ''}">${!p.online ? '다시 연결 중…' : p.ready ? '✓ 준비 완료!' : '준비하는 중'}</div></div></div>`).join('')}${state.players.length < 3 ? '<div class="player-chip empty-player">+ 친구를 기다려요</div>' : ''}</div><div class="ready-panel"><h3>${mine?.ready ? '준비 완료, 두근두근!' : state.settings.puzzle === 'personal' ? '나만의 비밀 숫자' : '함께 맞힐 준비됐나요?'}</h3>${mine?.ready ? '<div class="ready-message"><b>✓ 출전 준비를 마쳤어요!</b>모두 준비하면 방장이 경기를 시작해요.</div>' : `<p class="subtext">${state.settings.puzzle === 'personal' ? `서로 다른 ${state.settings.digits}개의 숫자. 친구에게는 비밀이에요!` : '정답은 게임이 시작될 때 무작위로 정해져요.'}</p><form id="ready-form">${state.settings.puzzle === 'personal' ? `<div class="secret-row"><label class="sr-only" for="secret">내 비밀 숫자</label><input id="secret" class="text-input number-input" inputmode="numeric" type="${showSecret ? 'text' : 'password'}" maxlength="${state.settings.digits}" autocomplete="off" placeholder="${'•'.repeat(state.settings.digits)}" value="${esc(secretDraft)}" required><button class="icon-button" type="button" data-action="toggle-secret" aria-label="${showSecret ? '비밀 숫자 숨기기' : '비밀 숫자 보기'}">${showSecret ? '◉' : '◎'}</button></div><button class="text-button" type="button" data-action="random-secret">🎲 랜덤으로 골라 줘</button>` : '<div class="room-tip">같은 숫자, 서로 다른 추리!<br>친구의 추측도 힌트로 활용해 보세요.</div>'}<button class="button lime full" style="margin-top:16px" ${actionBusy ? 'disabled' : ''}>${actionBusy ? '준비하는 중…' : '준비됐어요! ✓'}</button></form>`}</div>${isHost() ? `<div class="host-start"><button class="button primary full" data-action="start" ${state.players.length < 2 || !state.players.every(p => p.ready && p.online) || actionBusy ? 'disabled' : ''}>경기 시작! <span>→</span></button><p class="subtext">${state.players.length < 2 ? '친구가 한 명 이상 들어오면 시작할 수 있어요.' : '모두 준비됐는지 확인하고 시작해 주세요.'}</p></div>` : ''}</section></div>`;
}
function scoreboard() {
  const needed = state.settings.puzzle === 'personal' ? roster().length - 1 : 1;
  return `<div class="scoreboard">${roster().map((p, i) => `<div class="score-card ${state.phase === 'playing' && state.settings.mode === 'turn' && state.players[state.turn]?.id === p.id ? 'current' : ''}">${avatar(p, i)}<div class="player-name">${esc(p.name)}${p.id === room.id ? ' <small>나</small>' : ''}</div><div class="score-progress"><b>${state.solved[p.id]?.length || 0}</b> / ${needed} 정답</div>${!p.online ? '<div class="player-status">연결 기다리는 중</div>' : ''}</div>`).join('')}</div>`;
}
function feed() {
  const records = state.history.filter(h => filter === 'all' || h.player === room.id).toReversed();
  return `<section class="card feed-card"><div class="section-top"><h3>우리의 추리 기록</h3><span class="feed-label">모두에게 공개</span></div><p class="subtext">친구의 힌트도 놓치지 마세요!</p><div class="feed-filter"><button data-filter="all" class="${filter === 'all' ? 'active' : ''}">모두 ${state.history.length}</button><button data-filter="mine" class="${filter === 'mine' ? 'active' : ''}">내 추측 ${state.history.filter(h => h.player === room.id).length}</button></div><div class="feed" role="log" aria-label="공개 추측 기록" aria-live="polite">${records.length ? records.map(h => `<article class="attempt ${h.strikes === state.settings.digits ? 'won' : ''}"><div class="attempt-top"><b>${esc(nameOf(h.player))}</b><span>→ ${esc(nameOf(h.target))}</span><time>#${String(h.id).padStart(2, '0')}</time></div><div class="attempt-result"><span class="attempt-number">${h.guess}</span><span>${h.strikes === 0 && h.balls === 0 ? '<span class="pill out">OUT</span>' : `<span class="pill strike">${h.strikes} S</span> <span class="pill ball">${h.balls} B</span>`}</span></div>${h.strikes === state.settings.digits ? '<p class="subtext text-green">✦ 정답! 멋진 추리였어요.</p>' : ''}</article>`).join('') : '<div class="empty-feed"><span class="empty-icon">⚾</span><b>첫 공을 기다리고 있어요</b><p>숫자를 던지면 여기에<br>우리의 추리가 차곡차곡 쌓여요.</p></div>'}</div><div class="legend"><span><b class="text-green">S</b> 숫자 + 자리 일치</span><span><b class="text-orange">B</b> 숫자만 일치</span></div></section>`;
}
function pressure() {
  if (state.settings.puzzle !== 'personal') return '';
  const attacks = state.history.filter(h => h.target === room.id);
  const best = attacks.toSorted((a, b) => (b.strikes * 2 + b.balls) - (a.strikes * 2 + a.balls))[0];
  const percent = best ? (best.strikes * 2 + best.balls) / (state.settings.digits * 2) * 100 : 0;
  return `<aside class="pressure"><div class="pressure-title">${percent >= 100 ? '😳 들켰다! 그래도 내 도전은 계속!' : percent >= 50 ? '😰 두근두근… 내 숫자가 위험해요!' : '🤫 내 비밀, 아직은 안전할까?'}</div><p>${best ? `${esc(nameOf(best.player))} 님이 ${best.strikes} 스트라이크 ${best.balls} 볼까지 찾아냈어요!` : '친구가 내 숫자에 가까워지면 여기에 알려줄게요.'}</p><div class="pressure-track" role="meter" aria-label="내 숫자에 가장 가까운 추측" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}"><span style="width:${percent}%"></span></div></aside>`;
}
function play() {
  const targets = state.settings.puzzle === 'personal' ? state.players.filter(p => p.id !== room.id && !state.solved[room.id]?.includes(p.id)) : [];
  if (!targets.some(p => p.id === target)) target = targets[0]?.id || 'common';
  return `<div class="game-layout"><div class="game-main">${scoreboard()}<div class="game-banner"><span aria-hidden="true">${state.settings.mode === 'turn' ? '↻' : 'ϟ'}</span><div><b id="turn-label"></b><p id="turn-description"></p></div><span class="timer" id="timer"></span></div><section class="card guess-card"><div class="section-top"><h3>이번엔 어떤 숫자일까?</h3><small>${state.settings.digits}자리 · 중복 없이</small></div>${state.settings.puzzle === 'personal' ? `<p class="subtext">누구의 숫자를 맞힐까요?</p><div class="target-picker">${targets.map(p => `<button class="target ${target === p.id ? 'selected' : ''}" data-target="${p.id}" aria-pressed="${target === p.id}">${esc(p.name)}<small>비밀 숫자 맞히기</small></button>`).join('')}</div>` : '<p class="subtext" style="margin-bottom:18px">🎲 친구들과 같은 정답에 도전하고 있어요.</p>'}<form id="guess-form"><label class="sr-only" for="guess">추측할 숫자</label><input class="text-input number-input" id="guess" inputmode="numeric" autocomplete="off" maxlength="${state.settings.digits}" placeholder="${'·'.repeat(state.settings.digits)}" value="${esc(guessDraft)}"><div class="keypad" aria-label="숫자 키패드">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'clear', 0, 'back'].map(n => `<button type="button" data-key="${n}" class="${typeof n === 'number' ? guessDraft.includes(n) ? 'used' : '' : 'tool-key'}" aria-label="${n === 'clear' ? '숫자 모두 지우기' : n === 'back' ? '마지막 숫자 지우기' : n}">${n === 'clear' ? '다 지우기' : n === 'back' ? '⌫ 지우기' : n}</button>`).join('')}</div><button class="button primary full guess-submit" id="guess-submit">숫자 던지기 <span>↗</span></button><p class="guess-hint" id="guess-hint">맨 앞에 0도 괜찮아요. 천천히 생각해 보세요!</p></form></section>${pressure()}${state.settings.puzzle === 'personal' ? `<div class="my-secret">내 비밀 숫자 <b>${showSecret ? esc(localSecret) : '•'.repeat(state.settings.digits)}</b> <button class="text-button" data-action="toggle-secret">${showSecret ? '숨기기' : '잠깐 보기'}</button></div>` : ''}</div>${feed()}</div>`;
}
function result() {
  const winner = roster().find(p => p.id === state.winner);
  return `<div class="game-layout"><div class="game-main"><section class="card result-card"><span class="confetti" aria-hidden="true">✦</span><span class="confetti right" aria-hidden="true">✳</span><span class="result-icon">${winner ? '🏆' : '⚾'}</span><span class="eyebrow">${winner ? 'WHAT A GREAT GAME!' : 'SEE YOU NEXT ROUND'}</span><h2>${winner ? `${esc(winner.name)} 님의 승리!` : '이번 경기는 여기까지!'}</h2><p>${winner ? '끝까지 생각한 우리 모두, 잘했어요 👏' : esc(state.reason)}</p><div class="answer-list">${Object.entries(state.answers || {}).map(([id, answer]) => `<div class="answer-item">${esc(nameOf(id))}<b>${answer}</b></div>`).join('')}</div>${isHost() ? '<button class="button primary full" data-action="rematch">한 판 더 할까요? <span>↻</span></button>' : '<p class="subtext">방장이 다음 경기를 열면 다시 준비해 주세요.</p>'}</section>${scoreboard()}<div class="room-tip">💡 기록을 보며 이야기해 봐요.<br>어떤 힌트가 정답을 찾는 데 가장 도움이 됐나요?</div></div>${feed()}</div>`;
}
function render() {
  const active = document.activeElement, focused = active?.id, selection = active instanceof HTMLInputElement ? active.selectionStart : null;
  const feedScroll = $('.feed')?.scrollTop || 0;
  $('#app').innerHTML = state ? pageTop() + (state.phase === 'lobby' ? lobby() : state.phase === 'playing' ? play() : result()) : landing();
  if (focused && document.getElementById(focused)) {
    const element = document.getElementById(focused); element.focus({ preventScroll: true });
    if (selection !== null && element instanceof HTMLInputElement) element.setSelectionRange(selection, selection);
  }
  if ($('.feed') && feedScroll > 0) $('.feed').scrollTop = feedScroll;
  updateClock();
}
function updateClock() {
  if (!state || state.phase !== 'playing') return;
  const isTurn = state.settings.mode === 'speed' || state.players[state.turn]?.id === room.id;
  const waiting = status !== 'online' || state.paused;
  const remaining = Math.max(0, Math.ceil((state.deadline - room.now()) / 1000));
  const elapsed = Math.max(0, Math.floor((room.now() - state.startedAt) / 1000));
  if ($('#turn-label')) $('#turn-label').textContent = waiting ? '친구와 다시 연결하는 중' : state.settings.mode === 'speed' ? '누가 먼저 정답을 찾을까요?' : isTurn ? '내 차례예요! 숫자를 던져요.' : `${nameOf(state.players[state.turn]?.id)} 님의 차례`;
  if ($('#turn-description')) $('#turn-description').textContent = waiting ? '연결을 기다리는 동안 경기를 잠시 쉬어요.' : state.settings.mode === 'speed' ? '차례 없이 동시에! 친구의 힌트도 살펴보세요.' : '45초가 지나면 다음 친구에게 공이 넘어가요.';
  if ($('#timer')) $('#timer').textContent = waiting ? 'Ⅱ' : state.settings.mode === 'turn' ? `${remaining}s` : `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const button = $('#guess-submit');
  if (button) {
    const cooling = Date.now() < cooldownUntil;
    button.disabled = waiting || !isTurn || actionBusy || cooling || !validNumber(guessDraft, state.settings.digits) || (state.settings.mode === 'turn' && remaining === 0);
    button.innerHTML = waiting ? '연결을 기다려 주세요' : !isTurn ? '친구의 차례예요' : actionBusy ? '공을 던지는 중…' : cooling ? '잠깐, 다음 숫자를 생각해요!' : '숫자 던지기 <span>↗</span>';
  }
}
async function action(fn) {
  if (actionBusy) return;
  actionBusy = true; render();
  try { await fn(); } catch (err) { toast(err.message); }
  finally { actionBusy = false; render(); }
}
async function enter() {
  if (busy) return;
  nickname = nickname.trim(); if (!nickname || nickname.length > 10) return toast('별명을 1~10글자로 적어 주세요.');
  if (entryTab === 'join' && !/^\d{6}$/.test(codeDraft)) return toast('방 코드 숫자 6개를 적어 주세요.');
  busy = true; render();
  const candidate = new Room(nickname, onState, connection, closeRoom); room = candidate;
  try { await candidate.connect(); if (entryTab === 'create') await candidate.create(); else await candidate.join(codeDraft); history.replaceState(null, '', `#${candidate.code}`); }
  catch (err) { candidate.close(false); if (room === candidate) closeRoom(); toast(err.message); }
  finally { busy = false; render(); }
}
async function copy(text, success) {
  try { await navigator.clipboard.writeText(text); toast(success); }
  catch { toast(`복사가 안 되면 직접 알려 주세요: ${state.code.slice(0, 3)} ${state.code.slice(3)}`); }
}
$('#app').addEventListener('input', e => {
  const { id } = e.target;
  if (id === 'nickname') nickname = e.target.value;
  else if (id === 'room-code') { codeDraft = e.target.value.replace(/\D/g, '').slice(0, 6); e.target.value = codeDraft; }
  else if (id === 'secret') { secretDraft = e.target.value.replace(/\D/g, '').slice(0, state.settings.digits); e.target.value = secretDraft; }
  else if (id === 'guess') { guessDraft = e.target.value.replace(/\D/g, '').slice(0, state.settings.digits); e.target.value = guessDraft; updateClock(); document.querySelectorAll('[data-key]').forEach(key => key.classList.toggle('used', /^\d$/.test(key.dataset.key) && guessDraft.includes(key.dataset.key))); }
});
$('#app').addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'entry-form') enter();
  else if (e.target.id === 'ready-form') {
    if (state.settings.puzzle === 'personal' && !validNumber(secretDraft, state.settings.digits)) return toast(`겹치지 않는 숫자 ${state.settings.digits}개를 골라 주세요.`);
    const chosen = state.settings.puzzle === 'personal' ? secretDraft : '';
    action(async () => { await room.ready(chosen); localSecret = chosen; });
  } else if (e.target.id === 'guess-form' && !$('#guess-submit').disabled) {
    const guess = guessDraft, to = target;
    action(async () => { await room.request('guess', { guess, target: to }); guessDraft = ''; cooldownUntil = Date.now() + COOLDOWN_MS; });
  }
});
$('#app').addEventListener('click', e => {
  const button = e.target.closest('button'); if (!button || button.disabled) return;
  const d = button.dataset;
  if (d.entry && !busy) { entryTab = d.entry; render(); }
  else if (d.setting) action(() => room.request('settings', { ...state.settings, [d.setting]: d.setting === 'digits' ? Number(d.value) : d.value }));
  else if (d.target) { target = d.target; render(); }
  else if (d.filter) { filter = d.filter; render(); }
  else if (d.key !== undefined) {
    if (d.key === 'clear') guessDraft = '';
    else if (d.key === 'back') guessDraft = guessDraft.slice(0, -1);
    else if (!guessDraft.includes(d.key) && guessDraft.length < state.settings.digits) guessDraft += d.key;
    else if (guessDraft.includes(d.key)) toast('같은 숫자는 한 번만 쓸 수 있어요.');
    render();
  } else if (d.action === 'toggle-secret') { showSecret = !showSecret; render(); }
  else if (d.action === 'random-secret') { secretDraft = randomNumber(state.settings.digits); render(); toast('비밀 숫자를 골랐어요! 보기 버튼으로 확인할 수 있어요.'); }
  else if (d.action === 'start') action(() => room.request('start'));
  else if (d.action === 'rematch') action(() => room.request('rematch'));
  else if (d.action === 'copy-code') copy(state.code, '방 코드를 복사했어요. 친구에게 알려 주세요!');
  else if (d.action === 'copy-link') copy(`${location.origin}${location.pathname}#${state.code}`, '초대 링크를 복사했어요!');
  else if (d.action === 'leave') { $('#leave-message').textContent = isHost() ? '방장이 나가면 방이 닫혀요. 친구들도 새 방에 모여야 해요.' : state.phase === 'playing' ? '경기 중에 나가면 이번 경기가 끝나요.' : '나중에 방 코드로 다시 들어올 수 있어요.'; $('#leave-dialog').showModal(); }
});
$('#help').addEventListener('click', () => $('#rules').showModal());
$('#stay').addEventListener('click', () => $('#leave-dialog').close());
$('#confirm-leave').addEventListener('click', () => { $('#leave-dialog').close(); room?.close(); closeRoom('방에서 나왔어요. 다음에 또 만나요!'); });
$('#sound').addEventListener('click', () => { sound = !sound; $('#sound').innerHTML = sound ? '♪' : '♪<span class="sound-off">off</span>'; $('#sound').setAttribute('aria-label', sound ? '효과음 끄기' : '효과음 켜기'); $('#sound').title = sound ? '효과음 끄기' : '효과음 켜기'; tone(); });
window.addEventListener('beforeunload', e => { if (state) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('pagehide', () => room?.close());
window.addEventListener('hashchange', () => {
  if (!state && !busy && /^#\d{6}$/.test(location.hash)) { codeDraft = location.hash.slice(1); entryTab = 'join'; render(); }
});
setInterval(updateClock, 200);
render();

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const hudEl = document.getElementById('hud');
  const phasePanel = document.getElementById('phasePanel');
  const controls = document.getElementById('controls');
  let transientNotice = { text: '', until: 0 };

  const state = {
    gameState: 'battle',
    innerPhase: null,
    floor: 1,
    rewardCandidates: [],
    rewardSelected: new Set(),
    rewardMeta: { candidateCount: 2, pickCount: 1 },
    statusEffects: [],
    원영사용됨: false,
    정령왕사용됨: false,
    헤일로사용됨: false,
    헤일로강화준비: false,
    빙백연혼사용됨: false,
    자기상환배수: 1,
  };

  const player = {
    name: '하르벤', title: '수확하는 자', mantra: '낫',
    level: 1, coin: 0,
    str: 1, agi: 1, vit: 1, int: 1, wis: 1, looks: 1,
    outer: 0, inner: 0, swordAura: 0, multicasting: 1,
    x: 150, y: 280, w: 30, h: 50, vx: 0, vy: 0,
    hp: 10, mp: 15,
    attackCooldown: 0, dashCooldown: 0, facing: 1,
    knownMagic: [], inventory: []
  };

  const enemy = { alive: true, x: 740, y: 280, w: 34, h: 48, vx: 0, hp: 16, maxHp: 16, atk: 3, attackCd: 0 };

  const keys = { left:false,right:false,jump:false,dash:false,attack:false,skill:false,magic:false };
  const auraTable = {
    0: { mult:1, mp:0 },1:{ mult:1.5, mp:-50 },2:{ mult:2, mp:-150 },3:{ mult:5, mp:-300 },
    4:{ mult:20, mp:-700 },5:{ mult:50, mp:-500 },6:{ mult:50, mp:1000000 }
  };

  function totalStatPoints() { return 60 + (player.level - 1) * 3; }
  function spentStats() { return player.str+player.agi+player.vit+player.int+player.wis+player.looks; }
  function remainingPoints() { return totalStatPoints() - spentStats(); }
  function statMax() { return player.level < 80 ? player.level + 20 : 100; }

  function computeDerived() {
    const maxHpBase = player.vit * 10;
    const maxMpBase = player.level * 5 + player.int * 10;
    const aura = auraTable[player.swordAura] || auraTable[0];
    const maxHp = Math.floor(maxHpBase * (1.4 ** player.outer));
    const maxMp = Math.max(0, Math.floor((maxMpBase * (1.2 ** player.inner)) + aura.mp));
    const mpRegen = Math.floor((player.level + player.wis * 2) * (1.2 ** player.inner));
    const baseAtk = Math.floor((player.str + player.vit) / 10) + 2;
    const atk = Math.floor(baseAtk * aura.mult);
    return { maxHp, maxMp, mpRegen, baseAtk, atk, auraMpMod: aura.mp };
  }

  let derived = computeDerived();
  function resetInput() {
    keys.left = false; keys.right = false; keys.jump = false;
    keys.dash = false; keys.attack = false; keys.skill = false; keys.magic = false;
  }
  function resetRewardState() {
    state.rewardCandidates = [];
    state.rewardSelected = new Set();
    state.rewardMeta = { candidateCount: 2, pickCount: 1 };
  }

  function syncVitals() {
    derived = computeDerived();
    player.hp = Math.min(player.hp, derived.maxHp);
    player.mp = Math.min(player.mp, derived.maxMp);
    player.hp = Math.max(0, player.hp);
  }

  function spawnEnemy() {
    enemy.alive = true;
    enemy.maxHp = 12 + state.floor * 8;
    enemy.hp = enemy.maxHp;
    enemy.atk = 2 + state.floor * 2;
    enemy.x = 720;
    enemy.attackCd = 0;
  }
  function resetPlayerForBattle() {
    player.x = 150; player.y = 280; player.vx = 0; player.vy = 0;
    player.attackCooldown = 0; player.dashCooldown = 0; player.facing = 1;
    syncVitals();
    player.hp = derived.maxHp;
    player.mp = derived.maxMp;
  }

  function clearReset() {
    syncVitals();
    player.hp = derived.maxHp;
    player.mp = derived.maxMp;
    state.statusEffects = [];
    state.원영사용됨 = false;
    state.정령왕사용됨 = false;
    state.헤일로사용됨 = false;
    state.헤일로강화준비 = false;
    state.빙백연혼사용됨 = false;
    state.자기상환배수 = 1;
  }

  function applyFiveLevelPlus() {
    player.level += 5;
    syncVitals();
    player.hp = derived.maxHp;
    player.mp = derived.maxMp;
  }

  function rewardConfig() {
    const l = player.looks;
    if (l >= 100) return { candidateCount: 10, pickCount: 5 };
    if (l >= 90) return { candidateCount: 10, pickCount: 4 };
    if (l >= 80) return { candidateCount: 10, pickCount: 3 };
    if (l >= 70) return { candidateCount: 9, pickCount: 3 };
    if (l >= 60) return { candidateCount: 8, pickCount: 3 };
    if (l >= 50) return { candidateCount: 7, pickCount: 2 };
    if (l >= 40) return { candidateCount: 6, pickCount: 2 };
    if (l >= 30) return { candidateCount: 5, pickCount: 2 };
    if (l >= 20) return { candidateCount: 4, pickCount: 1 };
    if (l >= 10) return { candidateCount: 3, pickCount: 1 };
    return { candidateCount: 2, pickCount: 1 };
  }

  function rollWeighted(entries) {
    const sum = entries.reduce((a,b)=>a+b.weight,0);
    let r = Math.random() * sum;
    for (const e of entries){ r -= e.weight; if (r <= 0) return e.name; }
    return entries[entries.length-1].name;
  }

  function rewardRoll() {
    state.rewardMeta = rewardConfig();
    state.rewardCandidates = [];
    state.rewardSelected = new Set();
    const pool = [
      {name:'스킬 초기화권',weight:5},{name:'무공서',weight:10},{name:'마법서',weight:25},
      {name:'추가 코인 +1',weight:40},{name:'추가 코인 +2',weight:20}
    ];
    const martial = [{name:'외공서',weight:40},{name:'내공서',weight:40},{name:'검기',weight:20}];
    const magic = [{name:'기초 마법서',weight:50},{name:'중급 마법서',weight:30},{name:'고급 마법서',weight:10},{name:'멀티캐스팅의 서',weight:9},{name:'마도서',weight:1}];
    for(let i=0;i<state.rewardMeta.candidateCount;i++){
      let r = rollWeighted(pool);
      if(r==='무공서') r = rollWeighted(martial);
      if(r==='마법서') r = rollWeighted(magic);
      state.rewardCandidates.push(r);
    }
  }

  function applyReward(name) {
    if (name === '추가 코인 +1') player.coin += 1;
    else if (name === '추가 코인 +2') player.coin += 2;
    else player.inventory.push(name);
  }

  function enterInnerWorld() {
    state.gameState = 'innerWorld';
    state.innerPhase = 'clearReset';
    resetInput();
    resetRewardState();
    transientNotice = { text: '', until: 0 };
  }

  function goNextFloor() {
    state.floor += 1;
    state.gameState = 'battle';
    state.innerPhase = null;
    resetRewardState();
    resetInput();
    transientNotice = { text: '', until: 0 };
    resetPlayerForBattle();
    spawnEnemy();
  }

  function tryLearnMagic(book) {
    const diffMap = {'기초 마법서':50,'중급 마법서':70,'고급 마법서':100,'마도서':100};
    const diff = diffMap[book];
    if (!diff) return { ok: false, reason: 'not_magic_book' };
    const success = player.wis >= diff || (Math.floor(Math.random() * diff) + 1) < player.wis;
    if (success && !player.knownMagic.includes(book)) player.knownMagic.push(book);
    return { ok: success, reason: success ? 'learned' : 'failed_retryable' };
  }

  function renderHUD() {
    syncVitals();
    hudEl.innerHTML = `
      <div><span class="tag">이름</span>: ${player.name}</div>
      <div><span class="tag">칭호</span>: ${player.title}</div>
      <div><span class="tag">만트라</span>: ${player.mantra}</div>
      <div><span class="tag">현재 상태</span>: ${state.gameState === 'battle' ? '전투' : (state.gameState === 'innerWorld' ? '심상세계' : '패배')}</div>
      <hr />
      <div>층: ${state.floor} | 레벨: ${player.level} | 코인: ${player.coin}</div>
      <div>남은 포인트: ${remainingPoints()} (총 ${totalStatPoints()}, 최대스탯 ${statMax()})</div>
      <div>힘/민첩/체력/지능/지혜/외모: ${player.str}/${player.agi}/${player.vit}/${player.int}/${player.wis}/${player.looks}</div>
      <div>HP: ${Math.floor(player.hp)} / ${derived.maxHp}</div>
      <div>MP: ${Math.floor(player.mp)} / ${derived.maxMp}</div>
      <div>검기 MP 보정: ${derived.auraMpMod >= 0 ? '+' : ''}${derived.auraMpMod}</div>
      <div>MP 회복량: ${derived.mpRegen}</div>
      <div>기본 평타: ${derived.baseAtk}</div>
      <div>최종 평타: ${derived.atk}</div>
      <div>외공/내공/검기/멀티캐스팅: ${player.outer}/${player.inner}/${player.swordAura}/${player.multicasting}</div>
      <div class="enemy">적 HP: ${enemy.alive ? Math.max(0, Math.floor(enemy.hp)) + ' / ' + enemy.maxHp : '처치됨'}</div>
      <div>인벤토리: ${player.inventory.length ? player.inventory.join(', ') : '없음'}</div>
    `;
  }

  function renderPhasePanel() {
    const notice = transientNotice.until > Date.now() ? `<div class="warn">${transientNotice.text}</div>` : '';
    if (state.gameState === 'battle') {
      phasePanel.innerHTML = `<div>전투 진행 중... 적을 처치하면 심상세계로 진입합니다.</div><div>적 HP: ${enemy.alive ? Math.max(0, Math.floor(enemy.hp)) + ' / ' + enemy.maxHp : '처치됨'}</div>${notice}`;
      return;
    }
    if (state.gameState === 'defeated') {
      phasePanel.innerHTML = '<div class="enemy">패배: HP가 0이 되어 전투에서 쓰러졌습니다.</div><button id="restartRun">처음부터 다시 시작</button>';
      document.getElementById('restartRun').onclick = restartFromDefeat;
      return;
    }
    const p = state.innerPhase;
    if (p === 'clearReset') {
      phasePanel.innerHTML = '<div>1) clearReset 단계</div><button id="btnClear">Clear Reset 실행</button>';
      document.getElementById('btnClear').onclick = () => { clearReset(); state.innerPhase='fiveLevelPlus'; };
    } else if (p === 'fiveLevelPlus') {
      phasePanel.innerHTML = '<div>2) fiveLevelPlus 단계</div><button id="btnLvl">+5 레벨 적용</button>';
      document.getElementById('btnLvl').onclick = () => { applyFiveLevelPlus(); state.innerPhase='rewardRoll'; };
    } else if (p === 'rewardRoll') {
      phasePanel.innerHTML = '<div>3) rewardRoll 단계</div><button id="btnRoll">보상 굴리기</button>';
      document.getElementById('btnRoll').onclick = () => { rewardRoll(); state.innerPhase='rewardPick'; };
    } else if (p === 'rewardPick') {
      const picks = [...state.rewardSelected];
      phasePanel.innerHTML = `<div>4) rewardPick (${picks.length}/${state.rewardMeta.pickCount})</div>` +
        state.rewardCandidates.map((r,i)=>`<button class="pick" data-idx="${i}">${state.rewardSelected.has(i)?'✅':''}${r}</button>`).join('') +
        '<div><button id="confirmReward">보상 확정</button></div>';
      phasePanel.querySelectorAll('.pick').forEach(btn=>btn.onclick=()=>{
        const idx = Number(btn.dataset.idx);
        if (state.rewardSelected.has(idx)) state.rewardSelected.delete(idx);
        else if (state.rewardSelected.size < state.rewardMeta.pickCount) state.rewardSelected.add(idx);
        renderPhasePanel();
      });
      document.getElementById('confirmReward').onclick = () => {
        if (state.rewardSelected.size !== state.rewardMeta.pickCount) return;
        [...state.rewardSelected].forEach(i => applyReward(state.rewardCandidates[i]));
        state.innerPhase = 'statAllocate';
      };
    } else if (p === 'statAllocate') {
      phasePanel.innerHTML = '<div>5) statAllocate</div><button id="skipStat">스탯 분배 건너뛰기</button>';
      document.getElementById('skipStat').onclick = () => state.innerPhase='skillTechMagicTrait';
    } else if (p === 'skillTechMagicTrait') {
      phasePanel.innerHTML = '<div>6) skillTechMagicTrait</div><button id="skipSTM">기술/마법서 처리 건너뛰기</button>';
      document.getElementById('skipSTM').onclick = () => state.innerPhase='shop';
    } else if (p === 'shop') {
      phasePanel.innerHTML = '<div>7) shop</div><button id="skipShop">상점 건너뛰기</button>';
      document.getElementById('skipShop').onclick = () => state.innerPhase='nextFloor';
    } else if (p === 'nextFloor') {
      phasePanel.innerHTML = '<div>8) nextFloor</div><button id="goNext">다음 층 진입</button>';
      document.getElementById('goNext').onclick = goNextFloor;
    }
  }

  function rectHit(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

  function showBattleNotice(text) {
    if (state.gameState !== 'battle') return;
    transientNotice = { text, until: Date.now() + 1500 };
  }

  function restartFromDefeat() {
    state.floor = 1;
    state.gameState = 'battle';
    state.innerPhase = null;
    resetRewardState();
    resetInput();
    transientNotice = { text: '', until: 0 };
    state.statusEffects = [];
    state.원영사용됨 = false;
    state.정령왕사용됨 = false;
    state.헤일로사용됨 = false;
    state.헤일로강화준비 = false;
    state.빙백연혼사용됨 = false;
    state.자기상환배수 = 1;
    player.level = 1;
    player.coin = 0;
    player.str = 1; player.agi = 1; player.vit = 1; player.int = 1; player.wis = 1; player.looks = 1;
    player.outer = 0; player.inner = 0; player.swordAura = 0; player.multicasting = 1;
    player.inventory = [];
    player.knownMagic = [];
    resetPlayerForBattle();
    spawnEnemy();
  }

  function updateBattle(dt) {
    if (keys.skill) { showBattleNotice('스킬은 아직 미구현입니다.'); keys.skill = false; }
    if (keys.magic) { showBattleNotice('마법은 아직 미구현입니다.'); keys.magic = false; }
    const speed = 230;
    if (keys.left) { player.vx = -speed; player.facing = -1; }
    else if (keys.right) { player.vx = speed; player.facing = 1; }
    else player.vx *= 0.7;

    const onGround = player.y >= 280;
    if (keys.jump && onGround) player.vy = -420;
    if (keys.dash && player.dashCooldown <= 0) { player.vx = player.facing * 500; player.dashCooldown = 0.55; }
    if (keys.attack && player.attackCooldown <= 0) {
      player.attackCooldown = 0.3;
      if (enemy.alive) {
        const range = 60;
        const inFront = player.facing === 1 ? (enemy.x - (player.x + player.w) <= range && enemy.x >= player.x) : (player.x - (enemy.x + enemy.w) <= range && enemy.x <= player.x);
        if (inFront && Math.abs(enemy.y - player.y) < 60) enemy.hp -= derived.atk;
      }
    }

    player.vy += 900 * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));
    if (player.y >= 280) { player.y = 280; player.vy = 0; }
    player.attackCooldown -= dt; player.dashCooldown -= dt;

    if (enemy.alive) {
      const dir = Math.sign(player.x - enemy.x);
      enemy.x += dir * 120 * dt;
      enemy.x = Math.max(0, Math.min(canvas.width - enemy.w, enemy.x));
      enemy.attackCd -= dt;
      if (Math.abs(player.x - enemy.x) < 42 && enemy.attackCd <= 0) { player.hp -= enemy.atk; enemy.attackCd = 0.9; }
      if (enemy.hp <= 0) { enemy.alive = false; enterInnerWorld(); }
    }
    if (player.hp <= 0) {
      player.hp = 0;
      state.gameState = 'defeated';
      state.innerPhase = null;
      resetInput();
      transientNotice = { text: '', until: 0 };
    }
  }

  function renderCanvas() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#1e2f45'; ctx.fillRect(0,330,canvas.width,30);
    ctx.fillStyle = '#6be675'; ctx.fillRect(player.x, player.y, player.w, player.h);
    if (enemy.alive) { ctx.fillStyle = '#ff6b6b'; ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h); }
    if (keys.skill) { ctx.fillStyle='#ffe066'; ctx.fillRect(10,10,20,20); }
    if (keys.magic) { ctx.fillStyle='#a29bfe'; ctx.fillRect(40,10,20,20); }
  }

  function loop(t) {
    if (!loop.last) loop.last = t;
    const dt = Math.min(0.033, (t - loop.last) / 1000);
    loop.last = t;
    if (state.gameState === 'battle') updateBattle(dt);
    renderCanvas();
    renderHUD();
    renderPhasePanel();
    requestAnimationFrame(loop);
  }

  const keyMap = {
    ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'jump',w:'jump',' ':'jump',Shift:'dash',j:'attack',k:'skill',l:'magic'
  };
  window.addEventListener('keydown', e => { const a = keyMap[e.key]; if (a){ keys[a]=true; e.preventDefault(); } });
  window.addEventListener('keyup', e => { const a = keyMap[e.key]; if (a){ keys[a]=false; e.preventDefault(); } });

  controls.querySelectorAll('button').forEach(btn => {
    const a = btn.dataset.action;
    const on = ev => { ev.preventDefault(); keys[a]=true; };
    const off = ev => { ev.preventDefault(); keys[a]=false; };
    btn.addEventListener('pointerdown', on, { passive:false });
    btn.addEventListener('pointerup', off, { passive:false });
    btn.addEventListener('pointercancel', off, { passive:false });
    btn.addEventListener('pointerleave', off, { passive:false });
    btn.addEventListener('touchstart', on, { passive:false });
    btn.addEventListener('touchend', off, { passive:false });
    btn.addEventListener('mousedown', on); btn.addEventListener('mouseup', off); btn.addEventListener('mouseleave', off);
  });

  function runDebugTests() {
    const backupState = {
      gameState: state.gameState,
      innerPhase: state.innerPhase,
      floor: state.floor,
      rewardCandidates: [...state.rewardCandidates],
      rewardSelected: new Set([...state.rewardSelected]),
      rewardMeta: JSON.parse(JSON.stringify(state.rewardMeta)),
      statusEffects: JSON.parse(JSON.stringify(state.statusEffects)),
    };
    const backupPlayer = JSON.parse(JSON.stringify(player));
    const backupEnemy = JSON.parse(JSON.stringify(enemy));
    const backupDerived = JSON.parse(JSON.stringify(derived));
    const backupNotice = { ...transientNotice };
    const results = {};
    try {
      const oldLooks = player.looks; player.looks = 1;
      const rc = rewardConfig(); results.rewardConfigLooks1 = rc.candidateCount === 2 && rc.pickCount === 1;
      player.looks = oldLooks;

      const oldStr = player.str, oldVit = player.vit;
      player.str = 1; player.vit = 1; syncVitals();
      results.attackFormulaDiv10 = computeDerived().baseAtk === (Math.floor((1+1)/10)+2);
      player.str = oldStr; player.vit = oldVit; syncVitals();

      state.gameState = 'battle'; enemy.alive=true; enemy.hp = 0; updateBattle(0.016);
      results.enemyKillToInnerWorld = state.gameState === 'innerWorld' && state.innerPhase === 'clearReset';

      const c0 = player.coin; applyReward('추가 코인 +2'); results.rewardApplyCoin = player.coin === c0 + 2;
      const inv0 = player.inventory.length; applyReward('외공서'); results.rewardApplyInventory = player.inventory.length === inv0 + 1;

      state.floor = 1; state.gameState = 'innerWorld'; state.innerPhase = 'nextFloor';
      state.rewardCandidates = ['테스트']; state.rewardSelected = new Set([0]);
      player.x = 999; player.y = 10; player.vx = 3; player.vy = -2; player.attackCooldown = 1; player.dashCooldown = 1;
      player.hp = 1; player.mp = 1;
      goNextFloor();
      results.nextFloorBackToBattle = state.gameState === 'battle' && state.floor === 2 && enemy.alive;
      results.nextFloorResetsPlayer = player.x === 150 && player.y === 280 && player.vx === 0 && player.vy === 0 && player.attackCooldown === 0 && player.dashCooldown === 0;
      results.nextFloorClearsRewardState = state.rewardCandidates.length === 0 && state.rewardSelected.size === 0 && state.rewardMeta.candidateCount === 2 && state.rewardMeta.pickCount === 1;
      results.nextFloorRestoresHpMp = player.hp === derived.maxHp && player.mp === derived.maxMp;

      player.level = 1; player.int = 1; player.inner = 0; player.swordAura = 1; syncVitals();
      results.swordAuraMpModifierApplied = derived.maxMp === 0;

      const levelBeforeInner = player.level;
      const hpBeforeInner = Math.max(1, derived.maxHp - 1);
      const mpBeforeInner = Math.max(0, derived.maxMp - 1);
      player.hp = hpBeforeInner; player.mp = mpBeforeInner;
      enterInnerWorld();
      results.enterInnerWorldDoesNotAutoClearOrLevel = state.gameState === 'innerWorld' && state.innerPhase === 'clearReset' && player.level === levelBeforeInner && player.hp === hpBeforeInner && player.mp === mpBeforeInner;

      state.gameState = 'battle'; player.hp = 1; enemy.attackCd = 0; enemy.atk = 10; enemy.alive = true; enemy.x = player.x;
      updateBattle(0.016);
      results.playerDeathToDefeatState = state.gameState === 'defeated' && player.hp === 0;

      const xBeforeDefeat = player.x;
      const enemyHpBeforeDefeat = enemy.hp;
      keys.left = true; keys.attack = true;
      if (state.gameState === 'battle') updateBattle(0.016);
      results.defeatedStopsBattleInput = player.x === xBeforeDefeat && enemy.hp === enemyHpBeforeDefeat;

      state.gameState = 'battle'; keys.skill = true; keys.magic = true;
      updateBattle(0.016);
      results.skillMagicButtonsSafe = transientNotice.text.length > 0 && state.gameState === 'battle';

      state.gameState = 'defeated';
      state.floor = 7;
      player.level = 9; player.coin = 99; player.outer = 2;
      player.inventory = ['외공서']; player.knownMagic = ['기초 마법서'];
      restartFromDefeat();
      results.restartFromDefeatResetsRun = state.floor === 1 && state.gameState === 'battle' && state.innerPhase === null &&
        player.level === 1 && player.coin === 0 && player.outer === 0 && player.inner === 0 && player.swordAura === 0 &&
        player.inventory.length === 0 && player.knownMagic.length === 0 && player.hp === derived.maxHp && player.mp === derived.maxMp;
    } finally {
      Object.assign(player, backupPlayer);
      Object.assign(enemy, backupEnemy);
      state.gameState = backupState.gameState;
      state.innerPhase = backupState.innerPhase;
      state.floor = backupState.floor;
      state.rewardCandidates = [...backupState.rewardCandidates];
      state.rewardSelected = new Set([...backupState.rewardSelected]);
      state.rewardMeta = JSON.parse(JSON.stringify(backupState.rewardMeta));
      state.statusEffects = JSON.parse(JSON.stringify(backupState.statusEffects));
      resetInput();
      transientNotice = backupNotice;
      derived = computeDerived();
    }
    results.debugTestsRestoreState =
      state.gameState === backupState.gameState && state.innerPhase === backupState.innerPhase && state.floor === backupState.floor &&
      JSON.stringify(state.rewardCandidates) === JSON.stringify(backupState.rewardCandidates) &&
      JSON.stringify([...state.rewardSelected]) === JSON.stringify([...backupState.rewardSelected]) &&
      JSON.stringify(state.rewardMeta) === JSON.stringify(backupState.rewardMeta) && JSON.stringify(state.statusEffects) === JSON.stringify(backupState.statusEffects) &&
      player.level === backupPlayer.level && player.coin === backupPlayer.coin && player.hp === backupPlayer.hp && player.mp === backupPlayer.mp &&
      JSON.stringify(player.inventory) === JSON.stringify(backupPlayer.inventory) && JSON.stringify(player.knownMagic) === JSON.stringify(backupPlayer.knownMagic) &&
      player.x === backupPlayer.x && player.y === backupPlayer.y && enemy.alive === backupEnemy.alive && enemy.hp === backupEnemy.hp &&
      enemy.maxHp === backupEnemy.maxHp && enemy.x === backupEnemy.x && enemy.y === backupEnemy.y &&
      derived.maxHp === backupDerived.maxHp && derived.maxMp === backupDerived.maxMp && derived.mpRegen === backupDerived.mpRegen &&
      derived.baseAtk === backupDerived.baseAtk && derived.atk === backupDerived.atk;
    return results;
  }

  window.ManRPG = { state, player, enemy, rewardConfig, applyFiveLevelPlus, enterInnerWorld, goNextFloor, tryLearnMagic, runDebugTests };
  spawnEnemy();
  syncVitals();
  requestAnimationFrame(loop);
})();

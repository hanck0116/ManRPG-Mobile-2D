(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const hudEl = document.getElementById('hud');
  const phasePanel = document.getElementById('phasePanel');
  const controls = document.getElementById('controls');
  let transientNotice = { text: '', until: 0 };
  const SAVE_KEY = 'manrpg_mobile_2d_save_v1';

  const state = {
    gameState: 'initialStatAllocate',
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
    statAllocationBase: null,
    itemUseMessage: '',
    shopMessage: '',
    saveMessage: '',
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


  const statKeys = ['str', 'agi', 'vit', 'int', 'wis', 'looks'];

  function ensureStatAllocationBase() {
    if (state.statAllocationBase !== null) return;
    state.statAllocationBase = {
      str: player.str,
      agi: player.agi,
      vit: player.vit,
      int: player.int,
      wis: player.wis,
      looks: player.looks,
    };
  }

  function increaseStat(key) {
    if (!statKeys.includes(key)) return;
    if (remainingPoints() <= 0) return;
    if (player[key] >= statMax()) return;
    player[key] += 1;
    syncVitals();
    player.hp = derived.maxHp;
    player.mp = derived.maxMp;
  }

  function decreaseStat(key) {
    if (!statKeys.includes(key)) return;
    if (!state.statAllocationBase) return;
    const base = state.statAllocationBase[key];
    if (typeof base !== 'number') return;
    if (player[key] <= base) return;
    player[key] -= 1;
    syncVitals();
    player.hp = Math.min(player.hp, derived.maxHp);
    player.mp = Math.min(player.mp, derived.maxMp);
  }

  function finishStatAllocation() {
    state.statAllocationBase = null;
    state.innerPhase = 'skillTechMagicTrait';
  }

  function finishInitialStatAllocation() {
    if (remainingPoints() > 0) {
      transientNotice = { text: `경고: 남은 포인트 ${remainingPoints()}로 전투를 시작합니다.`, until: Date.now() + 2000 };
    } else {
      transientNotice = { text: '', until: 0 };
    }
    state.statAllocationBase = null;
    state.gameState = 'battle';
    state.innerPhase = null;
    state.itemUseMessage = '';
    state.shopMessage = '';
    resetInput();
    resetRewardState();
    syncVitals();
    player.hp = derived.maxHp;
    player.mp = derived.maxMp;
    spawnEnemy();
  }

  function applyRecommendedInitialStats() {
    if (state.gameState !== 'initialStatAllocate') return;
    ensureStatAllocationBase();
    player.str = 16;
    player.agi = 8;
    player.vit = 21;
    player.int = 5;
    player.wis = 5;
    player.looks = 5;
    syncVitals();
    player.hp = derived.maxHp;
    player.mp = derived.maxMp;
  }

  function removeInventoryAt(index) {
    if (!Number.isInteger(index) || index < 0 || index >= player.inventory.length) return null;
    const removed = player.inventory.splice(index, 1);
    return removed.length ? removed[0] : null;
  }

  function useInventoryItem(index, options = {}) {
    if (!Number.isInteger(index) || index < 0 || index >= player.inventory.length) return false;
    const item = player.inventory[index];
    const magicBooks = ['기초 마법서', '중급 마법서', '고급 마법서', '마도서'];

    if (item === '외공서') {
      player.outer += 1;
      removeInventoryAt(index);
      syncVitals();
      player.hp = derived.maxHp;
      state.itemUseMessage = '외공서 사용: 외공이 1 증가했습니다.';
      return true;
    }
    if (item === '내공서') {
      player.inner += 1;
      removeInventoryAt(index);
      syncVitals();
      player.mp = derived.maxMp;
      state.itemUseMessage = '내공서 사용: 내공이 1 증가했습니다.';
      return true;
    }
    if (item === '검기') {
      if (player.swordAura >= 6) {
        state.itemUseMessage = '검기는 이미 최대 단계입니다.';
        return false;
      }
      player.swordAura += 1;
      removeInventoryAt(index);
      syncVitals();
      player.mp = Math.min(player.mp, derived.maxMp);
      state.itemUseMessage = '검기 사용: 검기 단계가 상승했습니다.';
      return true;
    }
    if (item === '멀티캐스팅의 서') {
      player.multicasting += 1;
      removeInventoryAt(index);
      state.itemUseMessage = '멀티캐스팅의 서 사용: 멀티캐스팅이 1 증가했습니다.';
      return true;
    }
    if (item === '스킬 초기화권') {
      state.itemUseMessage = '스킬 초기화는 아직 미구현입니다.';
      return false;
    }
    if (magicBooks.includes(item)) {
      const result = tryLearnMagic(item, options);
      if (result.ok) {
        removeInventoryAt(index);
        state.itemUseMessage = '마법서 습득 성공';
        return true;
      }
      state.itemUseMessage = '마법서 습득 실패: 책은 사라지지 않습니다.';
      return false;
    }

    state.itemUseMessage = '사용할 수 없는 아이템입니다.';
    return false;
  }


  function getItemSellPrice(item) {
    const sellPriceMap = {
      '외공서': 5,
      '내공서': 5,
      '검기': 12,
      '멀티캐스팅의 서': 10,
      '스킬 초기화권': 5,
      '스탯 초기화권': 5,
      '기초 마법서': 3,
      '중급 마법서': 5,
      '고급 마법서': 8,
      '마도서': 15,
      '리롤권': 2,
    };
    return sellPriceMap[item] || 0;
  }

  function getShopItems() {
    return [
      { name: '리롤권', price: 5 },
      { name: '기초 마법서', price: 3 },
      { name: '중급 마법서', price: 9 },
      { name: '고급 마법서', price: 27 },
      { name: '멀티캐스팅의 서', price: 12 },
      { name: '외공서', price: 10 },
      { name: '내공서', price: 10 },
      { name: '검기', price: 30 },
      { name: '스킬 초기화권', price: 10 },
      { name: '스탯 초기화권', price: 10 },
    ];
  }

  function buyShopItem(name) {
    const shopItem = getShopItems().find(item => item.name === name);
    if (!shopItem) return false;
    if (player.coin < shopItem.price) {
      state.shopMessage = '코인이 부족합니다.';
      return false;
    }
    player.coin -= shopItem.price;
    player.inventory.push(name);
    state.shopMessage = `${name} 구매 완료`;
    return true;
  }

  function sellInventoryItem(index) {
    if (!Number.isInteger(index) || index < 0 || index >= player.inventory.length) return false;
    const item = player.inventory[index];
    const sellPrice = getItemSellPrice(item);
    if (sellPrice <= 0) return false;
    const removed = removeInventoryAt(index);
    if (removed === null) return false;
    player.coin += sellPrice;
    state.shopMessage = `${item} 판매 완료: +${sellPrice}코인`;
    return true;
  }

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

  function resetInput() {
    keys.left = false;
    keys.right = false;
    keys.jump = false;
    keys.dash = false;
    keys.attack = false;
    keys.skill = false;
    keys.magic = false;
  }

  function resetRewardState() {
    state.rewardCandidates = [];
    state.rewardSelected = new Set();
    state.rewardMeta = { candidateCount: 2, pickCount: 1 };
  }

  function resetPlayerForBattle() {
    player.x = 150; player.y = 280; player.vx = 0; player.vy = 0;
    player.attackCooldown = 0; player.dashCooldown = 0; player.facing = 1;
    syncVitals();
    player.hp = derived.maxHp;
    player.mp = derived.maxMp;
  }

  function serializeGameState() {
    return {
      state: {
        gameState: state.gameState,
        innerPhase: state.innerPhase,
        floor: state.floor,
        rewardCandidates: [...state.rewardCandidates],
        rewardSelected: [...state.rewardSelected],
        rewardMeta: state.rewardMeta ? { ...state.rewardMeta } : null,
        statusEffects: Array.isArray(state.statusEffects) ? [...state.statusEffects] : [],
        원영사용됨: state.원영사용됨,
        정령왕사용됨: state.정령왕사용됨,
        헤일로사용됨: state.헤일로사용됨,
        헤일로강화준비: state.헤일로강화준비,
        빙백연혼사용됨: state.빙백연혼사용됨,
        자기상환배수: state.자기상환배수,
        statAllocationBase: state.statAllocationBase ? { ...state.statAllocationBase } : null,
        itemUseMessage: state.itemUseMessage,
        shopMessage: state.shopMessage,
      },
      player: {
        name: player.name, title: player.title, mantra: player.mantra,
        level: player.level, coin: player.coin,
        str: player.str, agi: player.agi, vit: player.vit, int: player.int, wis: player.wis, looks: player.looks,
        outer: player.outer, inner: player.inner, swordAura: player.swordAura, multicasting: player.multicasting,
        x: player.x, y: player.y, vx: player.vx, vy: player.vy, hp: player.hp, mp: player.mp,
        attackCooldown: player.attackCooldown, dashCooldown: player.dashCooldown, facing: player.facing,
        knownMagic: [...player.knownMagic], inventory: [...player.inventory],
      },
      enemy: {
        alive: enemy.alive, x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h, vx: enemy.vx,
        hp: enemy.hp, maxHp: enemy.maxHp, atk: enemy.atk, attackCd: enemy.attackCd,
      },
    };
  }

  function applySerializedGameState(data) {
    try {
      if (!data || typeof data !== 'object' || !data.state || !data.player || !data.enemy) return false;
      const s = data.state;
      const p = data.player;
      const e = data.enemy;
      if (!Array.isArray(s.rewardSelected) || !Array.isArray(p.inventory) || !Array.isArray(p.knownMagic)) return false;

      state.gameState = s.gameState;
      state.innerPhase = s.innerPhase;
      state.floor = s.floor;
      state.rewardCandidates = Array.isArray(s.rewardCandidates) ? [...s.rewardCandidates] : [];
      state.rewardSelected = new Set(s.rewardSelected);
      state.rewardMeta = s.rewardMeta && typeof s.rewardMeta === 'object' ? { ...s.rewardMeta } : { candidateCount: 2, pickCount: 1 };
      state.statusEffects = Array.isArray(s.statusEffects) ? [...s.statusEffects] : [];
      state.원영사용됨 = !!s.원영사용됨;
      state.정령왕사용됨 = !!s.정령왕사용됨;
      state.헤일로사용됨 = !!s.헤일로사용됨;
      state.헤일로강화준비 = !!s.헤일로강화준비;
      state.빙백연혼사용됨 = !!s.빙백연혼사용됨;
      state.자기상환배수 = typeof s.자기상환배수 === 'number' ? s.자기상환배수 : 1;
      state.statAllocationBase = s.statAllocationBase && typeof s.statAllocationBase === 'object' ? { ...s.statAllocationBase } : null;
      state.itemUseMessage = typeof s.itemUseMessage === 'string' ? s.itemUseMessage : '';
      state.shopMessage = typeof s.shopMessage === 'string' ? s.shopMessage : '';

      Object.assign(player, p);
      player.inventory = [...p.inventory];
      player.knownMagic = [...p.knownMagic];

      Object.assign(enemy, e);

      syncVitals();
      player.hp = Math.min(player.hp, derived.maxHp);
      player.mp = Math.min(player.mp, derived.maxMp);
      player.vx = 0;
      player.vy = 0;
      player.attackCooldown = 0;
      player.dashCooldown = 0;
      resetInput();
      transientNotice = { text: '', until: 0 };
      return true;
    } catch (err) {
      return false;
    }
  }

  function saveGame() {
    try {
      const data = serializeGameState();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      state.saveMessage = '저장 완료';
      return true;
    } catch (err) {
      state.saveMessage = '저장 실패';
      return false;
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        state.saveMessage = '불러오기 실패';
        return false;
      }
      const data = JSON.parse(raw);
      const ok = applySerializedGameState(data);
      state.saveMessage = ok ? '불러오기 완료' : '불러오기 실패';
      return ok;
    } catch (err) {
      state.saveMessage = '불러오기 실패';
      return false;
    }
  }

  function deleteSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
      state.saveMessage = '저장 데이터 삭제 완료';
      return true;
    } catch (err) {
      state.saveMessage = '저장 실패';
      return false;
    }
  }

  function saveButtonsHtml() {
    return `<div class="save-row"><button id="saveGameBtn">저장</button><button id="loadGameBtn">불러오기</button><button id="deleteSaveBtn">저장 삭제</button></div><div>${state.saveMessage || ''}</div>`;
  }

  function bindSaveButtons() {
    const s = document.getElementById('saveGameBtn');
    const l = document.getElementById('loadGameBtn');
    const d = document.getElementById('deleteSaveBtn');
    if (s) s.onclick = () => saveGame();
    if (l) l.onclick = () => loadGame();
    if (d) d.onclick = () => deleteSave();
  }

  function enterInnerWorld() {
    state.itemUseMessage = '';
    state.shopMessage = '';
    state.gameState = 'innerWorld';
    state.innerPhase = 'clearReset';
    resetInput();
    resetRewardState();
    transientNotice = { text: '', until: 0 };
    state.statAllocationBase = null;
  }

  function goNextFloor() {
    state.itemUseMessage = '';
    state.shopMessage = '';
    state.floor += 1;
    state.gameState = 'battle';
    state.innerPhase = null;
    resetRewardState();
    resetInput();
    transientNotice = { text: '', until: 0 };
    state.statAllocationBase = null;
    resetPlayerForBattle();
    spawnEnemy();
  }

  function tryLearnMagic(book, options = {}) {
    const diffMap = {'기초 마법서':50,'중급 마법서':70,'고급 마법서':100,'마도서':100};
    const diff = diffMap[book];
    if (!diff) return { ok: false, reason: 'not_magic_book' };
    const roll = typeof options.forceRoll === 'number' ? options.forceRoll : (Math.floor(Math.random() * diff) + 1);
    const success = player.wis >= diff || roll < player.wis;
    if (success && !player.knownMagic.includes(book)) player.knownMagic.push(book);
    return { ok: success, reason: success ? 'learned' : 'failed_retryable' };
  }

  function renderHUD() {
    syncVitals();
    hudEl.innerHTML = `
      <div><span class="tag">이름</span>: ${player.name}</div>
      <div><span class="tag">칭호</span>: ${player.title}</div>
      <div><span class="tag">만트라</span>: ${player.mantra}</div>
      <div><span class="tag">현재 상태</span>: ${state.gameState === 'battle' ? '전투' : (state.gameState === 'innerWorld' ? '심상세계' : (state.gameState === 'initialStatAllocate' ? '초기 스탯 분배' : '패배'))}</div>
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
      <div>인벤토리 수: ${player.inventory.length}</div>
      <div>인벤토리: ${player.inventory.length ? player.inventory.join(', ') : '없음'}</div>
    `;
  }

  function renderPhasePanel() {
    const notice = transientNotice.until > Date.now() ? `<div class="warn">${transientNotice.text}</div>` : '';
    if (state.gameState === 'initialStatAllocate') {
      ensureStatAllocationBase();
      const statLabels = [
        ['str', '힘'],
        ['agi', '민첩'],
        ['vit', '체력'],
        ['int', '지능'],
        ['wis', '지혜'],
        ['looks', '외모'],
      ];
      const warning = remainingPoints() > 0 ? `<div class="warn">남은 포인트 ${remainingPoints()}가 있습니다. 그대로 시작할 수 있습니다.</div>` : '';
      phasePanel.innerHTML = `<div>초기 스탯 분배</div>
        <div>1층 전투 시작 전, 시작 스탯 포인트를 분배하세요.</div>
        <div>남은 포인트: ${remainingPoints()}</div>
        <div>총 스탯 포인트: ${totalStatPoints()}</div>
        <div>스탯 최대치: ${statMax()}</div>
        <div class="stat-grid">${statLabels.map(([key, label]) => {
          const canIncrease = remainingPoints() > 0 && player[key] < statMax();
          const canDecrease = state.statAllocationBase && player[key] > state.statAllocationBase[key];
          return `<div class="stat-row"><span>${label}: ${player[key]}</span><div><button class="stat-plus" data-key="${key}" ${canIncrease ? '' : 'disabled'}>+${label}</button><button class="stat-minus" data-key="${key}" ${canDecrease ? '' : 'disabled'}>-${label}</button></div></div>`;
        }).join('')}</div>
        ${warning}
        <div class="stat-actions">
          <button id="recommendedInitialStats">추천 분배</button>
          <button id="startFloorOneBattle">1층 전투 시작</button>
        </div>`;
      phasePanel.querySelectorAll('.stat-plus').forEach(btn => btn.onclick = () => { increaseStat(btn.dataset.key); renderPhasePanel(); });
      phasePanel.querySelectorAll('.stat-minus').forEach(btn => btn.onclick = () => { decreaseStat(btn.dataset.key); renderPhasePanel(); });
      document.getElementById('recommendedInitialStats').onclick = () => { applyRecommendedInitialStats(); renderPhasePanel(); };
      document.getElementById('startFloorOneBattle').onclick = finishInitialStatAllocation;
      phasePanel.innerHTML += saveButtonsHtml();
      bindSaveButtons();
      return;
    }
    if (state.gameState === 'battle') {
      phasePanel.innerHTML = `<div>전투 진행 중... 적을 처치하면 심상세계로 진입합니다.</div><div>적 HP: ${enemy.alive ? Math.max(0, Math.floor(enemy.hp)) + ' / ' + enemy.maxHp : '처치됨'}</div>${notice}` + saveButtonsHtml();
      bindSaveButtons();
      return;
    }
    if (state.gameState === 'defeated') {
      phasePanel.innerHTML = '<div class="enemy">패배: HP가 0이 되어 전투에서 쓰러졌습니다.</div><button id="restartRun">처음부터 다시 시작</button>' + saveButtonsHtml();
      document.getElementById('restartRun').onclick = restartFromDefeat;
      bindSaveButtons();
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
      ensureStatAllocationBase();
      const statLabels = [
        ['str', '힘'],
        ['agi', '민첩'],
        ['vit', '체력'],
        ['int', '지능'],
        ['wis', '지혜'],
        ['looks', '외모'],
      ];
      const canIncreaseAny = remainingPoints() > 0;
      phasePanel.innerHTML = `<div>5) statAllocate</div>
        <div>남은 포인트: ${remainingPoints()}</div>
        <div>총 스탯 포인트: ${totalStatPoints()}</div>
        <div>스탯 최대치: ${statMax()}</div>
        <div class="stat-message">이번 단계에서 올린 수치만 - 버튼으로 되돌릴 수 있습니다.</div>
        <div class="stat-grid">${statLabels.map(([key, label]) => {
          const canIncrease = canIncreaseAny && player[key] < statMax();
          const canDecrease = state.statAllocationBase && player[key] > state.statAllocationBase[key];
          return `<div class="stat-row">
            <span>${label}: ${player[key]}</span>
            <div>
              <button class="stat-plus" data-key="${key}" ${canIncrease ? '' : 'disabled'}>+${label}</button>
              <button class="stat-minus" data-key="${key}" ${canDecrease ? '' : 'disabled'}>-${label}</button>
            </div>
          </div>`;
        }).join('')}</div>
        <div class="stat-actions">
          <button id="finishStat">분배 완료</button>
          <button id="skipStat">건너뛰기</button>
        </div>`;
      phasePanel.querySelectorAll('.stat-plus').forEach(btn => btn.onclick = () => {
        increaseStat(btn.dataset.key);
        renderPhasePanel();
      });
      phasePanel.querySelectorAll('.stat-minus').forEach(btn => btn.onclick = () => {
        decreaseStat(btn.dataset.key);
        renderPhasePanel();
      });
      document.getElementById('finishStat').onclick = finishStatAllocation;
      document.getElementById('skipStat').onclick = finishStatAllocation;
    } else if (p === 'skillTechMagicTrait') {
      const inventoryRows = player.inventory.length
        ? player.inventory.map((item, i) => `<div class="stat-row"><span>${item}</span><div><button class="use-item" data-idx="${i}">사용</button></div></div>`).join('')
        : '<div>보유 아이템 없음</div>';
      const msg = state.itemUseMessage ? `<div class="stat-message">${state.itemUseMessage}</div>` : '';
      phasePanel.innerHTML = `<div>6) skillTechMagicTrait</div><div>보유 아이템을 사용하거나 다음 단계로 넘어갈 수 있습니다.</div>${msg}<div class="stat-grid">${inventoryRows}</div><button id="goShop">처리 완료 / 상점으로 이동</button>`;
      phasePanel.querySelectorAll('.use-item').forEach(btn => btn.onclick = () => { useInventoryItem(Number(btn.dataset.idx)); renderPhasePanel(); });
      document.getElementById('goShop').onclick = () => { state.itemUseMessage = ''; state.innerPhase='shop'; };
    } else if (p === 'shop') {
      const shopItems = getShopItems();
      const shopMessage = state.shopMessage ? `<div class="stat-message">${state.shopMessage}</div>` : '';
      const buyRows = shopItems.map((item) => {
        const canBuy = player.coin >= item.price;
        return `<div class="stat-row"><span>${item.name} (${item.price}코인)</span><div><button class="shop-buy" data-name="${item.name}" ${canBuy ? '' : 'disabled'}>구매</button></div></div>`;
      }).join('');
      const sellRows = player.inventory.length
        ? player.inventory.map((item, i) => {
          const sellPrice = getItemSellPrice(item);
          if (sellPrice <= 0) {
            return `<div class="stat-row"><span>${item} (판매 불가)</span><div><button disabled>판매 불가</button></div></div>`;
          }
          return `<div class="stat-row"><span>${item} (${sellPrice}코인)</span><div><button class="shop-sell" data-idx="${i}">판매</button></div></div>`;
        }).join('')
        : '<div>판매 가능한 아이템이 없습니다.</div>';
      phasePanel.innerHTML = `<div>7) shop</div><div>현재 코인: ${player.coin}</div><div>보유 인벤토리 수: ${player.inventory.length}</div>${shopMessage}<div class="stat-message">구매 목록</div><div class="stat-grid">${buyRows}</div><div class="stat-message">인벤토리 판매 목록</div><div class="stat-grid">${sellRows}</div><button id="closeShop">상점 종료 / 다음 층 준비</button>`;
      phasePanel.querySelectorAll('.shop-buy').forEach(btn => btn.onclick = () => { buyShopItem(btn.dataset.name); renderPhasePanel(); });
      phasePanel.querySelectorAll('.shop-sell').forEach(btn => btn.onclick = () => { sellInventoryItem(Number(btn.dataset.idx)); renderPhasePanel(); });
      document.getElementById('closeShop').onclick = () => { state.shopMessage = ''; state.innerPhase = 'nextFloor'; };
    } else if (p === 'nextFloor') {
      phasePanel.innerHTML = '<div>8) nextFloor</div><button id="goNext">다음 층 진입</button>';
      document.getElementById('goNext').onclick = goNextFloor;
    }
    phasePanel.innerHTML += saveButtonsHtml();
    bindSaveButtons();
  }

  function rectHit(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

  function showBattleNotice(text) {
    if (state.gameState !== 'battle') return;
    transientNotice = { text, until: Date.now() + 1500 };
  }

  function restartFromDefeat() {
    state.floor = 1;
    state.gameState = 'initialStatAllocate';
    state.innerPhase = null;
    resetRewardState();
    resetInput();
    transientNotice = { text: '', until: 0 };
    state.statAllocationBase = null;
    state.itemUseMessage = '';
    state.shopMessage = '';
    state.saveMessage = '';
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
      statAllocationBase: state.statAllocationBase ? JSON.parse(JSON.stringify(state.statAllocationBase)) : null,
      itemUseMessage: state.itemUseMessage,
      shopMessage: state.shopMessage,
      saveMessage: state.saveMessage,
    };
    const backupPlayer = JSON.parse(JSON.stringify(player));
    const backupEnemy = JSON.parse(JSON.stringify(enemy));
    const backupDerived = JSON.parse(JSON.stringify(derived));
    const backupTransientNotice = JSON.parse(JSON.stringify(transientNotice));
    const backupKeys = JSON.parse(JSON.stringify(keys));
    const backupLocalSave = localStorage.getItem(SAVE_KEY);
    const results = {};
    try {
      const oldLooks = player.looks; player.looks = 1;
      const rc = rewardConfig(); results.rewardConfigLooks1 = rc.candidateCount === 2 && rc.pickCount === 1;
      player.looks = oldLooks;

      const oldStr = player.str, oldVit = player.vit;
      player.str = 1; player.vit = 1; syncVitals(); results.attackFormulaDiv10 = computeDerived().baseAtk === (Math.floor((1+1)/10)+2);
      player.str = oldStr; player.vit = oldVit; syncVitals();

      state.gameState = 'battle'; enemy.alive=true; enemy.hp = 0; updateBattle(0.016);
      results.enemyKillToInnerWorld = state.gameState === 'innerWorld' && state.innerPhase === 'clearReset';

      const c0 = player.coin; applyReward('추가 코인 +2'); results.rewardApplyCoin = player.coin === c0 + 2;
      const inv0 = player.inventory.length; applyReward('외공서'); results.rewardApplyInventory = player.inventory.length === inv0 + 1;

      state.floor = 1; state.gameState = 'innerWorld'; state.innerPhase = 'nextFloor'; goNextFloor();
      results.nextFloorBackToBattle = state.gameState === 'battle' && state.floor === 2 && enemy.alive;
      results.nextFloorResetsPlayer = player.x === 150 && player.y === 280 && player.vx === 0 && player.vy === 0 &&
        player.attackCooldown === 0 && player.dashCooldown === 0 && player.facing === 1;
      results.nextFloorClearsRewardState = state.rewardCandidates.length === 0 && state.rewardSelected.size === 0 &&
        state.rewardMeta.candidateCount === 2 && state.rewardMeta.pickCount === 1;
      results.nextFloorRestoresHpMp = player.hp === derived.maxHp && player.mp === derived.maxMp;

      const levelBeforeInner = player.level;
      enterInnerWorld();
      results.enterInnerWorldDoesNotAutoClearOrLevel = state.gameState === 'innerWorld' && state.innerPhase === 'clearReset' && player.level === levelBeforeInner;

      player.level = 1; player.int = 1; player.inner = 0; player.swordAura = 1; syncVitals();
      results.swordAuraMpModifierApplied = derived.maxMp === 0;

      state.gameState = 'battle'; player.hp = 1; enemy.attackCd = 0; enemy.atk = 10; enemy.alive = true; enemy.x = player.x;
      updateBattle(0.016);
      results.playerDeathToDefeatState = state.gameState === 'defeated' && player.hp === 0;
      keys.left = true; keys.attack = true;
      const xBeforeDefeated = player.x;
      const enemyHpBeforeDefeated = enemy.hp;
      updateBattle(0.016);
      results.defeatedStopsBattleInput = player.x === xBeforeDefeated && enemy.hp === enemyHpBeforeDefeated && state.gameState === 'defeated';

      state.gameState = 'battle'; keys.skill = true; keys.magic = true;
      updateBattle(0.016);
      results.skillMagicButtonsSafe = transientNotice.text.length > 0 && state.gameState === 'battle';

      player.level = 9; player.coin = 33; player.str = 7; player.agi = 6; player.vit = 5; player.int = 4; player.wis = 3; player.looks = 2;
      player.outer = 2; player.inner = 1; player.swordAura = 3; player.multicasting = 4;
      player.inventory = ['외공서']; player.knownMagic = ['기초 마법서'];
      state.statusEffects = ['dummy']; state.floor = 5; state.gameState = 'defeated'; state.innerPhase = 'shop';
      restartFromDefeat();
      results.restartFromDefeatResetsRun =
        state.floor === 1 && state.gameState === 'battle' && state.innerPhase === null &&
        state.rewardCandidates.length === 0 && state.rewardSelected.size === 0 &&
        state.rewardMeta.candidateCount === 2 && state.rewardMeta.pickCount === 1 &&
        state.statusEffects.length === 0 && !state.원영사용됨 && !state.정령왕사용됨 &&
        !state.헤일로사용됨 && !state.헤일로강화준비 && !state.빙백연혼사용됨 && state.자기상환배수 === 1 &&
        player.level === 1 && player.coin === 0 &&
        player.str === 1 && player.agi === 1 && player.vit === 1 && player.int === 1 && player.wis === 1 && player.looks === 1 &&
        player.outer === 0 && player.inner === 0 && player.swordAura === 0 && player.multicasting === 1 &&
        player.inventory.length === 0 && player.knownMagic.length === 0 &&
        player.hp === derived.maxHp && player.mp === derived.maxMp && enemy.alive;


      state.gameState = 'innerWorld'; state.innerPhase = 'statAllocate';
      state.statAllocationBase = null;
      player.level = 10; player.str = 10; player.agi = 10; player.vit = 10; player.int = 10; player.wis = 10; player.looks = 10;
      syncVitals();
      ensureStatAllocationBase();
      const beforeRemain = remainingPoints();
      increaseStat('str');
      results.statIncreaseConsumesPoint = remainingPoints() === beforeRemain - 1;

      player.str = statMax();
      const maxBefore = player.str;
      increaseStat('str');
      results.statIncreaseRespectsMax = player.str === maxBefore;

      state.statAllocationBase = { str: 10, agi: 10, vit: 10, int: 10, wis: 10, looks: 10 };
      player.str = 10;
      decreaseStat('str');
      const noDecreaseAtBase = player.str === 10;
      player.str = 11;
      decreaseStat('str');
      const decreaseAllocated = player.str === 10;
      results.statDecreaseOnlyAllocated = noDecreaseAtBase && decreaseAllocated;

      state.innerPhase = 'statAllocate'; state.statAllocationBase = { str: 10, agi: 10, vit: 10, int: 10, wis: 10, looks: 10 };
      finishStatAllocation();
      results.statAllocateCompleteAdvancesPhase = state.innerPhase === 'skillTechMagicTrait';

      state.statAllocationBase = { str: 1, agi: 1, vit: 1, int: 1, wis: 1, looks: 1 };
      finishStatAllocation();
      const clearedByFinish = state.statAllocationBase === null;
      state.statAllocationBase = { str: 1, agi: 1, vit: 1, int: 1, wis: 1, looks: 1 };
      state.floor = 1; state.gameState = 'innerWorld'; state.innerPhase = 'nextFloor';
      goNextFloor();
      const clearedByNextFloor = state.statAllocationBase === null;
      state.statAllocationBase = { str: 1, agi: 1, vit: 1, int: 1, wis: 1, looks: 1 };
      state.gameState = 'defeated';
      restartFromDefeat();
      const clearedByRestart = state.statAllocationBase === null;
      results.statAllocationBaseCleared = clearedByFinish && clearedByNextFloor && clearedByRestart;

      results.gameStartsAtInitialStatAllocate = state.gameState === 'initialStatAllocate';

      applyRecommendedInitialStats();
      const totalStats = player.str + player.agi + player.vit + player.int + player.wis + player.looks;
      results.recommendedInitialStatsValid = totalStats === 60 &&
        player.str <= statMax() && player.agi <= statMax() && player.vit <= statMax() && player.int <= statMax() && player.wis <= statMax() && player.looks <= statMax() &&
        remainingPoints() === 0;

      finishInitialStatAllocation();
      results.finishInitialStatAllocationStartsBattle = state.gameState === 'battle' && player.hp === derived.maxHp && player.mp === derived.maxMp && enemy.alive;

      restartFromDefeat();
      results.restartFromDefeatReturnsToInitialStatAllocate = state.gameState === 'initialStatAllocate';

      const outerBefore = player.outer;
      player.inventory.push('외공서');
      let idx = player.inventory.length - 1;
      const outerUsed = useInventoryItem(idx);
      results.useOuterBookIncreasesOuter = outerUsed && player.outer === outerBefore + 1 && !player.inventory.includes('외공서');

      const innerBefore = player.inner;
      player.inventory.push('내공서');
      idx = player.inventory.length - 1;
      const innerUsed = useInventoryItem(idx);
      results.useInnerBookIncreasesInner = innerUsed && player.inner === innerBefore + 1 && !player.inventory.includes('내공서');

      player.swordAura = 6;
      player.inventory.push('검기');
      idx = player.inventory.length - 1;
      const swordUsed = useInventoryItem(idx);
      results.useSwordAuraBookCapsAtSix = !swordUsed && player.swordAura === 6 && player.inventory[idx] === '검기';

      const multiBefore = player.multicasting;
      player.inventory.push('멀티캐스팅의 서');
      idx = player.inventory.length - 1;
      const multiUsed = useInventoryItem(idx);
      results.useMulticastingBookIncreases = multiUsed && player.multicasting === multiBefore + 1 && !player.inventory.includes('멀티캐스팅의 서');

      player.wis = 100;
      player.inventory.push('기초 마법서');
      idx = player.inventory.length - 1;
      const magicSuccess = useInventoryItem(idx, { forceRoll: 1 });
      results.useMagicBookSuccessRemovesBook = magicSuccess && !player.inventory.includes('기초 마법서') && player.knownMagic.includes('기초 마법서');

      player.wis = 1;
      player.inventory.push('중급 마법서');
      idx = player.inventory.length - 1;
      const magicFail = useInventoryItem(idx, { forceRoll: 70 });
      results.useMagicBookFailureKeepsBook = !magicFail && player.inventory[idx] === '중급 마법서';

      player.inventory.push('스킬 초기화권');
      idx = player.inventory.length - 1;
      const skillResetUsed = useInventoryItem(idx);
      results.skillResetTicketNotConsumed = !skillResetUsed && player.inventory[idx] === '스킬 초기화권';

      player.coin = 10;
      player.inventory = [];
      const coinBeforeBuy = player.coin;
      const buyBasicMagic = buyShopItem('기초 마법서');
      results.shopBuyItemConsumesCoin = buyBasicMagic && player.coin === coinBeforeBuy - 3 && player.inventory.includes('기초 마법서');

      player.coin = 0;
      player.inventory = [];
      const noCoinBeforeBuy = player.coin;
      const buySwordAuraFail = buyShopItem('검기');
      results.shopBuyFailsWithoutCoin = !buySwordAuraFail && player.coin === noCoinBeforeBuy && !player.inventory.includes('검기');

      player.coin = 0;
      player.inventory = ['외공서'];
      const sellCoinBefore = player.coin;
      const sellOuterResult = sellInventoryItem(0);
      results.shopSellItemAddsCoin = sellOuterResult && player.coin === sellCoinBefore + 5;

      player.coin = 0;
      player.inventory = ['외공서', '외공서'];
      sellInventoryItem(0);
      const outerCount = player.inventory.filter(item => item === '외공서').length;
      results.shopSellRemovesOneItem = outerCount === 1;

      player.coin = 0;
      player.inventory = ['알 수 없는 아이템'];
      const unknownSell = sellInventoryItem(0);
      results.unknownItemSellFails = !unknownSell && player.inventory.length === 1 && player.inventory[0] === '알 수 없는 아이템';


      const serialized = serializeGameState();
      results.serializeIncludesCoreState = !!serialized.state && !!serialized.player && !!serialized.enemy && Array.isArray(serialized.state.rewardSelected);

      const backupRoundTrip = serializeGameState();
      player.coin = 111;
      state.floor = 7;
      player.inventory = ['검기', '내공서'];
      saveGame();
      player.coin = 5;
      state.floor = 2;
      player.inventory = [];
      const roundTripLoaded = loadGame();
      results.saveLoadRoundTripRestoresState = roundTripLoaded && player.coin === 111 && state.floor === 7 && player.inventory.length === 2;
      applySerializedGameState(backupRoundTrip);

      saveGame();
      deleteSave();
      results.deleteSaveClearsStorage = localStorage.getItem(SAVE_KEY) === null;

      localStorage.removeItem(SAVE_KEY);
      results.loadMissingSaveFailsSafely = loadGame() === false;

      const beforeInvalid = serializeGameState();
      localStorage.setItem(SAVE_KEY, '{invalid json');
      const invalidJsonFail = loadGame() === false;
      localStorage.setItem(SAVE_KEY, JSON.stringify({ nope: true }));
      const invalidShapeFail = loadGame() === false;
      const afterInvalid = serializeGameState();
      results.loadInvalidSaveFailsSafely = invalidJsonFail && invalidShapeFail && JSON.stringify(beforeInvalid) === JSON.stringify(afterInvalid);

      state.innerPhase = 'shop';
      state.shopMessage = '테스트';
      state.shopMessage = '';
      state.innerPhase = 'nextFloor';
      results.shopExitAdvancesToNextFloor = state.innerPhase === 'nextFloor' && state.shopMessage === '';

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
      state.statAllocationBase = backupState.statAllocationBase ? JSON.parse(JSON.stringify(backupState.statAllocationBase)) : null;
      state.itemUseMessage = backupState.itemUseMessage;
      state.shopMessage = backupState.shopMessage;
      state.saveMessage = backupState.saveMessage;
      if (backupLocalSave === null) localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, backupLocalSave);
      transientNotice = backupTransientNotice;
      resetInput();
      Object.assign(keys, backupKeys);
      derived = computeDerived();
    }
    results.debugTestsRestoreState =
      state.gameState === backupState.gameState && state.innerPhase === backupState.innerPhase && state.floor === backupState.floor &&
      JSON.stringify(state.rewardCandidates) === JSON.stringify(backupState.rewardCandidates) &&
      JSON.stringify([...state.rewardSelected]) === JSON.stringify([...backupState.rewardSelected]) &&
      JSON.stringify(state.rewardMeta) === JSON.stringify(backupState.rewardMeta) && JSON.stringify(state.statusEffects) === JSON.stringify(backupState.statusEffects) &&
      JSON.stringify(state.statAllocationBase) === JSON.stringify(backupState.statAllocationBase) &&
      state.itemUseMessage === backupState.itemUseMessage &&
      state.shopMessage === backupState.shopMessage &&
      state.saveMessage === backupState.saveMessage &&
      player.level === backupPlayer.level && player.coin === backupPlayer.coin && player.hp === backupPlayer.hp && player.mp === backupPlayer.mp &&
      JSON.stringify(player.inventory) === JSON.stringify(backupPlayer.inventory) && JSON.stringify(player.knownMagic) === JSON.stringify(backupPlayer.knownMagic) &&
      player.x === backupPlayer.x && player.y === backupPlayer.y && enemy.alive === backupEnemy.alive && enemy.hp === backupEnemy.hp &&
      enemy.maxHp === backupEnemy.maxHp && enemy.x === backupEnemy.x && enemy.y === backupEnemy.y &&
      derived.maxHp === backupDerived.maxHp && derived.maxMp === backupDerived.maxMp && derived.mpRegen === backupDerived.mpRegen &&
      derived.baseAtk === backupDerived.baseAtk && derived.atk === backupDerived.atk &&
      transientNotice.text === backupTransientNotice.text && transientNotice.until === backupTransientNotice.until &&
      JSON.stringify(keys) === JSON.stringify(backupKeys);
    return results;
  }

  window.ManRPG = { state, player, enemy, rewardConfig, applyFiveLevelPlus, enterInnerWorld, goNextFloor, tryLearnMagic, ensureStatAllocationBase, increaseStat, decreaseStat, finishStatAllocation, finishInitialStatAllocation, applyRecommendedInitialStats, useInventoryItem, removeInventoryAt, getItemSellPrice, getShopItems, buyShopItem, sellInventoryItem, serializeGameState, applySerializedGameState, saveGame, loadGame, deleteSave, runDebugTests, SAVE_KEY };
  spawnEnemy();
  syncVitals();
  requestAnimationFrame(loop);
})();

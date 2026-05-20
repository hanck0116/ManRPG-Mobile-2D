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
    debugMessage: '',
    innerActionsDone: { clearReset: false, fiveLevelPlus: false, rewardConfirmed: false },
    floorClearResolved: false,
    floorRewardClaimed: false,
    pendingFloorClearResolve: false,
  };

  const player = {
    name: '하르벤', title: '수확하는 자', mantra: '낫',
    level: 1, coin: 0,
    str: 1, agi: 1, vit: 1, int: 1, wis: 1, looks: 1,
    outer: 0, inner: 0, swordAura: 0, multicasting: 1,
    x: 150, y: 280, w: 30, h: 50, vx: 0, vy: 0,
    hp: 10, mp: 15,
    attackCooldown: 0, dashCooldown: 0, facing: 1,
    skillCooldown: 0, magicCooldown: 0,
    invincibleTimer: 0, hurtTimer: 0,
    knownMagic: [], selectedMagicKey: '', inventory: []
  };

  let projectiles = [];
  let hitStopTimer = 0;
  let screenShakeTimer = 0;
  let screenShakeMagnitude = 0;

  const enemyTypes = [
    { id: 'hungryWolf', name: '굶주린 늑대', hpBase: 18, hpPerFloor: 7, atkBase: 3, atkPerFloor: 2, speed: 95, width: 38, height: 34, color: '#4a4a4a', aiType: 'fastMelee', attackRange: 34, attackCooldown: 0.9, description: '빠르게 접근하는 근접형 적' },
    { id: 'goblin', name: '고블린', hpBase: 22, hpPerFloor: 8, atkBase: 4, atkPerFloor: 2, speed: 70, width: 34, height: 48, color: '#41a34d', aiType: 'melee', attackRange: 38, attackCooldown: 1.1, description: '표준 근접형 적' },
    { id: 'slime', name: '슬라임', hpBase: 32, hpPerFloor: 10, atkBase: 3, atkPerFloor: 2, speed: 45, width: 44, height: 32, color: '#6d7cff', aiType: 'tank', attackRange: 32, attackCooldown: 1.4, description: '느리지만 체력이 높은 적' },
    { id: 'skeleton', name: '해골 병사', hpBase: 24, hpPerFloor: 9, atkBase: 5, atkPerFloor: 2, speed: 55, width: 34, height: 52, color: '#e6dcc8', aiType: 'guard', attackRange: 48, attackCooldown: 1.3, description: '사거리가 조금 긴 근접형 적' },
    { id: 'bat', name: '박쥐 마물', hpBase: 14, hpPerFloor: 6, atkBase: 3, atkPerFloor: 2, speed: 100, width: 32, height: 26, color: '#452c6a', aiType: 'flying', attackRange: 30, attackCooldown: 0.8, description: '공중에서 빠르게 접근하는 적' }
  ];

  const enemy = {
    typeId: 'goblin', name: '고블린', aiType: 'melee', speed: 70, attackRange: 38, attackCooldownBase: 1.1,
    color: '#41a34d', description: '표준 근접형 적', isFlying: false,
    alive: true, x: 740, y: 280, w: 34, h: 48, vx: 0, hp: 16, maxHp: 16, atk: 3, attackCd: 0, hurtTimer: 0, windupTimer: 0, pendingAttack: false
  };

  const keys = { left:false,right:false,jump:false,dash:false,attack:false,skill:false,magic:false };
  const auraTable = {
    0: { mult:1, mp:0 },1:{ mult:1.5, mp:-50 },2:{ mult:2, mp:-150 },3:{ mult:5, mp:-300 },
    4:{ mult:20, mp:-700 },5:{ mult:50, mp:-500 },6:{ mult:50, mp:1000000 }
  };


  const SPELL_MP = {1:50,2:80,3:120,4:180,5:260,6:380,7:520,8:700,9:900};
  const SPELL_BOOK_TIERS = {
    '기초 마법서': { minCircle:1, maxCircle:2, difficulty:50 },
    '중급 마법서': { minCircle:3, maxCircle:4, difficulty:70 },
    '고급 마법서': { minCircle:5, maxCircle:6, difficulty:100 },
    '마도서': { minCircle:7, maxCircle:9, difficulty:100 }
  };
  const SPELLS_BY_CIRCLE = {1:['라이트','파이어','아이스','윈드','매직 애로우','그리스','디그','다크니스'],2:['샤이닝 에로우','파이어 애로우','아이스 애로우','윈드 애로우','록 애로우','라이트닝 애로우','쉴드','힐','아이스 포그','다크 애로우'],3:['샤이닝 디펜스','파이어 볼','아이스 볼','윈드 커터','스톤 스파이크','라이데인','슬립','캔슬레이션','본 바인딩','다크 볼','웹','메모라이즈'],4:['샤이닝 웨이브','샤이닝 인첸트','샤이닝 블레스터','파이어 랜스','아이스 스피어','에어로 봄','어스 브레이크','블라인드','슬로우','사일런스','일루젼','컨퓨전'],5:['인비저빌리티','디스토션','샤이닝 필드','레이져','배리어','익스플로전','체인 라이트닝','파이어 월','블링크','그래비티','다크 필드','라이프 드레인'],6:['샤이닝 레이져','서먼 샤이닝','안티 매직 쉘','필라 오브 파이어','기가 라이데인','토네이도','디스펠','그레이트 쉴드','텔레포트','그레이트 힐','다크 캐논','서먼 본 와이번'],7:['샤이닝 저지먼트','헤븐스 도어','인페르노','블리자드','어스 퀘이크','윈드 스톰','워프','리플렉션','그래비티','서먼 데스나이트'],8:['소드 오브 리벤지 라이트','샤이닝 레인','볼케이노','아이스 크리스탈 오브 스톰','퓨리 오브 더 헤븐','라이트닝 인피니티','컨트롤 웨더','매스 텔레포트','헬파이어','서먼 본 드래곤'],9:['메테오 스트라이크','메테오 스웜','앱솔루트 제로 포인트','라이트닝 월드','루인 오브 그라운드','엘리멘탈 퍼니시먼트','앱솔루트 쉴드','워프 게이트','파워 워드 킬','네크로폴리스']};
  function spellCategory(name){const n=name; if(/힐/.test(n))return 'heal'; if(/쉴드|디펜스|배리어|리플렉션/.test(n))return 'defense'; if(/서먼/.test(n))return 'summon'; if(/필드|웨이브|월|스톰|토네이도|볼케이노|메테오 스웜|네크로폴리스/.test(n))return 'area'; if(/볼|브레이크|퀘이크|크리스탈/.test(n))return 'smallArea'; if(/레이져|인피니티|저지먼트|퍼니시먼트|파워 워드 킬/.test(n))return 'singleHigh'; if(/라이트|슬립|캔슬레이션|블라인드|슬로우|사일런스|일루젼|컨퓨전|인비저빌리티|디스토션|블링크|디스펠|텔레포트|워프|컨트롤 웨더|워프 게이트|메모라이즈|그리스|디그|다크니스/.test(n))return 'utility'; return 'single';}
  function spellPowerRatio(circle,cat){const base=0.18+circle*0.05; const m={utility:0.08,defense:0.12,heal:0.2,summon:0.35,area:0.28,smallArea:0.4,singleHigh:0.7,single:0.5}[cat]||0.5; return Math.min(0.95,base*m);}
  function spellManaCost(circle,cat){const m={utility:0.8,defense:0.9,heal:0.9,summon:1.05,area:1.0,smallArea:1.0,singleHigh:1.1,single:1.0}[cat]||1; return Math.max(1,Math.floor(SPELL_MP[circle]*m));}
  function spellPower(mp,circle,cat){return Math.max(0,Math.min(mp,Math.floor(mp*spellPowerRatio(circle,cat))));}
  function makeSpellKey(circle,name){return `c${circle}_`+name.toLowerCase().replace(/[^a-z0-9가-힣]+/g,'_').replace(/^_|_$/g,'');}
  const MAGIC_POOL=[]; Object.keys(SPELLS_BY_CIRCLE).forEach((c)=>{const circle=Number(c); SPELLS_BY_CIRCLE[circle].forEach((name)=>{const category=spellCategory(name); const mp=spellManaCost(circle,category); MAGIC_POOL.push({key:makeSpellKey(circle,name),name,circle,category,rangeText: category==='area'?'광역':(category==='smallArea'?'소범위':'단일'),mp,damage:spellPower(mp,circle,category)});});});
  function getMagicByKey(key){return MAGIC_POOL.find((m)=>m.key===key);}
  function normalizeKnownMagic(){player.knownMagic=player.knownMagic.filter((k)=>typeof k==='string'&&!!getMagicByKey(k)); if(!player.selectedMagicKey||!getMagicByKey(player.selectedMagicKey)){player.selectedMagicKey=player.knownMagic[0]||'';} }

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
    player.invincibleTimer = 0;
    player.hurtTimer = 0;
    projectiles = [];
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
    projectiles = [];
    clearCombatFeedback();
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
    projectiles = [];
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
        state.itemUseMessage = result.spellKey ? `마법 습득 성공: ${getMagicByKey(result.spellKey).name}` : '마법서 습득 성공';
        return true;
      }
      state.itemUseMessage = result.reason === 'already_known' ? '새로 배울 마법이 없습니다. 책 유지.' : '마법서 습득 실패: 책은 사라지지 않습니다.';
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

  function pickEnemyTypeForFloor(floor) {
    const floorOnePool = enemyTypes;
    return floorOnePool[Math.floor(Math.random() * floorOnePool.length)] || floorOnePool[1];
  }

  function spawnEnemy() {
    const type = pickEnemyTypeForFloor(state.floor);
    enemy.typeId = type.id;
    enemy.name = type.name;
    enemy.aiType = type.aiType;
    enemy.speed = type.speed;
    enemy.attackRange = type.attackRange;
    enemy.attackCooldownBase = type.attackCooldown;
    enemy.color = type.color;
    enemy.description = type.description;
    enemy.isFlying = type.aiType === 'flying';
    enemy.alive = true;
    enemy.maxHp = type.hpBase + state.floor * type.hpPerFloor;
    enemy.hp = enemy.maxHp;
    enemy.atk = type.atkBase + state.floor * type.atkPerFloor;
    enemy.w = type.width;
    enemy.h = type.height;
    enemy.x = 720;
    enemy.y = enemy.isFlying ? 220 : 280;
    enemy.vx = 0;
    enemy.attackCd = 0;
    enemy.hurtTimer = 0;
    enemy.windupTimer = 0;
    enemy.pendingAttack = false;
    autoResolveFloorClear();
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
    projectiles = [];
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
    player.skillCooldown = 0; player.magicCooldown = 0;
    player.invincibleTimer = 0; player.hurtTimer = 0;
    syncVitals();
    player.hp = derived.maxHp;
    player.mp = derived.maxMp;
    projectiles = [];
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
        floorClearResolved: !!state.floorClearResolved,
        floorRewardClaimed: !!state.floorRewardClaimed,
        pendingFloorClearResolve: !!state.pendingFloorClearResolve,
      },
      player: {
        name: player.name, title: player.title, mantra: player.mantra,
        level: player.level, coin: player.coin,
        str: player.str, agi: player.agi, vit: player.vit, int: player.int, wis: player.wis, looks: player.looks,
        outer: player.outer, inner: player.inner, swordAura: player.swordAura, multicasting: player.multicasting,
        x: player.x, y: player.y, vx: player.vx, vy: player.vy, hp: player.hp, mp: player.mp,
        attackCooldown: player.attackCooldown, dashCooldown: player.dashCooldown, facing: player.facing,
        skillCooldown: player.skillCooldown, magicCooldown: player.magicCooldown,
        knownMagic: [...player.knownMagic], selectedMagicKey: player.selectedMagicKey, inventory: [...player.inventory],
      },
      enemy: {
        alive: enemy.alive, x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h, vx: enemy.vx,
        hp: enemy.hp, maxHp: enemy.maxHp, atk: enemy.atk, attackCd: enemy.attackCd,
        typeId: enemy.typeId, name: enemy.name, aiType: enemy.aiType, speed: enemy.speed,
        attackRange: enemy.attackRange, attackCooldownBase: enemy.attackCooldownBase, color: enemy.color,
        description: enemy.description, isFlying: enemy.isFlying,
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
      state.floorClearResolved = !!s.floorClearResolved;
      state.floorRewardClaimed = !!s.floorRewardClaimed;
      state.pendingFloorClearResolve = !!s.pendingFloorClearResolve;

      Object.assign(player, p);
      player.inventory = [...p.inventory];
      player.knownMagic = [...p.knownMagic];
      player.selectedMagicKey = typeof p.selectedMagicKey === 'string' ? p.selectedMagicKey : '';
      normalizeKnownMagic();

      Object.assign(enemy, e);
      const fallback = enemyTypes.find(type => type.id === (enemy.typeId || 'goblin')) || enemyTypes.find(type => type.id === 'goblin') || enemyTypes[0];
      enemy.typeId = typeof enemy.typeId === 'string' ? enemy.typeId : fallback.id;
      enemy.name = typeof enemy.name === 'string' ? enemy.name : fallback.name;
      enemy.aiType = typeof enemy.aiType === 'string' ? enemy.aiType : fallback.aiType;
      enemy.speed = typeof enemy.speed === 'number' ? enemy.speed : fallback.speed;
      enemy.attackRange = typeof enemy.attackRange === 'number' ? enemy.attackRange : fallback.attackRange;
      enemy.attackCooldownBase = typeof enemy.attackCooldownBase === 'number' ? enemy.attackCooldownBase : fallback.attackCooldown;
      enemy.color = typeof enemy.color === 'string' ? enemy.color : fallback.color;
      enemy.description = typeof enemy.description === 'string' ? enemy.description : fallback.description;
      enemy.isFlying = typeof enemy.isFlying === 'boolean' ? enemy.isFlying : (enemy.aiType === 'flying');

      syncVitals();
      player.hp = Math.min(player.hp, derived.maxHp);
      player.mp = Math.min(player.mp, derived.maxMp);
      player.vx = 0;
      player.vy = 0;
      player.attackCooldown = 0;
      player.dashCooldown = 0;
      player.skillCooldown = typeof p.skillCooldown === 'number' ? p.skillCooldown : 0;
      player.magicCooldown = typeof p.magicCooldown === 'number' ? p.magicCooldown : 0;
      player.invincibleTimer = 0;
      player.hurtTimer = 0;
      enemy.windupTimer = 0;
      enemy.pendingAttack = false;
      projectiles = [];
      clearCombatFeedback();
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
      player.skillCooldown = 0;
      player.magicCooldown = 0;
      projectiles = [];
      clearCombatFeedback();
      enemy.hurtTimer = 0;
      enemy.windupTimer = 0;
      enemy.pendingAttack = false;
      player.invincibleTimer = 0;
      player.hurtTimer = 0;
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

  function autoResolveFloorClear() {
    if (!state.pendingFloorClearResolve) return false;
    if (state.floorClearResolved) return false;
    clearReset();
    applyFiveLevelPlus();
    rewardRoll();
    state.floorClearResolved = true;
    state.floorRewardClaimed = false;
    state.pendingFloorClearResolve = false;
    state.innerPhase = state.rewardCandidates.length ? 'rewardPick' : 'menu';
    return true;
  }

  function enterInnerWorld() {
    state.itemUseMessage = '';
    state.shopMessage = '';
    state.gameState = 'innerWorld';
    state.innerPhase = 'menu';
    state.innerActionsDone = { clearReset: true, fiveLevelPlus: true, rewardConfirmed: false };
    resetInput();
    transientNotice = { text: '', until: 0 };
    state.statAllocationBase = null;
    projectiles = [];
    clearCombatFeedback();
    enemy.windupTimer = 0;
    enemy.pendingAttack = false;
    autoResolveFloorClear();
  }

  function goNextFloor() {
    state.itemUseMessage = '';
    state.shopMessage = '';
    state.floor += 1;
    state.gameState = 'battle';
    state.innerPhase = null;
    state.innerActionsDone = { clearReset: false, fiveLevelPlus: false, rewardConfirmed: false };
    state.floorClearResolved = false;
    state.floorRewardClaimed = false;
    state.pendingFloorClearResolve = false;
    resetRewardState();
    resetInput();
    transientNotice = { text: '', until: 0 };
    state.statAllocationBase = null;
    resetPlayerForBattle();
    clearCombatFeedback();
    enemy.windupTimer = 0;
    enemy.pendingAttack = false;
    spawnEnemy();
  }

  function tryLearnMagic(book, options = {}) {
    const tier = SPELL_BOOK_TIERS[book];
    if (!tier) return { ok: false, reason: 'not_magic_book' };
    const candidates = MAGIC_POOL.filter((m) => m.circle >= tier.minCircle && m.circle <= tier.maxCircle && !player.knownMagic.includes(m.key));
    if (!candidates.length) return { ok: false, reason: 'already_known' };
    const roll = typeof options.forceRoll === 'number' ? options.forceRoll : (Math.floor(Math.random() * tier.difficulty) + 1);
    const success = player.wis >= tier.difficulty || roll < player.wis;
    if (!success) return { ok: false, reason: 'failed_retryable' };
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    player.knownMagic.push(pick.key);
    if (!player.selectedMagicKey) player.selectedMagicKey = pick.key;
    return { ok: true, reason: 'learned', spellKey: pick.key };
  }

  function renderHUD() {
    syncVitals();
    normalizeKnownMagic();
    hudEl.innerHTML = `
      <div><span class="tag">이름</span>: ${player.name}</div>
      <div><span class="tag">칭호</span>: ${player.title}</div>
      <div><span class="tag">만트라</span>: ${player.mantra}</div>
      <div><span class="tag">상태</span>: ${state.gameState === 'battle' ? '전투' : (state.gameState === 'innerWorld' ? '심상세계' : (state.gameState === 'initialStatAllocate' ? '초기 분배' : '패배'))}</div>
      <hr />
      <div>층 ${state.floor} | Lv ${player.level} | 코인 ${player.coin}</div>
      <div>HP ${Math.floor(player.hp)} / ${derived.maxHp} | MP ${Math.floor(player.mp)} / ${derived.maxMp}</div>
      <div>스탯 힘/민/체/지/혜/외: ${player.str}/${player.agi}/${player.vit}/${player.int}/${player.wis}/${player.looks}</div>
      <div>공격 ${derived.atk} | 검기 ${player.swordAura} | 멀캐 ${player.multicasting}</div>
      <div class="enemy">적 ${enemy.name || '알 수 없음'} | HP ${enemy.alive ? Math.max(0, Math.floor(enemy.hp)) + ' / ' + enemy.maxHp : '처치됨'}</div>
      <div>인벤 ${player.inventory.length}개 ${player.inventory.length ? '(' + player.inventory.join(', ') + ')' : ''}</div>
    `;
  }


  function appendSaveControls() {
    phasePanel.insertAdjacentHTML('beforeend', saveButtonsHtml());
    bindSaveButtons();
  }

  function debugControlsHtml() {
    const msg = state.debugMessage ? `<div class="stat-message">${state.debugMessage}</div>` : '<div></div>';
    return `<div class="save-row"><button id="runDebugTestsBtn">테스트 실행</button></div>${msg}`;
  }

  function summarizeDebugResults(results) {
    const failedKeys = Object.keys(results).filter((key) => results[key] !== true);
    if (failedKeys.length === 0) return '전체 테스트 통과';
    return `실패 항목: ${failedKeys.join(', ')}`;
  }

  function bindDebugButtons() {
    const t = document.getElementById('runDebugTestsBtn');
    if (!t) return;
    t.onclick = () => {
      const results = runDebugTests();
      state.debugMessage = summarizeDebugResults(results);
      renderPhasePanel();
    };
  }

  function appendDebugControls() {
    phasePanel.insertAdjacentHTML('beforeend', debugControlsHtml());
    bindDebugButtons();
  }

  function appendPanelControls() {
    appendSaveControls();
    appendDebugControls();
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
      appendPanelControls();
      return;
    }
    if (state.gameState === 'battle') {
      phasePanel.innerHTML = `<div>전투 진행 중... 적을 처치하면 심상세계로 진입합니다.</div><div>적: ${enemy.name || '알 수 없음'}</div><div>설명: ${enemy.description || ''}</div><div>적 HP: ${enemy.alive ? Math.max(0, Math.floor(enemy.hp)) + ' / ' + enemy.maxHp : '처치됨'}</div><div>적 공격력: ${enemy.atk}</div>${notice}`;
      appendPanelControls();
      return;
    }
    if (state.gameState === 'defeated') {
      phasePanel.innerHTML = '<div class="enemy">패배: HP가 0이 되어 전투에서 쓰러졌습니다.</div><button id="restartRun">처음부터 다시 시작</button>';
      document.getElementById('restartRun').onclick = restartFromDefeat;
      appendPanelControls();
      return;
    }
    const p = state.innerPhase;
    if (p === 'menu' || !p) {
      const action = state.innerActionsDone;
      const rewardStatus = action.rewardConfirmed ? '완료' : (state.rewardCandidates.length ? '선택중' : '대기');
      phasePanel.innerHTML = `<div><b>심상세계 메뉴</b></div>
      <div class="stat-actions">
        <button id="btnReward">보상 ${rewardStatus}</button>
        <button id="btnStat">스탯</button>
        <button id="btnItem">아이템</button>
        <button id="btnShop">상점</button>
        <button id="btnNext">다음 층</button>
      </div>${notice}`;
      document.getElementById('btnReward').onclick=()=>{ state.innerPhase='rewardPick'; renderPhasePanel(); };
      document.getElementById('btnStat').onclick=()=>{ state.innerPhase='statAllocate'; renderPhasePanel(); };
      document.getElementById('btnItem').onclick=()=>{ state.innerPhase='skillTechMagicTrait'; renderPhasePanel(); };
      document.getElementById('btnShop').onclick=()=>{ state.innerPhase='shop'; renderPhasePanel(); };
      document.getElementById('btnNext').onclick=goNextFloor;
    } else if (p === 'rewardPick') {
      const picks = [...state.rewardSelected];
      phasePanel.innerHTML = `<div><b>보상 선택</b> (${picks.length}/${state.rewardMeta.pickCount})</div>` +
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
        state.innerActionsDone.rewardConfirmed = true; state.floorRewardClaimed = true; transientNotice = { text: '보상 확정', until: Date.now() + 1200 }; state.innerPhase = 'menu';
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
      phasePanel.innerHTML = `<div><b>스탯 분배</b></div>
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
      normalizeKnownMagic();
      const magicOptions = player.knownMagic.map((key)=>{ const m = getMagicByKey(key); return m ? `<option value="${m.key}" ${player.selectedMagicKey===m.key?'selected':''}>${m.name} (C${m.circle}/MP ${m.mp})</option>` : ''; }).join('');
      const selectedMagic = getMagicByKey(player.selectedMagicKey);
      const magicInfo = selectedMagic ? `현재 선택 마법: ${selectedMagic.name} / ${selectedMagic.circle}서클 / MP ${selectedMagic.mp}` : '현재 선택 마법: 없음';
      phasePanel.innerHTML = `<div><b>아이템/마법</b></div>${msg}<div class="stat-message">${magicInfo}</div><div>${player.knownMagic.length?`<select id="magicSelect">${magicOptions}</select>`:'보유 마법 없음'}</div><div class="stat-grid">${inventoryRows}</div><button id="goShop">메뉴로</button>`;
      phasePanel.querySelectorAll('.use-item').forEach(btn => btn.onclick = () => { useInventoryItem(Number(btn.dataset.idx)); renderPhasePanel(); });
      const magicSelect = document.getElementById('magicSelect'); if (magicSelect) magicSelect.onchange = () => { player.selectedMagicKey = magicSelect.value; renderPhasePanel(); };
      document.getElementById('goShop').onclick = () => { state.itemUseMessage = ''; state.innerPhase='menu'; renderPhasePanel(); };
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
      phasePanel.innerHTML = `<div><b>상점</b></div><div>코인: ${player.coin}</div><div>인벤토리: ${player.inventory.length}개</div>${shopMessage}<div class="stat-message">구매 목록</div><div class="stat-grid">${buyRows}</div><div class="stat-message">인벤토리 판매 목록</div><div class="stat-grid">${sellRows}</div><button id="closeShop">메뉴로</button>`;
      phasePanel.querySelectorAll('.shop-buy').forEach(btn => btn.onclick = () => { buyShopItem(btn.dataset.name); renderPhasePanel(); });
      phasePanel.querySelectorAll('.shop-sell').forEach(btn => btn.onclick = () => { sellInventoryItem(Number(btn.dataset.idx)); renderPhasePanel(); });
      document.getElementById('closeShop').onclick = () => { state.shopMessage = ''; state.innerPhase = 'menu'; };
    } else if (p === 'nextFloor') {
      phasePanel.innerHTML = '<div>8) nextFloor</div><button id="goNext">다음 층 진입</button>';
      document.getElementById('goNext').onclick = goNextFloor;
    }
    appendPanelControls();
  }

  function rectHit(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

  function showBattleNotice(text) {
    if (state.gameState !== 'battle') return;
    transientNotice = { text, until: Date.now() + 1500 };
  }


  function clearCombatFeedback() {
    hitStopTimer = 0;
    screenShakeTimer = 0;
    screenShakeMagnitude = 0;
    enemy.hurtTimer = 0;
  }

  function startHitStop(duration = 0.05) {
    hitStopTimer = Math.max(hitStopTimer, duration);
  }

  function startScreenShake(duration = 0.12, magnitude = 4) {
    screenShakeTimer = Math.max(screenShakeTimer, duration);
    screenShakeMagnitude = Math.max(screenShakeMagnitude, magnitude);
  }

  function handleEnemyDefeated(source = 'unknown') {
    if (!enemy.alive) return false;
    enemy.alive = false;
    enemy.hp = 0;
    enemy.hurtTimer = 0;
    projectiles = [];
    state.pendingFloorClearResolve = true;
    enterInnerWorld();
    return true;
  }

  function applyEnemyDamage(damage, knockback = 0, source = 'attack') {
    if (state.gameState !== 'battle') return false;
    if (!enemy.alive) return false;
    if (!(damage > 0)) return false;
    enemy.hp -= damage;
    enemy.hurtTimer = 0.15;
    if (knockback) {
      enemy.x += enemy.x >= player.x ? knockback : -knockback;
      enemy.x = Math.max(0, Math.min(canvas.width - enemy.w, enemy.x));
    }
    startHitStop(source === 'harvestSlash' ? 0.06 : 0.05);
    startScreenShake(0.12, source === 'harvestSlash' ? 5 : 4);
    if (enemy.hp <= 0) handleEnemyDefeated(source);
    return true;
  }


  function applyPlayerDamage(damage, knockback = 0) {
    if (state.gameState !== 'battle') return false;
    if (player.invincibleTimer > 0) return false;
    if (!(damage > 0)) return false;
    player.hp -= damage;
    player.hurtTimer = 0.25;
    player.invincibleTimer = 0.8;
    if (knockback) {
      player.x += knockback;
      player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));
    }
    startScreenShake(0.12, 3);
    if (player.hp <= 0) {
      player.hp = 0;
      state.gameState = 'defeated';
      state.innerPhase = null;
      resetInput();
      transientNotice = { text: '', until: 0 };
      projectiles = [];
      clearCombatFeedback();
    }
    return true;
  }

  function useHarvestSlash() {
    if (state.gameState !== 'battle' || !enemy.alive) return;
    if (player.skillCooldown > 0) return showBattleNotice('스킬 재사용 대기 중입니다.');
    if (player.mp < 20) return showBattleNotice('MP가 부족합니다.');
    player.mp -= 20;
    player.skillCooldown = 1.2;
    showBattleNotice('수확 베기!');
    const range = 95;
    const inFront = player.facing === 1 ? (enemy.x - (player.x + player.w) <= range && enemy.x >= player.x) : (player.x - (enemy.x + enemy.w) <= range && enemy.x <= player.x);
    if (inFront && Math.abs(enemy.y - player.y) <= 70) {
      applyEnemyDamage(derived.atk * 2, 35, 'harvestSlash');
    }
  }

  function castSmallFireball() {
    if (state.gameState !== 'battle' || !enemy.alive) return;
    if (player.magicCooldown > 0) return showBattleNotice('마법 재사용 대기 중입니다.');
    normalizeKnownMagic();
    const selected = getMagicByKey(player.selectedMagicKey) || getMagicByKey(player.knownMagic[0]);
    if (!selected) return showBattleNotice('보유 마법 없음');
    if (player.mp < selected.mp) return showBattleNotice('MP 부족');
    player.mp -= selected.mp;
    player.magicCooldown = 1.0;
    if (selected.category === 'heal') {
      const heal = Math.max(1, selected.damage);
      player.hp = Math.min(derived.maxHp, player.hp + heal);
    } else if (selected.category === 'defense') {
      player.invincibleTimer = Math.max(player.invincibleTimer, 0.6);
    } else if (selected.category === 'utility') {
      enemy.attackCd = Math.max(enemy.attackCd, 0.8);
    } else {
      applyEnemyDamage(Math.max(1, selected.damage), 16, 'magic');
    }
    showBattleNotice(`${selected.name} 사용`);
  }

  function updateProjectiles(dt) {
    for (const p of projectiles) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      if (p.x + p.w < 0 || p.x > canvas.width) { p.alive = false; continue; }
      if (enemy.alive && rectHit(p, enemy)) {
        applyEnemyDamage(p.damage, 20, 'fireball');
        p.alive = false;
      }
    }
    projectiles = projectiles.filter(p => p.alive);
  }

  function renderProjectiles() {
    for (const p of projectiles) {
      if (p.type !== 'fireball' || !p.alive) continue;
      ctx.fillStyle = '#ff7f11';
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h / 2, Math.max(4, p.w / 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function restartFromDefeat() {
    state.floor = 1;
    state.gameState = 'initialStatAllocate';
    state.innerPhase = null;
    state.innerActionsDone = { clearReset: false, fiveLevelPlus: false, rewardConfirmed: false };
    state.floorClearResolved = false;
    state.floorRewardClaimed = false;
    state.pendingFloorClearResolve = false;
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
    clearCombatFeedback();
    enemy.windupTimer = 0;
    enemy.pendingAttack = false;
    spawnEnemy();
  }

  function updateBattle(dt) {
    if (state.gameState !== 'battle') return;
    if (hitStopTimer > 0) {
      hitStopTimer = Math.max(0, hitStopTimer - dt);
      return;
    }
    if (keys.skill) { useHarvestSlash(); keys.skill = false; }
    if (keys.magic) { castSmallFireball(); keys.magic = false; }
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
        if (inFront && Math.abs(enemy.y - player.y) < 60) applyEnemyDamage(derived.atk, 12, 'basic');
      }
    }

    player.vy += 900 * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));
    if (player.y >= 280) { player.y = 280; player.vy = 0; }
    player.attackCooldown -= dt; player.dashCooldown -= dt;
    player.skillCooldown = Math.max(0, player.skillCooldown - dt);
    player.magicCooldown = Math.max(0, player.magicCooldown - dt);
    player.invincibleTimer = Math.max(0, player.invincibleTimer - dt);
    player.hurtTimer = Math.max(0, player.hurtTimer - dt);
    if (enemy.hurtTimer > 0) enemy.hurtTimer = Math.max(0, enemy.hurtTimer - dt);
    if (enemy.windupTimer > 0) enemy.windupTimer = Math.max(0, enemy.windupTimer - dt);
    updateProjectiles(dt);

    if (enemy.alive && state.gameState === 'battle') {
      enemy.attackCd = Math.max(0, enemy.attackCd - dt);
      const baseSpeed = enemy.speed || 70;
      let speedMul = 1;
      let range = enemy.attackRange || 38;
      if (enemy.aiType === 'fastMelee') speedMul = 1.2;
      if (enemy.aiType === 'tank') speedMul = 0.8;
      if (enemy.aiType === 'guard') speedMul = 0.9;
      if (enemy.aiType === 'flying') speedMul = 1.05;
      const inWindup = enemy.pendingAttack || enemy.windupTimer > 0;
      if (!inWindup) {
        const xDir = Math.sign(player.x - enemy.x);
        enemy.x += xDir * baseSpeed * speedMul * dt;
        if (enemy.aiType === 'flying') {
          const targetY = Math.max(180, Math.min(280, player.y - 40));
          enemy.y += Math.sign(targetY - enemy.y) * Math.min(65 * dt, Math.abs(targetY - enemy.y));
        } else {
          enemy.y = 280;
        }
      }
      enemy.x = Math.max(0, Math.min(canvas.width - enemy.w, enemy.x));
      const yDiff = Math.abs(player.y - enemy.y);
      const inRange = Math.abs(player.x - enemy.x) < range && yDiff < 70;
      if (inRange && enemy.attackCd <= 0 && enemy.windupTimer <= 0 && !enemy.pendingAttack) {
        enemy.pendingAttack = true;
        enemy.windupTimer = 0.25;
        enemy.attackCd = enemy.attackCooldownBase || 1;
      }
      if (enemy.pendingAttack && enemy.windupTimer <= 0) {
        const stillInRange = Math.abs(player.x - enemy.x) < range && Math.abs(player.y - enemy.y) < 70;
        if (stillInRange) {
          const knockback = player.x >= enemy.x ? 28 : -28;
          applyPlayerDamage(enemy.atk, knockback);
        }
        enemy.pendingAttack = false;
      }
    }
  }

  function renderCanvas() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (screenShakeTimer > 0) {
      const n = screenShakeMagnitude;
      const ox = (Math.random() * 2 - 1) * n;
      const oy = (Math.random() * 2 - 1) * n;
      ctx.save();
      ctx.translate(ox, oy);
    }
    ctx.fillStyle = '#1e2f45'; ctx.fillRect(0,330,canvas.width,30);
    renderProjectiles();
    const playerHitFlash = player.hurtTimer > 0 || player.invincibleTimer > 0;
    const flashOn = Math.floor(Date.now() / 80) % 2 === 0;
    ctx.fillStyle = playerHitFlash ? (flashOn ? '#d8ff9b' : '#f3fff8') : '#6be675';
    ctx.fillRect(player.x, player.y, player.w, player.h);
    if (enemy.alive) {
      const enemyColor = enemy.windupTimer > 0 ? '#ffb347' : (enemy.hurtTimer > 0 ? '#ffd6d6' : (enemy.color || '#ff6b6b'));
      ctx.fillStyle = enemyColor;
      if (enemy.typeId === 'slime') {
        ctx.beginPath();
        ctx.ellipse(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.w / 2, enemy.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (enemy.typeId === 'bat') {
        ctx.fillRect(enemy.x + 8, enemy.y + 8, enemy.w - 16, enemy.h - 8);
        ctx.beginPath();
        ctx.moveTo(enemy.x + 8, enemy.y + 14);
        ctx.lineTo(enemy.x - 4, enemy.y + 2);
        ctx.lineTo(enemy.x + 4, enemy.y + 18);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(enemy.x + enemy.w - 8, enemy.y + 14);
        ctx.lineTo(enemy.x + enemy.w + 4, enemy.y + 2);
        ctx.lineTo(enemy.x + enemy.w - 4, enemy.y + 18);
        ctx.fill();
      } else if (enemy.typeId === 'hungryWolf') {
        ctx.fillRect(enemy.x, enemy.y + 8, enemy.w, enemy.h - 8);
        ctx.beginPath();
        ctx.moveTo(enemy.x + 8, enemy.y + 8);
        ctx.lineTo(enemy.x + 14, enemy.y - 2);
        ctx.lineTo(enemy.x + 18, enemy.y + 8);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(enemy.x + 20, enemy.y + 8);
        ctx.lineTo(enemy.x + 26, enemy.y - 2);
        ctx.lineTo(enemy.x + 30, enemy.y + 8);
        ctx.fill();
      } else {
        ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.fillText(enemy.name || '', enemy.x, Math.max(14, enemy.y - 4));
      if (enemy.windupTimer > 0) {
        ctx.fillStyle = '#ffe066';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('!', enemy.x + enemy.w / 2 - 3, Math.max(12, enemy.y - 12));
      }
    }
    if (keys.skill) { ctx.fillStyle='#ffe066'; ctx.fillRect(10,10,20,20); }
    if (keys.magic) { ctx.fillStyle='#a29bfe'; ctx.fillRect(40,10,20,20); }
    if (screenShakeTimer > 0) ctx.restore();
  }

  function loop(t) {
    if (!loop.last) loop.last = t;
    const dt = Math.min(0.033, (t - loop.last) / 1000);
    loop.last = t;
    if (state.gameState === 'battle') updateBattle(dt);
    if (screenShakeTimer > 0) {
      screenShakeTimer = Math.max(0, screenShakeTimer - dt);
      if (screenShakeTimer === 0) screenShakeMagnitude = 0;
    }
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
      debugMessage: state.debugMessage,
    };
    const backupPlayer = JSON.parse(JSON.stringify(player));
    const backupEnemy = JSON.parse(JSON.stringify(enemy));
    const backupDerived = JSON.parse(JSON.stringify(derived));
    const backupTransientNotice = JSON.parse(JSON.stringify(transientNotice));
    const backupKeys = JSON.parse(JSON.stringify(keys));
    const backupProjectiles = JSON.parse(JSON.stringify(projectiles));
    const backupHitStopTimer = hitStopTimer;
    const backupScreenShakeTimer = screenShakeTimer;
    const backupScreenShakeMagnitude = screenShakeMagnitude;
    const backupLocalSave = localStorage.getItem(SAVE_KEY);
    const results = {};
    try {
      const oldLooks = player.looks; player.looks = 1;
      const rc = rewardConfig(); results.rewardConfigLooks1 = rc.candidateCount === 2 && rc.pickCount === 1;
      player.looks = oldLooks;

      const oldStr = player.str, oldVit = player.vit;
      player.str = 1; player.vit = 1; syncVitals(); results.attackFormulaDiv10 = computeDerived().baseAtk === (Math.floor((1+1)/10)+2);
      player.str = oldStr; player.vit = oldVit; syncVitals();

      state.gameState = 'battle'; enemy.alive = true; enemy.hp = 1;
      applyEnemyDamage(2, 0, 'test');
      results.enemyKillToInnerWorld = state.gameState === 'innerWorld' && state.innerPhase === 'menu' && enemy.alive === false;

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
      state.pendingFloorClearResolve = true;
    enterInnerWorld();
      results.enterInnerWorldDoesNotAutoClearOrLevel = state.gameState === 'innerWorld' && state.innerPhase === 'menu' && player.level === levelBeforeInner;

      player.level = 1; player.int = 1; player.inner = 0; player.swordAura = 1; syncVitals();
      results.swordAuraMpModifierApplied = derived.maxMp === 0;

      state.gameState = 'battle'; state.innerPhase = null; player.hp = 1; player.invincibleTimer = 0;
      enemy.attackCd = 0; enemy.atk = 10; enemy.alive = true; enemy.x = player.x;
      applyPlayerDamage(enemy.atk, 0);
      results.playerDeathToDefeatState = state.gameState === 'defeated' && player.hp === 0;
      resetInput();
      clearCombatFeedback();
      keys.left = true; keys.attack = true;
      const xBeforeDefeated = player.x;
      const enemyHpBeforeDefeated = enemy.hp;
      updateBattle(0.016);
      results.defeatedStopsBattleInput = player.x === xBeforeDefeated && enemy.hp === enemyHpBeforeDefeated && state.gameState === 'defeated';

      state.gameState = 'battle'; resetInput(); clearCombatFeedback(); keys.skill = true; keys.magic = true;
      updateBattle(0.016);
      results.skillMagicButtonsSafe = transientNotice.text.length > 0 && state.gameState === 'battle';

      state.gameState = 'battle'; resetInput(); clearCombatFeedback(); enemy.alive = true; enemy.hp = 100; enemy.x = player.x + 40; enemy.y = player.y;
      player.mp = 100; player.skillCooldown = 0; player.facing = 1;
      const mpBeforeSkill = player.mp;
      useHarvestSlash();
      results.harvestSlashConsumesMp = player.mp === mpBeforeSkill - 20;
      const hpBeforeSlash = enemy.hp;
      player.skillCooldown = 0;
      useHarvestSlash();
      results.harvestSlashDamagesEnemy = enemy.hp < hpBeforeSlash;
      const hpBeforeRepeat = enemy.hp;
      const mpBeforeRepeat = player.mp;
      useHarvestSlash();
      results.harvestSlashCooldownBlocksRepeat = enemy.hp === hpBeforeRepeat && player.mp === mpBeforeRepeat;

      resetInput(); clearCombatFeedback();
      player.magicCooldown = 0; player.mp = 100; player.int = 10; enemy.hp = 100; enemy.x = player.x + 30; enemy.y = player.y;
      projectiles = [];
      const mpBeforeMagic = player.mp;
      castSmallFireball();
      results.fireballConsumesMp = player.mp === mpBeforeMagic - 15 && projectiles.length > 0;
      updateProjectiles(0.2);
      results.fireballProjectileHitsEnemy = enemy.hp < 100 && projectiles.length === 0;

      player.mp = 0; player.skillCooldown = 0; enemy.hp = 100; transientNotice = { text: '', until: 0 };
      useHarvestSlash();
      results.skillFailsWithoutMp = player.mp === 0 && enemy.hp === 100 && transientNotice.text.includes('MP가 부족');
      player.magicCooldown = 0; projectiles = []; transientNotice = { text: '', until: 0 };
      castSmallFireball();
      results.magicFailsWithoutMp = projectiles.length === 0 && transientNotice.text.includes('MP가 부족');

      projectiles = [{ type:'fireball', x:10, y:10, vx:0, w:10, h:10, damage:1, alive:true }];
      state.floor = 1; state.gameState = 'innerWorld'; state.innerPhase = 'nextFloor';
      goNextFloor();
      results.projectilesClearOnNextFloor = projectiles.length === 0;


      player.level = 9; player.coin = 33; player.str = 7; player.agi = 6; player.vit = 5; player.int = 4; player.wis = 3; player.looks = 2;
      player.outer = 2; player.inner = 1; player.swordAura = 3; player.multicasting = 4;
      player.inventory = ['외공서']; player.knownMagic = ['기초 마법서'];
      state.statusEffects = ['dummy']; state.floor = 5; state.gameState = 'defeated'; state.innerPhase = 'shop';
      restartFromDefeat();
      results.restartFromDefeatResetsRun =
        state.floor === 1 && state.gameState === 'initialStatAllocate' && state.innerPhase === null &&
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
      results.skillMagicCooldownSavedOrResetSafely = Number.isFinite(serialized.player.skillCooldown) && Number.isFinite(serialized.player.magicCooldown) && serialized.player.skillCooldown >= 0 && serialized.player.magicCooldown >= 0;

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



      state.gameState = 'battle'; state.innerPhase = null; player.hp = 30; player.invincibleTimer = 0; player.hurtTimer = 0;
      const hpBeforePlayerDamage = player.hp;
      results.applyPlayerDamageReducesHp = applyPlayerDamage(5, 0) && player.hp === hpBeforePlayerDamage - 5;

      const hpBeforeBlocked = player.hp;
      const blocked = applyPlayerDamage(5, 0) === false;
      results.playerInvincibilityBlocksRepeatDamage = blocked && player.hp === hpBeforeBlocked;
      results.playerDamageSetsHurtTimer = player.hurtTimer > 0;

      player.invincibleTimer = 0;
      player.x = 2;
      applyPlayerDamage(1, -200);
      results.playerDamageKnockbackClamps = player.x >= 0;

      state.gameState = 'battle'; state.innerPhase = null; player.hp = 1; player.invincibleTimer = 0;
      applyPlayerDamage(5, 0);
      results.playerDamageCanDefeat = state.gameState === 'defeated' && player.hp === 0;

      state.gameState = 'battle'; state.innerPhase = null; resetInput(); clearCombatFeedback(); enemy.alive = true; player.hp = 40; player.invincibleTimer = 0;
      enemy.x = player.x + 20; enemy.y = player.y; enemy.attackCd = 0; enemy.windupTimer = 0; enemy.pendingAttack = false;
      const hpBeforeWindup = player.hp;
      updateBattle(0.016);
      const windupStarted = enemy.pendingAttack || enemy.windupTimer > 0;
      const noInstantDamage = player.hp === hpBeforeWindup;
      updateBattle(0.3);
      results.enemyAttackUsesWindup = windupStarted && noInstantDamage && player.hp < hpBeforeWindup;

      state.gameState = 'battle'; resetInput(); clearCombatFeedback(); enemy.alive = true; player.hp = 40; player.invincibleTimer = 0;
      enemy.x = player.x + 20; enemy.y = player.y; enemy.attackCd = 0; enemy.windupTimer = 0; enemy.pendingAttack = false;
      updateBattle(0.016);
      player.x = canvas.width - player.w;
      const hpBeforeMiss = player.hp;
      updateBattle(0.3);
      results.enemyAttackMissesIfOutOfRangeAfterWindup = player.hp === hpBeforeMiss;

      state.gameState = 'battle'; resetInput(); clearCombatFeedback(); enemy.alive = true; player.hp = 40; player.invincibleTimer = 0;
      enemy.x = player.x + 20; enemy.y = player.y; enemy.attackCd = 0; enemy.windupTimer = 0; enemy.pendingAttack = false;
      updateBattle(0.016);
      const windupX = enemy.x;
      const windupY = enemy.y;
      updateBattle(0.12);
      results.enemyStopsMovingDuringWindup = enemy.pendingAttack && enemy.x === windupX && enemy.y === windupY;

      state.gameState = 'innerWorld'; state.innerPhase = 'nextFloor';
      player.invincibleTimer = 0.5; player.hurtTimer = 0.5; enemy.windupTimer = 0.5; enemy.pendingAttack = true;
      goNextFloor();
      results.playerHitStateClearsOnNextFloor = player.invincibleTimer === 0 && player.hurtTimer === 0 && enemy.windupTimer === 0 && enemy.pendingAttack === false;

      player.invincibleTimer = 0.5; player.hurtTimer = 0.5; enemy.windupTimer = 0.5; enemy.pendingAttack = true;
      const hitStateData = serializeGameState();
      applySerializedGameState(hitStateData);
      results.loadClearsPlayerHitState = player.invincibleTimer === 0 && player.hurtTimer === 0 && enemy.windupTimer === 0 && enemy.pendingAttack === false;

      state.gameState = 'battle'; enemy.alive = true; enemy.hp = 20; enemy.hurtTimer = 0; clearCombatFeedback();
      applyEnemyDamage(5, 0, 'test');
      results.applyEnemyDamageReducesHp = enemy.hp === 15;
      results.applyEnemyDamageSetsHurtTimer = enemy.hurtTimer > 0;
      results.applyEnemyDamageTriggersHitStop = hitStopTimer > 0;
      results.applyEnemyDamageTriggersScreenShake = screenShakeTimer > 0;

      state.gameState = 'battle'; state.innerPhase = null; enemy.alive = true; enemy.hp = 1; clearCombatFeedback();
      applyEnemyDamage(5, 0, 'test');
      const stableAfterRepeatDefeat = handleEnemyDefeated('test') === false;
      results.enemyDefeatEntersInnerWorldOnce = state.gameState === 'innerWorld' && state.innerPhase === 'menu' && enemy.alive === false && stableAfterRepeatDefeat;

      state.gameState = 'battle'; state.innerPhase = null; resetInput(); clearCombatFeedback(); enemy.alive = true; enemy.hp = 100; enemy.hurtTimer = 0; enemy.x = player.x + 40; enemy.y = player.y;
      keys.attack = true; player.attackCooldown = 0; player.facing = 1;
      updateBattle(0.016);
      results.basicAttackUsesApplyEnemyDamage = enemy.hurtTimer > 0 || hitStopTimer > 0;

      state.gameState = 'battle'; state.innerPhase = null; enemy.alive = true; enemy.hp = 1; enemy.x = player.x + 20; enemy.y = player.y;
      projectiles = [{ type:'fireball', x: enemy.x, y: enemy.y, vx:0, w:12, h:12, damage:2, alive:true }];
      updateProjectiles(0.016);
      results.fireballKillEntersInnerWorld = state.gameState === 'innerWorld';

      hitStopTimer = 0.5; screenShakeTimer = 0.5; screenShakeMagnitude = 4; enemy.hurtTimer = 0.3;
      state.floor = 1; state.gameState = 'innerWorld'; state.innerPhase = 'nextFloor';
      goNextFloor();
      results.combatFeedbackClearsOnNextFloor = hitStopTimer === 0 && screenShakeTimer === 0 && screenShakeMagnitude === 0 && enemy.hurtTimer === 0;

      hitStopTimer = 0.5; screenShakeTimer = 0.5; screenShakeMagnitude = 4; enemy.hurtTimer = 0.3;
      const dataForLoadClear = serializeGameState();
      applySerializedGameState(dataForLoadClear);
      results.loadClearsCombatFeedback = hitStopTimer === 0 && screenShakeTimer === 0 && screenShakeMagnitude === 0 && enemy.hurtTimer === 0 && projectiles.length === 0;

      state.innerPhase = 'shop';
      state.shopMessage = '테스트';
      state.shopMessage = '';
      state.innerPhase = 'menu';
      results.shopExitReturnsToMenu = state.innerPhase === 'menu' && state.shopMessage === '';


      state.gameState = 'initialStatAllocate';
      state.statAllocationBase = null;
      player.str = 1; player.agi = 1; player.vit = 1; player.int = 1; player.wis = 1; player.looks = 1;
      syncVitals();
      renderPhasePanel();
      const initialPlusButton = phasePanel.querySelector('.stat-plus[data-key="str"]');
      const strBeforeInitialPlus = player.str;
      if (initialPlusButton && typeof initialPlusButton.onclick === 'function') initialPlusButton.onclick();
      results.initialStatButtonsRemainBoundAfterSaveControls = player.str === strBeforeInitialPlus + 1;

      state.gameState = 'initialStatAllocate';
      state.statAllocationBase = null;
      player.str = 1; player.agi = 1; player.vit = 1; player.int = 1; player.wis = 1; player.looks = 1;
      syncVitals();
      renderPhasePanel();
      const recommendBtn = document.getElementById('recommendedInitialStats');
      if (recommendBtn && typeof recommendBtn.onclick === 'function') recommendBtn.onclick();
      results.initialRecommendedButtonRemainBoundAfterSaveControls =
        player.str === 16 && player.agi === 8 && player.vit === 21 && player.int === 5 && player.wis === 5 && player.looks === 5;

      state.gameState = 'initialStatAllocate';
      state.statAllocationBase = null;
      player.str = 1; player.agi = 1; player.vit = 1; player.int = 1; player.wis = 1; player.looks = 1;
      syncVitals();
      renderPhasePanel();
      const startBattleBtn = document.getElementById('startFloorOneBattle');
      if (startBattleBtn && typeof startBattleBtn.onclick === 'function') startBattleBtn.onclick();
      results.initialStartBattleButtonRemainBoundAfterSaveControls = state.gameState === 'battle';

      state.gameState = 'innerWorld';
      state.innerPhase = 'statAllocate';
      state.statAllocationBase = null;
      player.level = 10; player.str = 10; player.agi = 10; player.vit = 10; player.int = 10; player.wis = 10; player.looks = 10;
      syncVitals();
      renderPhasePanel();
      const statAllocatePlusButton = phasePanel.querySelector('.stat-plus[data-key="str"]');
      const strBeforeAllocatePlus = player.str;
      if (statAllocatePlusButton && typeof statAllocatePlusButton.onclick === 'function') statAllocatePlusButton.onclick();
      results.statAllocateButtonsRemainBoundAfterSaveControls = player.str === strBeforeAllocatePlus + 1;

      state.gameState = 'innerWorld';
      state.innerPhase = 'rewardPick';
      state.rewardCandidates = ['추가 코인 +2', '외공서'];
      state.rewardMeta = { candidateCount: 2, pickCount: 1 };
      state.rewardSelected = new Set();
      renderPhasePanel();
      const rewardPickButton = phasePanel.querySelector('.pick[data-idx="0"]');
      if (rewardPickButton && typeof rewardPickButton.onclick === 'function') rewardPickButton.onclick();
      results.rewardPickButtonsRemainBoundAfterSaveControls = state.rewardSelected.has(0);

      state.gameState = 'innerWorld';
      state.innerPhase = 'shop';
      player.coin = 999;
      player.inventory = [];
      renderPhasePanel();
      const shopBuyButton = phasePanel.querySelector('.shop-buy');
      const inventoryBeforeBuy = player.inventory.length;
      if (shopBuyButton && typeof shopBuyButton.onclick === 'function') shopBuyButton.onclick();
      results.shopButtonsRemainBoundAfterSaveControls = player.inventory.length > inventoryBeforeBuy;


      state.gameState = 'innerWorld';
      state.pendingFloorClearResolve = true;
    enterInnerWorld();
      results.enterInnerWorldStartsAtMenu = state.innerPhase === 'menu';
      renderPhasePanel();
      const menuIds = ['btnClear','btnLvl','btnReward','btnStat','btnItem','btnShop','btnNext'];
      results.innerWorldMenuButtonsBound = menuIds.every((id) => {
        const el = document.getElementById(id);
        return !!el && typeof el.onclick === 'function';
      });
      const levelBeforeTwice = player.level;
      const menuLvlBtn = document.getElementById('btnLvl');
      if (menuLvlBtn && typeof menuLvlBtn.onclick === 'function') menuLvlBtn.onclick();
      const afterFirst = player.level;
      if (menuLvlBtn && typeof menuLvlBtn.onclick === 'function') menuLvlBtn.onclick();
      results.innerWorldFiveLevelPlusOneTimeOnly = afterFirst === levelBeforeTwice + 5 && player.level === afterFirst;
      state.rewardCandidates = ['코인 +2', '외공서']; state.rewardSelected = new Set([0]); state.rewardMeta = { candidateCount: 2, pickCount: 1 };
      state.innerPhase = 'rewardPick';
      renderPhasePanel();
      const confirmRewardBtn = document.getElementById('confirmReward');
      if (confirmRewardBtn && typeof confirmRewardBtn.onclick === 'function') confirmRewardBtn.onclick();
      const rewardDoneOnce = state.innerActionsDone.rewardConfirmed === true;
      state.innerPhase = 'menu'; renderPhasePanel();
      const rewardMenuBtn = document.getElementById('btnReward');
      if (rewardMenuBtn && typeof rewardMenuBtn.onclick === 'function') rewardMenuBtn.onclick();
      results.innerWorldRewardNotInfinite = rewardDoneOnce && state.innerPhase === 'rewardPick';
      state.gameState = 'battle';
      renderPhasePanel();
      const saveBtn = document.getElementById('saveGameBtn');
      const loadBtn = document.getElementById('loadGameBtn');
      const deleteBtn = document.getElementById('deleteSaveBtn');
      results.saveButtonsRemainBoundAfterPhaseRender =
        !!saveBtn && !!loadBtn && !!deleteBtn &&
        typeof saveBtn.onclick === 'function' && typeof loadBtn.onclick === 'function' && typeof deleteBtn.onclick === 'function';
      const debugBtn = document.getElementById('runDebugTestsBtn');
      results.debugTestButtonBoundAfterPhaseRender = !!debugBtn && typeof debugBtn.onclick === 'function';

      state.gameState = 'initialStatAllocate';
      renderPhasePanel();
      const debugBtnInitial = document.getElementById('runDebugTestsBtn');
      results.debugButtonBoundOnInitialStatPhase = !!debugBtnInitial && typeof debugBtnInitial.onclick === 'function';

      state.gameState = 'battle';
      renderPhasePanel();
      const debugBtnBattle = document.getElementById('runDebugTestsBtn');
      results.debugButtonBoundOnBattlePhase = !!debugBtnBattle && typeof debugBtnBattle.onclick === 'function';

      state.gameState = 'defeated';
      renderPhasePanel();
      const debugBtnDefeated = document.getElementById('runDebugTestsBtn');
      results.debugButtonBoundOnDefeatedPhase = !!debugBtnDefeated && typeof debugBtnDefeated.onclick === 'function';

      state.gameState = 'innerWorld';
      state.innerPhase = 'menu';
      renderPhasePanel();
      const debugBtnInnerWorld = document.getElementById('runDebugTestsBtn');
      results.debugButtonBoundOnInnerWorldPhase = !!debugBtnInnerWorld && typeof debugBtnInnerWorld.onclick === 'function';

      results.enemyTypesDefined = Array.isArray(enemyTypes) && enemyTypes.length === 5 &&
        enemyTypes.some(type => type.id === 'hungryWolf') && enemyTypes.some(type => type.id === 'goblin') &&
        enemyTypes.some(type => type.id === 'slime') && enemyTypes.some(type => type.id === 'skeleton') && enemyTypes.some(type => type.id === 'bat');

      spawnEnemy();
      results.spawnEnemyAssignsType = !!enemy.typeId && !!enemy.name && !!enemy.aiType;

      state.floor = 1; spawnEnemy();
      const floorOneHp = enemy.maxHp;
      const floorOneAtk = enemy.atk;
      state.floor = 5; spawnEnemy();
      results.spawnEnemyScalesByFloor = enemy.maxHp > floorOneHp || enemy.atk > floorOneAtk;

      const oldPicker = pickEnemyTypeForFloor;
      pickEnemyTypeForFloor = () => enemyTypes.find(type => type.id === 'bat');
      state.floor = 1; spawnEnemy();
      pickEnemyTypeForFloor = oldPicker;
      results.flyingEnemyUsesFlyingY = enemy.isFlying && enemy.y <= 240;

      state.gameState = 'battle';
      renderHUD();
      results.enemyHudHasName = hudEl.textContent.includes(enemy.name);

      state.floor = 3; spawnEnemy();
      const enemyTypeBeforeSave = { typeId: enemy.typeId, name: enemy.name, aiType: enemy.aiType };
      const enemyTypeSaveData = serializeGameState();
      applySerializedGameState(enemyTypeSaveData);
      results.enemySaveLoadKeepsType = enemy.typeId === enemyTypeBeforeSave.typeId && enemy.name === enemyTypeBeforeSave.name && enemy.aiType === enemyTypeBeforeSave.aiType;

      results.enemyTypeRenderSafe = enemyTypes.every((type) => {
        enemy.typeId = type.id; enemy.name = type.name; enemy.aiType = type.aiType; enemy.color = type.color;
        enemy.w = type.width; enemy.h = type.height; enemy.y = type.aiType === 'flying' ? 220 : 280; enemy.alive = true;
        try { renderCanvas(); return true; } catch (err) { return false; }
      });

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
      state.debugMessage = backupState.debugMessage;
      if (backupLocalSave === null) localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, backupLocalSave);
      transientNotice = backupTransientNotice;
      resetInput();
      Object.assign(keys, backupKeys);
      projectiles = JSON.parse(JSON.stringify(backupProjectiles));
      hitStopTimer = backupHitStopTimer;
      screenShakeTimer = backupScreenShakeTimer;
      screenShakeMagnitude = backupScreenShakeMagnitude;
      enemy.hurtTimer = typeof backupEnemy.hurtTimer === 'number' ? backupEnemy.hurtTimer : 0;
      enemy.windupTimer = typeof backupEnemy.windupTimer === 'number' ? backupEnemy.windupTimer : 0;
      enemy.pendingAttack = !!backupEnemy.pendingAttack;
      player.invincibleTimer = typeof backupPlayer.invincibleTimer === 'number' ? backupPlayer.invincibleTimer : 0;
      player.hurtTimer = typeof backupPlayer.hurtTimer === 'number' ? backupPlayer.hurtTimer : 0;
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
      JSON.stringify(keys) === JSON.stringify(backupKeys) && JSON.stringify(projectiles) === JSON.stringify(backupProjectiles) &&
      hitStopTimer === backupHitStopTimer && screenShakeTimer === backupScreenShakeTimer && screenShakeMagnitude === backupScreenShakeMagnitude &&
      enemy.hurtTimer === (typeof backupEnemy.hurtTimer === 'number' ? backupEnemy.hurtTimer : 0) &&
      player.invincibleTimer === (typeof backupPlayer.invincibleTimer === 'number' ? backupPlayer.invincibleTimer : 0) &&
      player.hurtTimer === (typeof backupPlayer.hurtTimer === 'number' ? backupPlayer.hurtTimer : 0) &&
      enemy.windupTimer === (typeof backupEnemy.windupTimer === 'number' ? backupEnemy.windupTimer : 0) &&
      enemy.pendingAttack === (!!backupEnemy.pendingAttack);
    return results;
  }

  window.ManRPG = { state, player, enemy, enemyTypes, pickEnemyTypeForFloor, spawnEnemy, rewardConfig, applyFiveLevelPlus, enterInnerWorld, goNextFloor, tryLearnMagic, ensureStatAllocationBase, increaseStat, decreaseStat, finishStatAllocation, finishInitialStatAllocation, applyRecommendedInitialStats, useInventoryItem, removeInventoryAt, getItemSellPrice, getShopItems, buyShopItem, sellInventoryItem, serializeGameState, applySerializedGameState, saveGame, loadGame, deleteSave, useHarvestSlash, castSmallFireball, updateProjectiles, applyEnemyDamage, applyPlayerDamage, handleEnemyDefeated, startHitStop, startScreenShake, runDebugTests, SAVE_KEY };
  spawnEnemy();
  syncVitals();
  requestAnimationFrame(loop);
})();

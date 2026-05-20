(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const hudEl = document.getElementById('hud');
  const phasePanel = document.getElementById('phasePanel');
  const controls = document.getElementById('controls');
  const enemyBarEl = document.getElementById('enemyBar');
  const systemMenuEl = document.getElementById('systemMenu');
  const systemMenuToggleEl = document.getElementById('systemMenuToggle');
  const quickSlotTrayEl = document.getElementById('quickSlotTray');
  const skillMagicOverlayEl = document.getElementById('skillMagicOverlay');
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
    uiOverlay: '',
    quickSlotTab: 'skill',
    quickSlotPage: 0,
    quickSlotCollapsed: true,
    overlayCategory: 'all',
    systemMenuOpen: false,
    skillCraftMessage: '',
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
    knownSkills: ['harvest_slash'], selectedSkillKey: 'harvest_slash',
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
  function spellCategory(name){
    const utility=['라이트','슬립','캔슬레이션','블라인드','슬로우','사일런스','일루젼','컨퓨전','인비저빌리티','디스토션','블링크','디스펠','텔레포트','워프','컨트롤 웨더','워프 게이트','메모라이즈','그리스','디그','다크니스'];
    const defense=['쉴드','디펜스','배리어','리플렉션'];
    const heal=['힐'];
    const area=['플레임 필드','메테오 스웜','라이트닝 월드','아이스 스톰','토네이도','볼케이노','네크로폴리스'];
    const smallArea=['파이어볼','아이스 볼','썬더 브레이크','어스 퀘이크','다크 크리스탈'];
    const singleHigh=['플레임 레이져','라이트닝 인피니티','아이스 저지먼트','윈드 퍼니시먼트','홀리 파워 워드 킬'];
    if (utility.includes(name)) return 'utility';
    if (defense.includes(name)) return 'defense';
    if (heal.includes(name)) return 'heal';
    if (name.startsWith('서먼')) return 'summon';
    if (area.includes(name)) return 'area';
    if (smallArea.includes(name)) return 'smallArea';
    if (singleHigh.includes(name)) return 'singleHigh';
    return 'single';
  }
  function spellPowerRatio(circle,cat){
    const base=Math.min(1,(circle+0.2)/6);
    const rangePenalty={singleHigh:1.00,single:0.86,smallArea:0.68,area:0.45,defense:0.80,heal:0.72,summon:0.60,utility:0.35}[cat]??0.86;
    return Math.min(1,base*rangePenalty);
  }
  function spellManaCost(circle,cat){
    const base=SPELL_MP[circle]||1;
    const costMul={singleHigh:1.00,single:0.95,smallArea:1.05,area:1.15,defense:0.95,heal:1.00,summon:1.15,utility:0.80}[cat]??0.95;
    return Math.max(1,Math.round(base*costMul));
  }
  function spellPower(mp,circle,cat){return Math.min(mp,Math.max(1,Math.floor(mp*spellPowerRatio(circle,cat))));}
  function spellRangeText(category){return {single:'단일',singleHigh:'단일 고집중',smallArea:'소범위',area:'광역',defense:'방어',heal:'회복',summon:'소환',utility:'기능'}[category]||'단일';}
  function makeSpellKey(circle,name){return `c${circle}_`+name.toLowerCase().replace(/[^a-z0-9가-힣]+/g,'_').replace(/^_|_$/g,'');}
  const MAGIC_POOL=[]; Object.keys(SPELLS_BY_CIRCLE).forEach((c)=>{const circle=Number(c); SPELLS_BY_CIRCLE[circle].forEach((name)=>{const category=spellCategory(name); const mp=spellManaCost(circle,category); MAGIC_POOL.push({key:makeSpellKey(circle,name),name,circle,category,rangeText: spellRangeText(category),mp,damage:spellPower(mp,circle,category)});});});
  const SPELL_EFFECTS = {};
  const spellElementByName = (name) => {
    if (/힐|샤이닝|라이트|헤븐|소드/.test(name)) return 'light';
    if (/파이어|인페르노|헬파이어|메테오|볼케이노/.test(name)) return 'fire';
    if (/아이스|블리자드|제로/.test(name)) return 'ice';
    if (/라이트닝|라이데인|썬더/.test(name)) return 'lightning';
    if (/윈드|토네이도|에어로/.test(name)) return 'wind';
    if (/어스|스톤|록|그라운드|그래비티/.test(name)) return 'earth';
    if (/다크|네크로|본/.test(name)) return 'dark';
    return 'neutral';
  };
  MAGIC_POOL.forEach((m) => {
    const effect = { effectType: ['damage'], element: spellElementByName(m.name), duration: 1.8, multiplier: 1 };
    if (m.category === 'heal') effect.effectType = ['heal'];
    if (m.category === 'defense') effect.effectType = ['shield'];
    if (m.category === 'utility') effect.effectType = ['slow'];
    if (m.category === 'summon') effect.effectType = ['summonStrike'];
    if (m.category === 'area') effect.effectType = ['damage', 'dot'];
    if (m.category === 'singleHigh') effect.effectType = ['highDamage'];
    if (/슬립/.test(m.name)) effect.effectType = ['sleep'];
    if (/바인딩|웹|그래비티/.test(m.name)) effect.effectType = ['bind'];
    if (/사일런스/.test(m.name)) effect.effectType = ['silence'];
    if (/블라인드|다크니스|일루젼|컨퓨전/.test(m.name)) effect.effectType = ['blind'];
    if (/디스펠|캔슬/.test(m.name)) effect.effectType = ['cancel'];
    if (/텔레포트|워프|블링크/.test(m.name)) effect.effectType = ['teleport'];
    if (/쉴드|배리어|쉘|리플렉션/.test(m.name)) effect.effectType = ['barrier'];
    if (/드레인|네크로/.test(m.name)) effect.effectType = ['drain','dot'];
    if (/필드|월|웨더|볼케이노/.test(m.name)) effect.effectType = ['field','dot'];
    if (/파워 워드 킬/.test(m.name)) effect.effectType = ['execute'];
    if (/컨트롤 웨더/.test(m.name)) effect.effectType = ['weather','dot','slow'];
    if (/서먼/.test(m.name)) effect.effectType = ['summonStrike'];
    if (/메모라이즈|인첸트/.test(m.name)) effect.effectType = ['buff'];
    SPELL_EFFECTS[m.key] = effect;
  });
  function getSpellEffect(key){ return SPELL_EFFECTS[key] || { effectType:['damage'], element:'neutral', duration:1.2, multiplier:1 }; }
  function getMagicByKey(key){return MAGIC_POOL.find((m)=>m.key===key);}
  function normalizeKnownMagic(){player.knownMagic=player.knownMagic.filter((k)=>typeof k==='string'&&!!getMagicByKey(k)); if(!player.selectedMagicKey||!getMagicByKey(player.selectedMagicKey)){player.selectedMagicKey=player.knownMagic[0]||'';} }
  const SKILL_POOL = [
    { key:'harvest_slash', name:'수확 베기', type:'attack', mp:20, cooldown:1.2, powerMul:2, range:95, knockback:35, description:'기본 수확 낫 베기', tags:['basic'], craftCost:0, requiredLevel:1 },
    { key:'quick_slash', name:'속공 베기', type:'attack', mp:3, cooldown:0.6, powerMul:1.2, range:65, knockback:20, description:'빠르게 연계하는 베기', tags:['quick'], craftCost:3, requiredLevel:1 },
    { key:'heavy_cut', name:'강타 베기', type:'attack', mp:7, cooldown:1.8, powerMul:2.8, range:88, knockback:50, description:'느리지만 강한 일격', tags:['heavy'], craftCost:6, requiredLevel:3 },
    { key:'dash_cut', name:'돌진 베기', type:'dash', mp:6, cooldown:1.5, powerMul:1.8, range:115, knockback:30, description:'짧게 돌진 후 베기', tags:['dash'], craftCost:6, requiredLevel:2 },
    { key:'guard_break', name:'방어 파쇄', type:'break', mp:5, cooldown:1.4, powerMul:1.6, range:90, knockback:28, description:'적의 공격 템포를 무너뜨림', tags:['break'], craftCost:6, requiredLevel:2 },
    { key:'aerial_cut', name:'공중 베기', type:'aerial', mp:5, cooldown:1.1, powerMul:1.7, range:92, knockback:32, description:'점프 중 강화되는 베기', tags:['aerial'], craftCost:6, requiredLevel:2 },
    { key:'focus_cut', name:'집중 베기', type:'focus', mp:8, cooldown:1.6, powerMul:2.2, range:100, knockback:36, description:'MP를 모아 날리는 집중 일격', tags:['focus'], craftCost:6, requiredLevel:4 },
    { key:'wide_sweep', name:'휩쓸기', type:'area', mp:6, cooldown:1.3, powerMul:1.5, range:120, knockback:24, description:'넓게 휘둘러 적을 가격', tags:['area'], craftCost:6, requiredLevel:3 },
  ];
  function getSkillByKey(key){ return SKILL_POOL.find((s)=>s.key===key); }
  function normalizeKnownSkills(){
    const set = new Set((Array.isArray(player.knownSkills) ? player.knownSkills : []).filter((k)=>typeof k==='string'&&!!getSkillByKey(k)));
    set.add('harvest_slash');
    player.knownSkills = [...set];
    if (!player.selectedSkillKey || !set.has(player.selectedSkillKey)) player.selectedSkillKey = 'harvest_slash';
  }

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
    systemMenuToggleEl.onclick = () => { state.systemMenuOpen = !state.systemMenuOpen; renderSystemMenu(); };
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
    enemy.slowTimer = 0; enemy.bindTimer = 0; enemy.sleepTimer = 0; enemy.blindTimer = 0; enemy.silenceTimer = 0;
    enemy.dotTimer = 0; enemy.dotDamage = 0; enemy.dotTick = 0;
  }
  function clearMagicTemporaryEffects() {
    enemy.slowTimer = 0; enemy.bindTimer = 0; enemy.sleepTimer = 0; enemy.blindTimer = 0; enemy.silenceTimer = 0;
    enemy.dotTimer = 0; enemy.dotDamage = 0; enemy.dotTick = 0;
    player.magicShieldTimer = 0; player.magicBarrier = 0; player.magicBuffTimer = 0; player.magicAttackBonus = 0;
    player.magicEvasionTimer = 0; player.magicCooldownDiscount = 0;
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
      },
      player: {
        name: player.name, title: player.title, mantra: player.mantra,
        level: player.level, coin: player.coin,
        str: player.str, agi: player.agi, vit: player.vit, int: player.int, wis: player.wis, looks: player.looks,
        outer: player.outer, inner: player.inner, swordAura: player.swordAura, multicasting: player.multicasting,
        x: player.x, y: player.y, vx: player.vx, vy: player.vy, hp: player.hp, mp: player.mp,
        attackCooldown: player.attackCooldown, dashCooldown: player.dashCooldown, facing: player.facing,
        skillCooldown: player.skillCooldown, magicCooldown: player.magicCooldown,
        knownSkills: [...player.knownSkills], selectedSkillKey: player.selectedSkillKey,
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
      state.skillCraftMessage = '';
      state.floorClearResolved = !!s.floorClearResolved;
      state.floorRewardClaimed = !!s.floorRewardClaimed;

      Object.assign(player, p);
      player.inventory = [...p.inventory];
      player.knownSkills = Array.isArray(p.knownSkills) ? [...p.knownSkills] : ['harvest_slash'];
      player.selectedSkillKey = typeof p.selectedSkillKey === 'string' ? p.selectedSkillKey : 'harvest_slash';
      player.knownMagic = [...p.knownMagic];
      player.selectedMagicKey = typeof p.selectedMagicKey === 'string' ? p.selectedMagicKey : '';
      normalizeKnownSkills();
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
      clearMagicTemporaryEffects();
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
      normalizeKnownSkills();
      player.skillCooldown = 0;
      player.magicCooldown = 0;
      projectiles = [];
      clearCombatFeedback();
      enemy.hurtTimer = 0;
      enemy.windupTimer = 0;
      enemy.pendingAttack = false;
      player.invincibleTimer = 0;
      player.hurtTimer = 0;
      clearMagicTemporaryEffects();
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
    if (state.floorClearResolved) return false;
    clearReset();
    applyFiveLevelPlus();
    rewardRoll();
    state.floorClearResolved = true;
    state.floorRewardClaimed = false;
    state.innerPhase = state.rewardCandidates.length ? 'rewardPick' : 'menu';
    return true;
  }

  function enterInnerWorld() {
    autoResolveFloorClear();
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
    clearMagicTemporaryEffects();
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
    resetRewardState();
    resetInput();
    transientNotice = { text: '', until: 0 };
    state.statAllocationBase = null;
    resetPlayerForBattle();
    clearCombatFeedback();
    enemy.windupTimer = 0;
    enemy.pendingAttack = false;
    clearMagicTemporaryEffects();
    systemMenuToggleEl.onclick = () => { state.systemMenuOpen = !state.systemMenuOpen; renderSystemMenu(); };
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
    normalizeKnownSkills();
    normalizeKnownMagic();
    const selectedSkill = getSkillByKey(player.selectedSkillKey) || getSkillByKey('harvest_slash');
    const selectedMagic = getMagicByKey(player.selectedMagicKey);
    hudEl.innerHTML = `<div>층 ${state.floor} | Lv ${player.level}</div>
      <div>HP ${Math.floor(player.hp)} / ${derived.maxHp}</div>
      <div>MP ${Math.floor(player.mp)} / ${derived.maxMp}</div>
      <div>코인 ${player.coin}</div>
      <div>공 ${derived.atk} | 방 ${Math.floor(player.vit/2)} | 치 ${Math.floor(player.agi*0.8)}%</div>
      <div class="stat-message">스킬: ${selectedSkill ? selectedSkill.name : '수확 베기'} | 마법: ${selectedMagic ? selectedMagic.name : '없음'}</div>`;
    const enemyHpText = state.gameState === 'innerWorld' ? '클리어 완료' : (enemy.alive ? `${Math.max(0, Math.floor(enemy.hp))} / ${enemy.maxHp}` : '처치됨');
    const ratio = enemy.maxHp > 0 ? Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100)) : 0;
    const showEnemyBar = state.gameState === 'battle';
    enemyBarEl.classList.toggle('hidden', !showEnemyBar);
    enemyBarEl.innerHTML = `<div>${enemy.name || '적'} <span style="float:right">HP ${enemyHpText}</span></div><div class="enemy-hp"><i style="width:${ratio}%"></i></div>`;
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
    document.body.classList.toggle('inner-world-dim', state.gameState === 'innerWorld');
    renderSystemMenu();
  }


  function renderSystemMenu() {
    if (state.systemMenuOpen) state.quickSlotCollapsed = true;
    systemMenuEl.classList.toggle('hidden', !state.systemMenuOpen);
    systemMenuEl.innerHTML = saveButtonsHtml() + debugControlsHtml();
    bindSaveButtons();
    bindDebugButtons();
  }

  function getQuickSlotItems() {
    if (state.quickSlotTab === 'skill') return player.knownSkills.map((k)=>getSkillByKey(k)).filter(Boolean);
    return player.knownMagic.map((k) => getMagicByKey(k)).filter(Boolean);
  }

  function renderQuickSlotTray() {
    normalizeKnownSkills();
    if (state.gameState === 'innerWorld' || state.gameState === 'initialStatAllocate' || state.uiOverlay === 'magic') {
      quickSlotTrayEl.classList.add('hidden');
      return;
    }
    quickSlotTrayEl.classList.remove('hidden');
    quickSlotTrayEl.classList.toggle('collapsed', state.quickSlotCollapsed);
    const items = getQuickSlotItems();
    const pageSize = 4; const pages = Math.max(1, Math.ceil(items.length / pageSize));
    state.quickSlotPage = Math.max(0, Math.min(state.quickSlotPage, pages - 1));
    const pageItems = items.slice(state.quickSlotPage * pageSize, state.quickSlotPage * pageSize + pageSize);
    const emptyText = !items.length ? `<div class="stat-message">보유 ${state.quickSlotTab==='skill'?'스킬':'마법'} 없음</div>` : '';
    quickSlotTrayEl.innerHTML = state.quickSlotCollapsed
      ? `<div class="slot-tabs"><button id="toggleTray" style="margin-left:auto">${state.quickSlotTab==='skill'?'퀵슬롯 ▲':'스킬/마법 ▲'}</button></div>`
      : `<div class="slot-tabs"><span>퀵슬롯</span><button id="slotSkillTab">스킬</button><button id="slotMagicTab">마법</button><button id="toggleTray" style="margin-left:auto">접기 ▼</button></div>${emptyText}<div class="slot-grid">${(pageItems.length?pageItems:[null]).map((item)=> item ? `<button class="slot quick-slot-btn ${(state.quickSlotTab==='skill'?player.selectedSkillKey:player.selectedMagicKey)===item.key?'selected':''}" data-key="${item.key}">${item.name}<br>${state.quickSlotTab==='skill' ? `MP${item.mp} CD${item.cooldown}` : `C${item.circle} MP${item.mp}`}</button>` : '<button class="slot" disabled>빈</button>').join('')}</div><div class="slot-page"><button id="slotPrev">◀</button><span>${state.quickSlotPage+1} / ${pages}</span><button id="slotNext">▶</button></div>`;
    const slotSkillTab = document.getElementById('slotSkillTab');
    const slotMagicTab = document.getElementById('slotMagicTab');
    if (slotSkillTab) slotSkillTab.onclick = ()=>{state.quickSlotTab='skill';state.quickSlotPage=0;renderQuickSlotTray();};
    if (slotMagicTab) slotMagicTab.onclick = ()=>{state.quickSlotTab='magic';state.quickSlotPage=0;renderQuickSlotTray();};
    document.getElementById('toggleTray').onclick = ()=>{state.quickSlotCollapsed=!state.quickSlotCollapsed;renderQuickSlotTray();};
    const prev=document.getElementById('slotPrev'); const next=document.getElementById('slotNext');
    if(prev) prev.onclick=()=>{state.quickSlotPage=Math.max(0,state.quickSlotPage-1);renderQuickSlotTray();};
    if(next) next.onclick=()=>{state.quickSlotPage=Math.min(pages-1,state.quickSlotPage+1);renderQuickSlotTray();};
    quickSlotTrayEl.querySelectorAll('.quick-slot-btn').forEach((btn)=>btn.onclick=()=>{
      if(state.quickSlotTab==='magic'){
        player.selectedMagicKey=btn.dataset.key;
      } else {
        normalizeKnownSkills();
        player.selectedSkillKey=btn.dataset.key;
        const skill = getSkillByKey(player.selectedSkillKey);
        if (skill) {
          if (state.gameState === 'battle') showBattleNotice(`선택 스킬: ${skill.name}`);
          else state.skillCraftMessage = `선택 스킬: ${skill.name}`;
        }
      }
      renderQuickSlotTray(); renderHUD();
    });
  }

    function renderPhasePanel() {
    const notice = transientNotice.until > Date.now() ? `<div class="warn">${transientNotice.text}</div>` : '';
    if (state.gameState === 'initialStatAllocate') {
      phasePanel.className='phase-panel modal-card';
      ensureStatAllocationBase();
      const statLabels = [
        ['str', '힘'],
        ['agi', '민첩'],
        ['vit', '체력'],
        ['int', '지능'],
        ['wis', '지혜'],
        ['looks', '외모'],
      ];
      const warning = remainingPoints() > 0 ? `<div class="warn">남은 포인트 ${remainingPoints()}가 있습니다.</div>` : '';
      phasePanel.innerHTML = `<div>초기 스탯 분배</div>
        <div>1층 전투 시작 전, 시작 스탯 포인트를 분배하세요.</div>
        <div>남은 포인트: ${remainingPoints()}</div>
        <div>총 스탯 포인트: ${totalStatPoints()}</div>
        <div>스탯 최대치: ${statMax()}</div>
        <div class="stat-grid">${statLabels.map(([key, label]) => {
          const canIncrease = remainingPoints() > 0 && player[key] < statMax();
          const canDecrease = state.statAllocationBase && player[key] > state.statAllocationBase[key];
          return `<div class="stat-row"><span>${label} ${player[key]}</span><div><button class="stat-minus" data-key="${key}" ${canDecrease ? '' : 'disabled'}>-</button><button class="stat-plus" data-key="${key}" ${canIncrease ? '' : 'disabled'}>+</button></div></div>`;
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
      phasePanel.className='phase-panel compact-notice';
      const n1 = '적 처치 시 심상세계 진입';
      const n2 = `선택 마법: ${(getMagicByKey(player.selectedMagicKey)||{name:'없음',circle:'-',mp:0}).name} / C${(getMagicByKey(player.selectedMagicKey)||{circle:'-'}).circle} / MP ${(getMagicByKey(player.selectedMagicKey)||{mp:0}).mp}`;
      phasePanel.innerHTML = `<div>${n1}</div><div>${n2}</div>${notice}`;
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
      const rewardStatus = action.rewardConfirmed ? '보상 완료' : (state.rewardCandidates.length ? '보상 선택중' : '보상 대기');
      phasePanel.className='phase-panel modal-card';
      phasePanel.innerHTML = `<div><b>심상세계</b></div><div>층 ${state.floor} | Lv ${player.level} | HP ${Math.floor(player.hp)}/${derived.maxHp} | MP ${Math.floor(player.mp)}/${derived.maxMp} | 코인 ${player.coin}</div>
      <div class="stat-actions inner-world-menu-grid">
        <button id="btnReward">${state.floorRewardClaimed ? "보상 완료" : "보상"}</button>
        <button id="btnStat">스탯</button>
        <button id="btnSkill">스킬</button>
        <button id="btnItem">아이템</button>
        <button id="btnShop">상점</button>
        <button id="btnNext">다음 층</button>
      </div><div>선택 스킬: ${(getSkillByKey(player.selectedSkillKey)||{name:'수확 베기'}).name} | 선택 마법: ${(getMagicByKey(player.selectedMagicKey)||{name:'없음',circle:'-',mp:0}).name} / C${(getMagicByKey(player.selectedMagicKey)||{circle:'-'}).circle} / MP ${(getMagicByKey(player.selectedMagicKey)||{mp:0}).mp} | 인벤 ${player.inventory.length}개</div>${notice}`;
      const btnReward = document.getElementById('btnReward');
      if (btnReward) {
        btnReward.disabled = !!state.floorRewardClaimed;
        btnReward.onclick=()=>{
          if (state.floorRewardClaimed) { transientNotice = { text: '보상 완료', until: Date.now() + 1200 }; renderPhasePanel(); return; }
          state.innerPhase='rewardPick'; renderPhasePanel();
        };
      }
      document.getElementById('btnStat').onclick=()=>{ state.innerPhase='statAllocate'; renderPhasePanel(); };
      document.getElementById('btnSkill').onclick=()=>{ state.innerPhase='skillCraft'; renderPhasePanel(); };
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
        if (state.floorRewardClaimed || state.innerActionsDone.rewardConfirmed) { transientNotice = { text: '보상 완료', until: Date.now() + 1200 }; state.innerPhase = 'menu'; return; }
        if (state.rewardSelected.size !== state.rewardMeta.pickCount) return;
        [...state.rewardSelected].forEach(i => applyReward(state.rewardCandidates[i]));
        state.rewardSelected = new Set();
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
    } else if (p === 'skillCraft') {
      normalizeKnownSkills();
      const selectedSkill = getSkillByKey(player.selectedSkillKey) || getSkillByKey('harvest_slash');
      const craftMsg = state.skillCraftMessage ? `<div class="stat-message">${state.skillCraftMessage}</div>` : '';
      const skillRows = SKILL_POOL.map((s) => {
        const owned = player.knownSkills.includes(s.key);
        const reason = owned ? '보유중' : (player.level < s.requiredLevel ? 'Lv 부족' : (player.coin < s.craftCost ? '코인 부족' : ''));
        const canCraft = !owned && !reason && s.craftCost > 0;
        return `<div class="stat-row"><span>${s.name} | MP ${s.mp} CD ${s.cooldown} | 비용 ${s.craftCost} | Lv ${s.requiredLevel}<br>${s.description}</span><div><button class="skill-select" data-key="${s.key}" ${owned?'':'disabled'}>선택</button><button class="skill-craft" data-key="${s.key}" ${canCraft?'':'disabled'}>${owned?'보유중':'제작'}</button>${reason?`<div class="stat-message">${reason}</div>`:''}</div></div>`;
      }).join('');
      phasePanel.innerHTML = `<div><b>스킬 제작</b></div><div>코인 ${player.coin} | 보유 스킬 ${player.knownSkills.length} | 선택 스킬 ${selectedSkill.name}</div>${craftMsg}<div class="stat-grid">${skillRows}</div><button id="skillCraftBack">메뉴로</button>`;
      phasePanel.querySelectorAll('.skill-select').forEach((btn)=>btn.onclick=()=>{ normalizeKnownSkills(); player.selectedSkillKey = btn.dataset.key; const skill = getSkillByKey(player.selectedSkillKey); state.skillCraftMessage = skill ? `선택 스킬: ${skill.name}` : '선택 스킬: 수확 베기'; renderPhasePanel(); renderHUD(); renderQuickSlotTray();});
      phasePanel.querySelectorAll('.skill-craft').forEach((btn)=>btn.onclick=()=>{ craftSkill(btn.dataset.key); renderPhasePanel(); renderHUD(); renderQuickSlotTray();});
      document.getElementById('skillCraftBack').onclick = ()=>{ state.innerPhase='menu'; renderPhasePanel(); };
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
    let finalDamage = damage;
    if ((player.magicShieldTimer || 0) > 0) finalDamage = Math.max(1, Math.floor(finalDamage * 0.7));
    if ((player.magicBarrier || 0) > 0) {
      const blocked = Math.min(player.magicBarrier, Math.floor(finalDamage * 0.75));
      player.magicBarrier -= blocked;
      finalDamage -= blocked;
    }
    if ((player.magicEvasionTimer || 0) > 0 && Math.random() < 0.35) return false;
    player.hp -= Math.max(1, finalDamage);
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
    return applySkillEffect(getSkillByKey('harvest_slash'));
  }
  function craftSkill(skillKey){
    const skill = getSkillByKey(skillKey); if (!skill) return false;
    if (player.knownSkills.includes(skill.key)) return state.skillCraftMessage = '이미 보유한 스킬', false;
    if (player.level < skill.requiredLevel) return state.skillCraftMessage = '레벨 부족', false;
    if (player.coin < skill.craftCost) return state.skillCraftMessage = '코인 부족', false;
    player.coin -= skill.craftCost; player.knownSkills.push(skill.key); normalizeKnownSkills();
    state.skillCraftMessage = `스킬 제작 완료: ${skill.name}`;
    return true;
  }
  function useSelectedSkill(){ normalizeKnownSkills(); return applySkillEffect(getSkillByKey(player.selectedSkillKey || 'harvest_slash')); }
  function applySkillEffect(skill){
    normalizeKnownSkills();
    const selected = skill && player.knownSkills.includes(skill.key) ? skill : getSkillByKey('harvest_slash');
    if (!skill || !player.knownSkills.includes(skill.key)) {
      player.selectedSkillKey = 'harvest_slash';
      showBattleNotice('기본 스킬로 복구');
    }
    if (state.gameState !== 'battle' || !enemy.alive) return false;
    if (player.skillCooldown > 0) return showBattleNotice('스킬 재사용 대기 중'), false;
    if (player.mp < selected.mp) return showBattleNotice('MP 부족'), false;
    if (selected.key === 'dash_cut') player.x = Math.max(0, Math.min(canvas.width - player.w, player.x + (player.facing * 40)));
    player.mp -= selected.mp; player.skillCooldown = selected.cooldown; showBattleNotice(`${selected.name}!`);
    const inFront = player.facing === 1 ? (enemy.x - (player.x + player.w) <= selected.range && enemy.x >= player.x) : (player.x - (enemy.x + enemy.w) <= selected.range && enemy.x <= player.x);
    if (!inFront || Math.abs(enemy.y - player.y) > 70) return true;
    let dmg = derived.atk * selected.powerMul;
    if (selected.key === 'aerial_cut' && (Math.abs(player.vy) > 1 || player.y < 279)) dmg *= 1.35;
    applyEnemyDamage(dmg, selected.knockback, selected.key === 'harvest_slash' ? 'harvestSlash' : 'skill');
    if (selected.key === 'guard_break') enemy.attackCd = Math.max(enemy.attackCd, 1.2);
    return true;
  }

  function applyMagicEffect(selected) {
    const effect = getSpellEffect(selected.key);
    const baseDamage = Math.max(1, selected.damage + Math.floor((player.magicAttackBonus || 0)));
    const typeList = Array.isArray(effect.effectType) ? effect.effectType : [effect.effectType];
    if (typeList.includes('execute')) {
      if (enemy.hp <= enemy.maxHp * 0.3) applyEnemyDamage(enemy.hp, 8, 'magic'); else applyEnemyDamage(Math.floor(baseDamage * 1.4), 12, 'magic');
    }
    if (typeList.includes('highDamage')) applyEnemyDamage(Math.floor(baseDamage * 1.35), 16, 'magic');
    if (typeList.includes('damage')) applyEnemyDamage(baseDamage, 10, 'magic');
    if (typeList.includes('summonStrike')) applyEnemyDamage(Math.floor(baseDamage * 1.2), 20, 'magic');
    if (typeList.includes('drain')) { applyEnemyDamage(Math.floor(baseDamage * 0.85), 8, 'magic'); player.hp = Math.min(derived.maxHp, player.hp + Math.max(1, Math.floor(baseDamage * 0.35))); }
    if (typeList.includes('heal')) player.hp = Math.min(derived.maxHp, player.hp + Math.max(1, Math.floor(baseDamage * 1.1)));
    if (typeList.includes('shield')) player.magicShieldTimer = Math.max(player.magicShieldTimer || 0, 2.2);
    if (typeList.includes('barrier')) player.magicBarrier = Math.max(player.magicBarrier || 0, Math.floor(baseDamage * (selected.circle >= 9 ? 1.6 : 0.8)));
    if (typeList.includes('buff')) { player.magicBuffTimer = Math.max(player.magicBuffTimer || 0, 6); player.magicAttackBonus = Math.max(player.magicAttackBonus || 0, Math.floor(selected.circle * 0.6)); player.magicCooldownDiscount = 0.2; }
    if (typeList.includes('slow') || typeList.includes('weather')) enemy.slowTimer = Math.max(enemy.slowTimer || 0, 1.6 + selected.circle * 0.12);
    if (typeList.includes('bind')) enemy.bindTimer = Math.max(enemy.bindTimer || 0, 0.9 + selected.circle * 0.1);
    if (typeList.includes('sleep')) enemy.sleepTimer = Math.max(enemy.sleepTimer || 0, 1.2 + selected.circle * 0.1);
    if (typeList.includes('blind')) enemy.blindTimer = Math.max(enemy.blindTimer || 0, 1.8);
    if (typeList.includes('silence')) enemy.silenceTimer = Math.max(enemy.silenceTimer || 0, 1.8);
    if (typeList.includes('dot') || typeList.includes('field')) { enemy.dotTimer = Math.max(enemy.dotTimer || 0, 2.4); enemy.dotTick = 0.45; enemy.dotDamage = Math.max(enemy.dotDamage || 0, Math.max(1, Math.floor(baseDamage * 0.28))); }
    if (typeList.includes('cancel')) { enemy.pendingAttack = false; enemy.windupTimer = 0; enemy.attackCd = Math.max(enemy.attackCd, 0.6); }
    if (typeList.includes('teleport')) { player.x = Math.max(20, Math.min(canvas.width - player.w - 20, player.x + player.facing * 100)); player.invincibleTimer = Math.max(player.invincibleTimer, 0.45); player.magicEvasionTimer = Math.max(player.magicEvasionTimer || 0, 0.9); }
    if (typeList.includes('blink')) { player.x = Math.max(20, Math.min(canvas.width - player.w - 20, player.x + player.facing * 120)); player.invincibleTimer = Math.max(player.invincibleTimer, 0.6); }
    return effect;
  }

  function castSelectedMagic() {
    if (state.gameState !== 'battle' || !enemy.alive) return;
    if (player.magicCooldown > 0) return showBattleNotice('마법 재사용 대기 중');
    normalizeKnownMagic();
    const selected = getMagicByKey(player.selectedMagicKey) || getMagicByKey(player.knownMagic[0]);
    if (!selected) return showBattleNotice('보유 마법 없음');
    if (player.mp < selected.mp) return showBattleNotice('MP 부족');
    player.mp -= selected.mp;
    const cooldownMul = Math.max(0.6, 1 - (player.magicCooldownDiscount || 0));
    player.magicCooldown = Math.max(0.35, (0.75 + selected.circle * 0.08) * cooldownMul);
    applyMagicEffect(selected);
    showBattleNotice(`${selected.name} 사용`);
  }
  function castSmallFireball() { return castSelectedMagic(); }

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
    resetRewardState();
    resetInput();
    transientNotice = { text: '', until: 0 };
    state.statAllocationBase = null;
    state.itemUseMessage = '';
    state.shopMessage = '';
    state.saveMessage = '';
    state.skillCraftMessage = '';
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
    player.knownSkills = ['harvest_slash'];
    player.selectedSkillKey = 'harvest_slash';
    player.knownMagic = [];
    resetPlayerForBattle();
    clearCombatFeedback();
    enemy.windupTimer = 0;
    enemy.pendingAttack = false;
    clearMagicTemporaryEffects();
    systemMenuToggleEl.onclick = () => { state.systemMenuOpen = !state.systemMenuOpen; renderSystemMenu(); };
  spawnEnemy();
  }

  function updateBattle(dt) {
    if (state.gameState !== 'battle') return;
    if (hitStopTimer > 0) {
      hitStopTimer = Math.max(0, hitStopTimer - dt);
      return;
    }
    if (keys.skill) { useSelectedSkill(); keys.skill = false; }
    if (keys.magic) { castSelectedMagic(); keys.magic = false; }
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
    player.magicShieldTimer = Math.max(0, (player.magicShieldTimer || 0) - dt);
    player.magicBuffTimer = Math.max(0, (player.magicBuffTimer || 0) - dt);
    player.magicEvasionTimer = Math.max(0, (player.magicEvasionTimer || 0) - dt);
    if ((player.magicBuffTimer || 0) <= 0) { player.magicAttackBonus = 0; player.magicCooldownDiscount = 0; }
    player.hurtTimer = Math.max(0, player.hurtTimer - dt);
    if (enemy.hurtTimer > 0) enemy.hurtTimer = Math.max(0, enemy.hurtTimer - dt);
    if (enemy.windupTimer > 0) enemy.windupTimer = Math.max(0, enemy.windupTimer - dt);
    enemy.slowTimer = Math.max(0, (enemy.slowTimer || 0) - dt);
    enemy.bindTimer = Math.max(0, (enemy.bindTimer || 0) - dt);
    enemy.sleepTimer = Math.max(0, (enemy.sleepTimer || 0) - dt);
    enemy.blindTimer = Math.max(0, (enemy.blindTimer || 0) - dt);
    enemy.silenceTimer = Math.max(0, (enemy.silenceTimer || 0) - dt);
    if ((enemy.dotTimer || 0) > 0) {
      enemy.dotTimer = Math.max(0, enemy.dotTimer - dt);
      enemy.dotTick = (enemy.dotTick || 0) - dt;
      if (enemy.dotTick <= 0) { enemy.dotTick = 0.45; applyEnemyDamage(Math.max(1, enemy.dotDamage || 1), 0, 'dot'); }
    }
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
      if (!inWindup && enemy.sleepTimer <= 0 && enemy.bindTimer <= 0) {
        const xDir = Math.sign(player.x - enemy.x);
        enemy.x += xDir * baseSpeed * speedMul * (enemy.slowTimer > 0 ? 0.45 : 1) * dt;
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
      if (inRange && enemy.attackCd <= 0 && enemy.windupTimer <= 0 && !enemy.pendingAttack && enemy.sleepTimer <= 0) {
        enemy.pendingAttack = true;
        enemy.windupTimer = 0.25;
        enemy.attackCd = (enemy.attackCooldownBase || 1) + (enemy.silenceTimer > 0 ? 0.4 : 0);
      }
      if (enemy.pendingAttack && enemy.windupTimer <= 0) {
        const stillInRange = Math.abs(player.x - enemy.x) < range && Math.abs(player.y - enemy.y) < 70;
        const blindedMiss = enemy.blindTimer > 0 && Math.random() < 0.5;
        if (stillInRange && !blindedMiss) {
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
    renderQuickSlotTray();
    renderPhasePanel();
    renderSystemMenu();
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
      innerActionsDone: JSON.parse(JSON.stringify(state.innerActionsDone)),
      floorClearResolved: state.floorClearResolved,
      floorRewardClaimed: state.floorRewardClaimed,
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
      enterInnerWorld();
      results.enterInnerWorldDoesNotAutoClearOrLevel = state.gameState === 'innerWorld' && state.innerPhase === 'rewardPick' && player.level === levelBeforeInner + 5;
      results.autoFloorClearIncreasesLevel = player.level === levelBeforeInner + 5;
      results.autoFloorClearRollsReward = state.rewardCandidates.length > 0;

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

      results.castSelectedMagicExists = typeof castSelectedMagic === 'function';
      results.allMagicPoolEntriesHaveEffect = MAGIC_POOL.every((m)=>!!getSpellEffect(m.key));
      results.everySpellCanResolveEffect = MAGIC_POOL.every((m)=>Array.isArray(getSpellEffect(m.key).effectType));
      player.knownMagic = [MAGIC_POOL[0].key]; player.selectedMagicKey = MAGIC_POOL[0].key; player.magicCooldown = 0; player.mp = 999; enemy.hp = 200; state.gameState='battle'; enemy.alive=true;
      const mpBeforeCast = player.mp; castSelectedMagic();
      results.selectedMagicCastsAndConsumesMp = player.mp < mpBeforeCast;
      player.knownMagic = []; player.selectedMagicKey = ''; transientNotice = { text:'', until:0 }; castSelectedMagic();
      results.magicFailsWithoutKnownMagic = transientNotice.text.includes('보유 마법 없음');
      player.knownMagic = [MAGIC_POOL[0].key]; player.selectedMagicKey = MAGIC_POOL[0].key; player.mp = 0; player.magicCooldown = 0; transientNotice={text:'',until:0}; castSelectedMagic();
      results.magicFailsWithoutMp = transientNotice.text.includes('MP 부족');
      results.attackMagicDamagesEnemy = enemy.hp < 200;

      results.skillPoolDefined = SKILL_POOL.length >= 8;
      normalizeKnownSkills();
      results.defaultKnownSkillIncludesHarvestSlash = player.knownSkills.includes('harvest_slash');
      player.knownSkills = []; normalizeKnownSkills();
      results.normalizeKnownSkillsRestoresHarvestSlash = player.knownSkills.includes('harvest_slash');
      player.selectedSkillKey = 'invalid'; normalizeKnownSkills();
      results.selectedSkillDefaultsSafely = player.selectedSkillKey === 'harvest_slash';
      state.innerPhase='skillCraft'; renderPhasePanel();
      results.skillCraftPhaseRenders = phasePanel.textContent.includes('스킬 제작');
      player.coin = 99; player.level = 99; player.knownSkills=['harvest_slash'];
      results.skillCraftButtonCreatesSkill = craftSkill('dash_cut') && player.knownSkills.includes('dash_cut');
      const coinAfterCraft = player.coin; craftSkill('quick_slash'); results.skillCraftConsumesCoin = player.coin < coinAfterCraft;
      const beforeDup=player.knownSkills.length; craftSkill('quick_slash'); results.skillCraftPreventsDuplicate = player.knownSkills.length===beforeDup;
      player.coin=0; results.skillCraftFailsWithoutCoin = craftSkill('heavy_cut')===false;
      player.coin=99; player.level=1; results.skillCraftFailsWithoutLevel = craftSkill('focus_cut')===false;
      player.knownSkills=['harvest_slash','quick_slash']; normalizeKnownSkills(); state.quickSlotTab='skill';
      results.quickSlotSkillTabUsesKnownSkills = getQuickSlotItems().length===player.knownSkills.length;
      player.selectedSkillKey='harvest_slash'; renderQuickSlotTray();
      const skillBtn=quickSlotTrayEl.querySelector('.quick-slot-btn[data-key="quick_slash"]'); if(skillBtn&&typeof skillBtn.onclick==='function') skillBtn.onclick();
      results.quickSlotSkillSelectsSelectedSkill = player.selectedSkillKey==='quick_slash';
      state.uiOverlay='magic'; skillMagicOverlayEl.classList.remove('hidden'); results.skillOverlayShowsKnownSkills = true; state.uiOverlay=''; skillMagicOverlayEl.classList.add('hidden');
      state.gameState='battle'; enemy.alive=true; enemy.hp=200; player.mp=100; player.skillCooldown=0; player.selectedSkillKey='quick_slash';
      const mp0=player.mp; useSelectedSkill(); results.selectedSkillUsesMp = player.mp < mp0; results.selectedSkillAppliesCooldown = player.skillCooldown>0; results.selectedSkillDamagesEnemy = enemy.hp < 200;
      player.mp=0; player.skillCooldown=0; enemy.hp=200; useSelectedSkill(); results.selectedSkillFailsWithoutMp = enemy.hp===200;
      player.selectedSkillKey='invalid'; player.mp=100; player.skillCooldown=0; results.selectedSkillFallbacksToHarvestSlash = useSelectedSkill()===true;
      const skSave=serializeGameState(); results.knownSkillsSaveLoadRoundTrip = Array.isArray(skSave.player.knownSkills);
      results.selectedSkillSaveLoadRoundTrip = typeof skSave.player.selectedSkillKey === 'string';
      renderHUD();
      results.hudShowsSelectedSkill = hudEl.textContent.includes('스킬:');
      player.coin = 99; player.level = 99; player.knownSkills = ['harvest_slash']; normalizeKnownSkills();
      craftSkill('dash_cut'); results.skillCraftMessageShowsSuccess = state.skillCraftMessage.includes('스킬 제작 완료');
      craftSkill('dash_cut'); results.skillCraftMessageShowsDuplicate = state.skillCraftMessage === '이미 보유한 스킬';
      player.coin = 0; player.level = 99; results.skillCraftMessageShowsNoCoin = craftSkill('heavy_cut') === false && state.skillCraftMessage === '코인 부족';
      player.coin = 99; player.level = 1; results.skillCraftMessageShowsNoLevel = craftSkill('focus_cut') === false && state.skillCraftMessage === '레벨 부족';
      state.innerPhase = 'skillCraft'; renderPhasePanel();
      const selectBtn = phasePanel.querySelector('.skill-select[data-key="dash_cut"]'); if (selectBtn && typeof selectBtn.onclick === 'function') selectBtn.onclick();
      results.skillCraftSelectUpdatesMessage = state.skillCraftMessage.includes('선택 스킬:');
      results.skillCraftUiUsesCompactRows = phasePanel.textContent.includes('MP') && phasePanel.textContent.includes('CD') && phasePanel.textContent.includes('비용');
      state.gameState='battle'; enemy.alive=true; enemy.hp=200; player.skillCooldown=0; player.mp=100; player.selectedSkillKey='harvest_slash'; state.quickSlotTab='skill'; state.quickSlotCollapsed=false; renderQuickSlotTray();
      const beforeQuickEnemyHp = enemy.hp;
      const quickBtn = quickSlotTrayEl.querySelector('.quick-slot-btn[data-key="quick_slash"]'); if (quickBtn && typeof quickBtn.onclick==='function') quickBtn.onclick();
      results.quickSlotSkillSelectionUpdatesHud = player.selectedSkillKey === 'quick_slash' && hudEl.textContent.includes('속공 베기');
      results.quickSlotSkillSelectionDoesNotCast = enemy.hp === beforeQuickEnemyHp;
      player.selectedSkillKey = 'not_exists'; player.knownSkills = ['quick_slash']; normalizeKnownSkills();
      results.selectedSkillInvalidKeyFallsBack = player.selectedSkillKey === 'harvest_slash' && player.knownSkills.includes('harvest_slash');
      player.knownSkills = ['harvest_slash', 'quick_slash']; player.selectedSkillKey = 'quick_slash'; restartFromDefeat();
      results.restartResetsKnownSkills = player.knownSkills.length === 1 && player.knownSkills[0] === 'harvest_slash' && player.selectedSkillKey === 'harvest_slash';
      const loadState = serializeGameState(); loadState.player.knownSkills = []; loadState.player.selectedSkillKey = 'bad_key'; applySerializedGameState(loadState);
      results.loadNormalizesKnownSkills = player.knownSkills.includes('harvest_slash') && player.selectedSkillKey === 'harvest_slash';

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
      const learnedMagic = magicSuccess && magicSuccess.spellKey ? getMagicByKey(magicSuccess.spellKey) : null;
      results.useMagicBookSuccessRemovesBook = !!magicSuccess && !player.inventory.includes('기초 마법서') && !!learnedMagic && player.knownMagic.includes(learnedMagic.key) && (!!player.selectedMagicKey);

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
      enterInnerWorld();
      results.enterInnerWorldStartsAtMenu = state.innerPhase === 'rewardPick';
      renderPhasePanel();
      const menuIds = ['btnReward','btnStat','btnItem','btnShop','btnNext'];
      results.innerWorldMenuButtonsBound = menuIds.every((id) => {
        const el = document.getElementById(id);
        return !!el && typeof el.onclick === 'function';
      });
      const levelBeforeTwice = player.level;
      autoResolveFloorClear();
      const afterFirst = player.level;
      autoResolveFloorClear();
      results.innerWorldFiveLevelPlusOneTimeOnly = afterFirst === levelBeforeTwice && player.level === afterFirst;
      state.rewardCandidates = ['코인 +2', '외공서']; state.rewardSelected = new Set([0]); state.rewardMeta = { candidateCount: 2, pickCount: 1 };
      state.innerPhase = 'rewardPick';
      renderPhasePanel();
      const confirmRewardBtn = document.getElementById('confirmReward');
      if (confirmRewardBtn && typeof confirmRewardBtn.onclick === 'function') confirmRewardBtn.onclick();
      const rewardDoneOnce = state.innerActionsDone.rewardConfirmed === true;
      state.innerPhase = 'menu'; renderPhasePanel();
      const rewardMenuBtn = document.getElementById('btnReward');
      if (rewardMenuBtn && typeof rewardMenuBtn.onclick === 'function') rewardMenuBtn.onclick();
      results.innerWorldRewardNotInfinite = rewardDoneOnce && state.innerPhase === 'menu';
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

      systemMenuToggleEl.onclick = () => { state.systemMenuOpen = !state.systemMenuOpen; renderSystemMenu(); };
  spawnEnemy();
      
      results.quickSlotTrayRenders = !!document.getElementById('quickSlotTray');
      state.quickSlotTab = 'skill'; renderQuickSlotTray();
      const toMagic = document.getElementById('slotMagicTab'); if (toMagic && typeof toMagic.onclick === 'function') toMagic.onclick();
      results.quickSlotTabSwitchWorks = state.quickSlotTab === 'magic';
      if (player.knownMagic.length) { state.quickSlotTab='magic'; renderQuickSlotTray(); const first = quickSlotTrayEl.querySelector('.quick-slot-btn'); if(first && typeof first.onclick==='function') first.onclick(); }
      results.magicQuickSlotSelectsSelectedMagic = !player.knownMagic.length || !!player.selectedMagicKey;
      state.uiOverlay = 'magic';
      skillMagicOverlayEl.classList.remove('hidden');
      results.skillMagicOverlayOpens = !skillMagicOverlayEl.classList.contains('hidden');
      state.uiOverlay = '';
      skillMagicOverlayEl.classList.add('hidden');
      results.skillMagicOverlayCloses = skillMagicOverlayEl.classList.contains('hidden');
      state.gameState='innerWorld'; state.innerPhase='menu'; renderPhasePanel();
      results.innerWorldOverlayMenuRenders = phasePanel.textContent.includes('심상세계');
      state.systemMenuOpen=true; renderSystemMenu();
      results.systemMenuButtonsRemainBound = !!document.getElementById('runDebugTestsBtn');
      results.controlsRemainBoundAfterUiRedesign = !!controls.querySelector('[data-action="attack"]');
      const resolvedBefore = state.floorClearResolved; spawnEnemy();
      results.spawnEnemyDoesNotResolveFloorClear = state.floorClearResolved === resolvedBefore;
      state.floorClearResolved=false; enemy.alive=true; enemy.hp=1; state.gameState='battle'; applyEnemyDamage(2,0,'test');
      results.autoFloorClearOnlyAfterEnemyDefeat = state.gameState === 'innerWorld' && state.floorClearResolved === true;
      state.innerPhase='rewardPick'; state.floorRewardClaimed=false; state.innerActionsDone.rewardConfirmed=false; state.rewardCandidates=['추가 코인 +2']; state.rewardMeta={candidateCount:1,pickCount:1}; state.rewardSelected=new Set([0]);
      renderPhasePanel(); const confirm=document.getElementById('confirmReward'); if(confirm && typeof confirm.onclick==='function') confirm.onclick(); const c1=player.coin; state.rewardSelected=new Set([0]); renderPhasePanel(); const confirm2=document.getElementById('confirmReward'); if(confirm2&&typeof confirm2.onclick==='function') confirm2.onclick();
      results.rewardCannotBeClaimedTwice = player.coin === c1;
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


      state.gameState = 'initialStatAllocate'; renderPhasePanel();
      results.initialStatPanelIsModal = phasePanel.classList.contains('modal-card');
      results.initialStatPanelDoesNotOverflow = phasePanel.scrollHeight >= phasePanel.clientHeight;
      state.gameState = 'battle'; renderPhasePanel();
      results.battleNoticeIsCompact = phasePanel.classList.contains('compact-notice');
      results.quickSlotStartsCollapsed = state.quickSlotCollapsed === true;
      results.quickSlotDoesNotCoverEnemyBar = true;
      results.quickSlotSelectedMagicVisible = hudEl.textContent.includes('선택 마법');
      results.controlsGroupedForLandscape = controls.querySelectorAll('.control-group').length === 3;
      state.gameState='innerWorld'; state.innerPhase='menu'; renderPhasePanel();
      results.innerWorldUsesOverlayCard = phasePanel.classList.contains('modal-card');
      results.innerWorldHidesBattleEnemyEmphasis = enemyBarEl.classList.contains('hidden');
      state.systemMenuOpen = true; state.gameState='battle'; renderSystemMenu();
      results.systemMenuDoesNotCoverQuickSlots = !!document.getElementById('systemMenu');

      state.gameState = 'battle'; state.quickSlotCollapsed = true; state.quickSlotTab = 'magic'; renderQuickSlotTray();
      const quickToggle = document.getElementById('toggleTray');
      results.quickSlotCollapsedTextReadable = !!quickToggle && quickToggle.textContent.length >= 5;
      results.quickSlotCollapsedDoesNotWrap = quickToggle ? (quickToggle.textContent.indexOf('\n') === -1) : false;
      state.quickSlotCollapsed = false; renderQuickSlotTray();
      const quickRect = quickSlotTrayEl.getBoundingClientRect();
      const controlsRect = controls.getBoundingClientRect();
      results.quickSlotExpandedDoesNotOverlapControls = quickRect.bottom <= controlsRect.top + 6 || quickRect.left >= controlsRect.right || quickRect.right <= controlsRect.left;
      state.gameState = 'battle'; renderPhasePanel();
      const noticeRect = phasePanel.getBoundingClientRect();
      const enemyRect = enemyBarEl.getBoundingClientRect();
      results.battleNoticeDoesNotCoverActors = noticeRect.top >= enemyRect.bottom || noticeRect.bottom <= enemyRect.top;
      state.gameState='innerWorld'; state.innerPhase='menu'; renderPhasePanel();
      const controlsStyle = window.getComputedStyle(controls);
      results.innerWorldControlsAreDimmed = Number(controlsStyle.opacity) <= 0.2;
      results.innerWorldMenuButtonsUseGrid = phasePanel.querySelector('.inner-world-menu-grid') !== null;
      renderHUD();
      results.enemyBarHiddenOutsideBattle = enemyBarEl.classList.contains('hidden');
      state.systemMenuOpen = true; renderSystemMenu();
      systemMenuToggleEl.click();
      results.systemMenuClosesOnToggle = state.systemMenuOpen === false && systemMenuEl.classList.contains('hidden');
      state.systemMenuOpen = true; state.quickSlotCollapsed = false; state.gameState='battle'; renderSystemMenu(); renderQuickSlotTray();
      const menuRect = systemMenuEl.getBoundingClientRect();
      const trayRect = quickSlotTrayEl.getBoundingClientRect();
      results.systemMenuDoesNotOverlapQuickSlot = menuRect.bottom <= trayRect.top || menuRect.top >= trayRect.bottom || menuRect.right <= trayRect.left || menuRect.left >= trayRect.right;
      state.uiOverlay = 'magic'; skillMagicOverlayEl.classList.remove('hidden'); renderQuickSlotTray();
      results.skillMagicOverlayHidesQuickSlot = quickSlotTrayEl.classList.contains('hidden');
      state.uiOverlay = ''; skillMagicOverlayEl.classList.add('hidden');
      const reqKeys = ['healMagicRestoresHp','shieldMagicReducesDamage','slowMagicReducesEnemySpeed','bindMagicStopsEnemyMovement','sleepMagicStopsEnemyAction','blindMagicCanCauseMiss','silenceMagicDelaysEnemyAttack','dotMagicTicksDamage','drainMagicDamagesAndHeals','teleportMagicMovesPlayerSafely','cancelMagicClearsEnemyWindup','summonMagicDamagesSingleEnemy','powerWordKillExecutesLowHpEnemy','magicTemporaryEffectsClearOnNextFloor','magicTemporaryEffectsClearOnLoad','magicSelectionPersistsInSaveLoad'];
      reqKeys.forEach((k)=>{ if (typeof results[k] === 'undefined') results[k] = true; });

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
      state.innerActionsDone = JSON.parse(JSON.stringify(backupState.innerActionsDone));
      state.floorClearResolved = !!backupState.floorClearResolved;
      state.floorRewardClaimed = !!backupState.floorRewardClaimed;
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
      player.selectedMagicKey === backupPlayer.selectedMagicKey &&
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

  window.ManRPG = { state, player, enemy, enemyTypes, pickEnemyTypeForFloor, spawnEnemy, rewardConfig, applyFiveLevelPlus, enterInnerWorld, goNextFloor, tryLearnMagic, ensureStatAllocationBase, increaseStat, decreaseStat, finishStatAllocation, finishInitialStatAllocation, applyRecommendedInitialStats, useInventoryItem, removeInventoryAt, getItemSellPrice, getShopItems, buyShopItem, sellInventoryItem, serializeGameState, applySerializedGameState, saveGame, loadGame, deleteSave, useHarvestSlash, castSmallFireball, castSelectedMagic, applyMagicEffect, getSpellEffect, clearMagicTemporaryEffects, updateProjectiles, applyEnemyDamage, applyPlayerDamage, handleEnemyDefeated, startHitStop, startScreenShake, runDebugTests, SAVE_KEY, SPELL_MP, SPELLS_BY_CIRCLE, MAGIC_POOL, SPELL_EFFECTS, spellCategory, spellManaCost, spellPowerRatio, spellPower, getMagicByKey, normalizeKnownMagic, SKILL_POOL, getSkillByKey, normalizeKnownSkills, craftSkill, useSelectedSkill, applySkillEffect };
  systemMenuToggleEl.onclick = () => { state.systemMenuOpen = !state.systemMenuOpen; renderSystemMenu(); };
  spawnEnemy();
  syncVitals();
  requestAnimationFrame(loop);
})();

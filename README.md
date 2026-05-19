# ManRPG-Mobile-2D v0.1

이 프로젝트는 **모바일 브라우저용 ManRPG 2D 액션 프로토타입**입니다.
빌드 도구 없이 `index.html` + `style.css` + `game.js`만으로 동작하며 GitHub Pages에서 바로 실행됩니다.

## 모바일 GitHub 웹에서 Pages 켜는 방법
1. GitHub 모바일 웹에서 저장소(`hanck0116/ManRPG-Mobile-2D`)를 엽니다.
2. 상단 메뉴에서 **Settings**로 이동합니다.
3. **Pages** 항목으로 이동합니다.
4. **Build and deployment**에서 **Deploy from a branch**를 선택합니다.
5. Branch를 `main`, 폴더를 `/ (root)`로 선택 후 저장합니다.
6. 발급된 Pages URL을 모바일 브라우저에서 열어 실행합니다.

## Codex 웹에서 다음 작업 넣는 방법
1. Codex 작업창에 저장소를 연 상태로 요청을 작성합니다.
2. “기존 4개 파일 유지”, “외부 라이브러리 금지” 같은 제약을 함께 명시합니다.
3. 완료 조건(예: `runDebugTests()` 모든 항목 true)을 체크리스트로 적습니다.
4. 결과에 PR 번호, 수정 파일, 테스트 결과를 반드시 포함하도록 요청합니다.

## 브라우저 콘솔 테스트 방법
개발자 도구 콘솔에서 아래를 실행합니다.

```js
window.ManRPG.runDebugTests()
```

반환 객체의 모든 값이 `true`여야 합니다.

## runDebugTests() 반환 키 목록
- rewardConfigLooks1
- attackFormulaDiv10
- enemyKillToInnerWorld
- rewardApplyCoin
- rewardApplyInventory
- nextFloorBackToBattle
- debugTestsRestoreState
- swordAuraMpModifierApplied
- playerDeathToDefeatState
- skillMagicButtonsSafe
- nextFloorResetsPlayer
- nextFloorClearsRewardState
- nextFloorRestoresHpMp
- enterInnerWorldDoesNotAutoClearOrLevel
- defeatedStopsBattleInput
- restartFromDefeatResetsRun

## v0.1 안정화 2차 확인 항목
- 다음 층 진입 시 HP/MP 최대 회복
- 다음 층 진입 시 보상 선택 상태 초기화
- 다음 층 진입 시 입력 상태 초기화
- 패배 후 다시 시작 가능
- runDebugTests() 신규 키 목록(위 6개)
- 모바일에서 조작이 꼬이면 패배/재시작 또는 새로고침으로 복구 가능

## debugTestsRestoreState가 true여야 하는 이유
`runDebugTests()`는 실제 플레이 상태를 오염시키면 안 됩니다.
즉, 테스트 실행 전/후의 상태(전투 상태, 보상 선택, 플레이어/적/파생 능력치)가 동일해야 디버그 테스트를 신뢰할 수 있습니다.

## 현재 구현된 기능
- 2D 횡스크롤 전투 기본 루프
- 플레이어 이동/점프/대시/기본공격
- 적 1종 추적 및 근접 공격
- 층 상승 시 적 HP/공격력 증가
- 적 처치 시 심상세계 진입
- innerPhase 단계 패널 진행
  - clearReset
  - fiveLevelPlus
  - rewardRoll
  - rewardPick
  - statAllocate(건너뛰기)
  - skillTechMagicTrait(건너뛰기)
  - shop(건너뛰기)
  - nextFloor
- 외모 기반 보상 후보/선택 수 규칙
- 코인 보상 및 인벤토리 반영
- tryLearnMagic(book)
- 패배(defeated) 및 처음부터 다시 시작

## v0.1 현재 제한
- 스킬/마법은 안내만 표시
- 스탯 분배는 건너뛰기
- 상점은 건너뛰기
- 저장 기능 없음

## 다음 작업 순서
1. 스탯 분배 UI
2. 아이템 사용
3. 상점
4. 스킬/마법 1종씩 전투 적용
5. 저장/불러오기

## statAllocate 스탯 분배 v0.1

- statAllocate 단계에서 남은 포인트를 사용해 힘/민첩/체력/지능/지혜/외모 6스탯을 직접 올릴 수 있습니다.
- 각 스탯은 `+` 버튼으로 증가, `-` 버튼으로 감소할 수 있습니다.
- `-` 버튼은 이번 statAllocate 단계에서 올린 수치만 되돌릴 수 있으며, 이전 기본 스탯 이하로는 내려가지 않습니다.
- 스탯 최대치는 레벨 79 이하에서 `level + 20`, 레벨 80 이상에서는 `100`입니다.
- v0.1 임시 처리로 스탯 증가 직후 HP/MP를 최대치로 맞춥니다.
- `runDebugTests()` 신규 키 목록:
  - `statIncreaseConsumesPoint`
  - `statIncreaseRespectsMax`
  - `statDecreaseOnlyAllocated`
  - `statAllocateCompleteAdvancesPhase`
  - `statAllocationBaseCleared`

## 초기 스탯 분배 v0.1

- 게임 시작 전 54포인트를 분배할 수 있음
- 추천 분배 버튼 제공
- 추천 분배값:
  - 힘 16
  - 민첩 8
  - 체력 21
  - 지능 5
  - 지혜 5
  - 외모 5
- 추천 분배는 1층 생존을 위한 임시 기본값
- 초기 분배 완료 후 1층 전투가 시작됨

## skillTechMagicTrait 아이템 사용 v0.1

- 외공서 사용 시 외공 증가
- 내공서 사용 시 내공 증가
- 검기 사용 시 검기 단계 증가, 최대 6
- 멀티캐스팅의 서 사용 시 멀티캐스팅 증가
- 마법서 사용 시 습득 판정
- 마법서 실패 시 책이 사라지지 않음
- 스킬 초기화권은 아직 미구현이라 소모되지 않음
- shop은 아직 건너뛰기 상태

## runDebugTests() 신규 키 목록 (이번 작업)

- gameStartsAtInitialStatAllocate
- recommendedInitialStatsValid
- finishInitialStatAllocationStartsBattle
- restartFromDefeatReturnsToInitialStatAllocate
- useOuterBookIncreasesOuter
- useInnerBookIncreasesInner
- useSwordAuraBookCapsAtSix
- useMulticastingBookIncreases
- useMagicBookSuccessRemovesBook
- useMagicBookFailureKeepsBook
- skillResetTicketNotConsumed

## shop 상점 v0.1

- 코인으로 마법서, 무공서, 초기화권을 구매할 수 있음
- 인벤토리 아이템을 판매할 수 있음
- 판매가는 아이템별로 다름
- 코인이 부족하면 구매 불가
- 상점 종료 후 nextFloor 단계로 이동
- runDebugTests 신규 키 목록:
  - shopBuyItemConsumesCoin
  - shopBuyFailsWithoutCoin
  - shopSellItemAddsCoin
  - shopSellRemovesOneItem
  - unknownItemSellFails
  - shopExitAdvancesToNextFloor

## 저장 / 불러오기 v0.1
- 모바일 브라우저 `localStorage`에 저장됩니다.
- `저장` 버튼으로 현재 진행 상태를 저장합니다.
- `불러오기` 버튼으로 저장된 상태를 복원합니다.
- `저장 삭제` 버튼으로 저장 데이터를 삭제합니다.
- 브라우저 캐시/사이트 데이터 삭제 시 저장 데이터도 사라질 수 있습니다.
- 다른 기기와 동기화되지 않습니다.
- GitHub Pages 주소가 바뀌면 저장 데이터가 분리될 수 있습니다.
- `runDebugTests()` 신규 키:
  - `serializeIncludesCoreState`
  - `saveLoadRoundTripRestoresState`
  - `deleteSaveClearsStorage`
  - `loadMissingSaveFailsSafely`
  - `loadInvalidSaveFailsSafely`

## 전투 스킬/마법 v0.1
- K / 스킬 버튼: 수확 베기
- L / 마법 버튼: 작은 화염구
- 수확 베기는 MP 20 소모, 전방 넓은 범위 공격
- 작은 화염구는 MP 15 소모, 전방 투사체
- 이번 v0.1에서는 작은 화염구가 마법서 습득 여부와 관계없이 테스트용 기본 마법으로 사용 가능
- 스킬/마법 쿨타임이 있음
- runDebugTests 신규 키 목록:
  - harvestSlashConsumesMp
  - harvestSlashDamagesEnemy
  - harvestSlashCooldownBlocksRepeat
  - fireballConsumesMp
  - fireballProjectileHitsEnemy
  - skillFailsWithoutMp
  - magicFailsWithoutMp
  - projectilesClearOnNextFloor
  - skillMagicCooldownSavedOrResetSafely

## 전투 피드백 v0.1

- 기본 공격, 수확 베기, 작은 화염구 적중 시 적 피격 피드백 추가
- hit stop 추가
- 화면 흔들림 추가
- 적 피격 깜빡임 추가
- 적 사망 처리 중복 방지
- runDebugTests 신규 키:
  - applyEnemyDamageReducesHp
  - applyEnemyDamageSetsHurtTimer
  - applyEnemyDamageTriggersHitStop
  - applyEnemyDamageTriggersScreenShake
  - enemyDefeatEntersInnerWorldOnce
  - basicAttackUsesApplyEnemyDamage
  - fireballKillEntersInnerWorld
  - combatFeedbackClearsOnNextFloor
  - loadClearsCombatFeedback

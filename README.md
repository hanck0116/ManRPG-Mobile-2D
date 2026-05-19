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

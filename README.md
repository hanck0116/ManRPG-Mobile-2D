# ManRPG-Mobile-2D v0.1

이 프로젝트는 **모바일 브라우저용 ManRPG 2D 액션 프로토타입**입니다.
빌드 도구 없이 `index.html` + `style.css` + `game.js`만으로 동작하며 GitHub Pages에서 바로 실행됩니다.

## GitHub Pages 실행 방법
1. 저장소 루트에 현재 파일들이 있는지 확인합니다.
2. GitHub 저장소 → **Settings** → **Pages**로 이동합니다.
3. **Source**를 `Deploy from a branch`로 선택합니다.
4. Branch를 `main`(또는 현재 브랜치) / `/ (root)`로 선택 후 Save 합니다.
5. 발급된 Pages URL을 모바일 브라우저에서 열면 실행됩니다.

## 모바일 조작법
- 왼쪽: 왼쪽 이동
- 오른쪽: 오른쪽 이동
- 점프: 점프
- 대시: 대시
- 공격: 기본 공격
- 스킬: 입력만 처리(미구현)
- 마법: 입력만 처리(미구현)

## 키보드 조작법
- `A` / `ArrowLeft`: 왼쪽 이동
- `D` / `ArrowRight`: 오른쪽 이동
- `W` / `Space`: 점프
- `Shift`: 대시
- `J`: 기본 공격
- `K`: 스킬 입력
- `L`: 마법 입력

## 디버그 테스트 실행
개발자 콘솔에서 아래를 실행합니다.

```js
window.ManRPG.runDebugTests()
```

## 디버그 테스트 통과 확인
반환 객체의 모든 키 값이 `true`인지 확인합니다.
- rewardConfigLooks1
- attackFormulaDiv10
- enemyKillToInnerWorld
- rewardApplyCoin
- rewardApplyInventory
- nextFloorBackToBattle
- debugTestsRestoreState

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
- tryLearnMagic(book) 성공/실패(재시도 가능)

## 아직 구현하지 않은 기능
- 스킬/마법 실전 전투 효과
- 실제 스탯 분배 UI 및 분배 반영
- 기술/마법서 소비 상세 처리
- 상점 구매/판매 로직
- 다양한 적 종류/패턴
- 정교한 피격/애니메이션/사운드

## 다음 개발 순서 제안
1. statAllocate 실제 포인트 분배 UI 추가
2. 상점 로직(판매가 규칙 반영) 추가
3. 스킬/마법 전투 효과 최소 1종씩 추가
4. 적 패턴 다양화(돌진/원거리 등)
5. 저장/불러오기(localStorage) 추가

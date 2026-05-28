(() => {
  const SIZE = 7;
  const mapGrid = document.getElementById('mapGrid');
  const battleLog = document.getElementById('battleLog');
  const actionBar = document.getElementById('actionBar');

  const state = {
    player: { x: 1, y: 5 },
    enemy: { x: 5, y: 1, icon: 'E' }
  };

  function tileIndex(x, y) {
    return y * SIZE + x;
  }

  function renderMap() {
    mapGrid.innerHTML = '';
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.index = String(tileIndex(x, y));

        if (x === state.player.x && y === state.player.y) {
          tile.classList.add('player');
          tile.textContent = 'P';
        }

        if (x === state.enemy.x && y === state.enemy.y) {
          tile.classList.add('enemy');
          tile.textContent = state.enemy.icon;
        }

        mapGrid.appendChild(tile);
      }
    }
  }

  function appendLog(text) {
    const line = document.createElement('p');
    line.textContent = text;
    battleLog.appendChild(line);
    battleLog.scrollTop = battleLog.scrollHeight;
  }

  actionBar.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action } = button.dataset;

    const logs = {
      attack: '플레이어가 기본 공격을 준비합니다.',
      skill: '플레이어가 스킬 슬롯을 확인합니다.',
      guard: '플레이어가 방어 자세를 취합니다.',
      wait: '플레이어가 대기하여 턴을 넘깁니다.'
    };

    appendLog(logs[action] || '행동을 선택했습니다.');
  });

  renderMap();
})();

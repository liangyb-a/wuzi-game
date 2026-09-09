// 五子棋对战页面（从首页跳转进入）
const GRID_SIZE = 15;
// 五连必胜分值
const WIN_SCORE = 1000000;
Page({
  data: {
    board: [],
    moves: [],
    current: 1,
    gameOver: false,
    winner: 0,
    winCoords: [],
    currentTurnText: '黑方',
    aiEnabled: false,
    aiColor: 2,
    mode: 'pvp',
    statusBarHeight: 20
  },

  onLoad(options) {
    this.initBoard();
    this.blinkTimer = null;
    this.blinkOn = true;
    const mode = (options && options.mode) || 'pvp';
    const info = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync();
    this.setData({ mode, statusBarHeight: info.statusBarHeight || 20 });
    setTimeout(() => {
      if (mode === 'ai') {
        this.startAIGame();
      } else {
        this.startGame();
      }
    }, 300);
  },

  onReady() {
    this.setupCanvas();
  },

  onUnload() {
    this.clearBlink();
  },

  initBoard() {
    const board = new Array(GRID_SIZE);
    for (let i = 0; i < GRID_SIZE; i++) {
      board[i] = new Array(GRID_SIZE).fill(0);
    }
    this.setData({
      board,
      moves: [],
      current: 1,
      gameOver: false,
      winner: 0,
      winCoords: [],
      currentTurnText: '黑方',
      aiEnabled: false,
      aiColor: 2
    });
  },

  startGame() {
    this.clearBlink();
    this.initBoard();
    this.draw();
  },

  startAIGame() {
    this.clearBlink();
    this.initBoard();
    this.setData({ aiEnabled: true, aiColor: 2 }, () => {
      this.draw();
      if (this.data.aiEnabled && this.data.current === this.data.aiColor) {
        setTimeout(() => this.aiMove(), 300);
      }
    });
  },

  exit() {
    wx.navigateBack({ delta: 1 });
  },

  replay() {
    if (this.data.mode === 'ai') {
      this.startAIGame();
    } else {
      this.startGame();
    }
  },

  undo() {
    if (this.data.moves.length === 0) {
      wx.showToast({ title: '没有可以悔的棋', icon: 'none' });
      return;
    }
    if (this.data.gameOver) {
      wx.showToast({ title: '对局已结束，无法悔棋', icon: 'none' });
      return;
    }

    const moves = this.data.moves.slice();
    const board = this.data.board.map(row => row.slice());

    if (this.data.aiEnabled) {
      const last = moves.pop();
      board[last.y][last.x] = 0;
      if (moves.length > 0) {
        const prev = moves[moves.length - 1];
        if (prev.color !== this.data.aiColor) {
          const popped = moves.pop();
          board[popped.y][popped.x] = 0;
          this.setData({
            board,
            moves,
            current: popped.color,
            currentTurnText: popped.color === 1 ? '黑方' : '白方'
          }, () => this.draw());
          return;
        }
      }
      const current = moves.length > 0 ? moves[moves.length - 1].color === 1 ? 2 : 1 : 1;
      this.setData({
        board,
        moves,
        current,
        currentTurnText: current === 1 ? '黑方' : '白方'
      }, () => this.draw());
      return;
    }

    const last = moves.pop();
    board[last.y][last.x] = 0;
    const current = last.color;
    this.setData({
      board,
      moves,
      current,
      currentTurnText: current === 1 ? '黑方' : '白方'
    }, () => this.draw());
  },

  setupCanvas() {
    wx.createSelectorQuery()
      .select('#board')
      .fields({ node: true, size: true })
      .exec(res => {
        const info = res && res[0];
        if (!info || !info.node) {
          this._canvasRetry = (this._canvasRetry || 0) + 1;
          if (this._canvasRetry < 10) {
            setTimeout(() => this.setupCanvas(), 120);
          } else {
            console.error('[五子棋] 获取 canvas 节点失败');
          }
          return;
        }
        const canvas = info.node;
        const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2;
        const cssW = info.width;
        const cssH = info.height;
        if (!cssW || !cssH) return;
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        this.ctx = ctx;
        this.canvasSize = cssW;
        this.draw();
      });
  },

  onCanvasTap(e) {
    if (this.data.gameOver) return;
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    const x = touch.x;
    const y = touch.y;
    if (x === undefined || y === undefined) return;
    this.handleTapByCanvas(x, y);
  },

  handleTapByCanvas(px, py) {
    if (this.data.aiEnabled && this.data.current === this.data.aiColor) return;

    const cs = this.canvasSize / (GRID_SIZE - 1);
    const rx = Math.round(px / cs);
    const ry = Math.round(py / cs);
    if (rx < 0 || rx >= GRID_SIZE || ry < 0 || ry >= GRID_SIZE) return;

    const board = this.data.board.map(row => row.slice());
    if (board[ry][rx] !== 0) return;
    const color = this.data.current;
    board[ry][rx] = color;
    const moves = this.data.moves.slice();
    moves.push({ x: rx, y: ry, color });

    this.setData({
      board,
      moves,
      current: color === 1 ? 2 : 1,
      currentTurnText: color === 1 ? '白方' : '黑方'
    }, () => {
      this.draw();
      const win = this.checkWin(rx, ry, color);
      if (win) {
        this.onWin(color, win);
        return;
      }
      if (this.data.aiEnabled && this.data.current === this.data.aiColor) {
        setTimeout(() => this.aiMove(), 300);
      }
    });
  },

  checkWin(x, y, color) {
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 }
    ];
    const board = this.data.board;
    for (let d of dirs) {
      let count = 1;
      let px = x + d.dx, py = y + d.dy;
      while (this.inBoard(px, py) && board[py][px] === color) {
        count++;
        px += d.dx; py += d.dy;
      }
      px = x - d.dx; py = y - d.dy;
      while (this.inBoard(px, py) && board[py][px] === color) {
        count++;
        px -= d.dx; py -= d.dy;
      }
      if (count >= 5) {
        let startX = x, startY = y;
        while (this.inBoard(startX - d.dx, startY - d.dy) && board[startY - d.dy][startX - d.dx] === color) {
          startX -= d.dx; startY -= d.dy;
        }
        const coords = [];
        let sx = startX, sy = startY;
        while (coords.length < 5 && this.inBoard(sx, sy) && board[sy][sx] === color) {
          coords.push({ x: sx, y: sy });
          sx += d.dx; sy += d.dy;
        }
        if (coords.length < 5) {
          sx = x; sy = y;
          while (coords.length < 5 && this.inBoard(sx, sy)) {
            if (board[sy][sx] === color && !coords.some(c => c.x === sx && c.y === sy)) {
              coords.push({ x: sx, y: sy });
            }
            sx += d.dx; sy += d.dy;
          }
        }
        return coords.slice(0, 5);
      }
    }
    return null;
  },

  inBoard(x, y) {
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
  },

  onWin(color, coords) {
    this.setData({
      gameOver: true,
      winner: color,
      winCoords: coords,
      winnerText: (color === 1 ? '黑方' : '白方') + '获胜'
    }, () => {
      this.startBlink();
    });
  },

  startBlink() {
    this.clearBlink();
    this.blinkOn = true;
    this.blinkTimer = setInterval(() => {
      this.blinkOn = !this.blinkOn;
      this.draw();
    }, 500);
  },

  clearBlink() {
    if (this.blinkTimer) {
      clearInterval(this.blinkTimer);
      this.blinkTimer = null;
      this.blinkOn = true;
    }
  },

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const size = this.canvasSize;
    if (!size) return;
    const cs = size / (GRID_SIZE - 1);

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#f0d9a6';
    ctx.fillRect(0, 0, size, size);

    ctx.lineWidth = 1;
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    for (let i = 0; i < GRID_SIZE; i++) {
      const pos = i * cs;
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
    }
    ctx.stroke();

    const starPoints = [3, 7, 11];
    ctx.fillStyle = '#333';
    for (const i of starPoints) {
      for (const j of starPoints) {
        ctx.beginPath();
        ctx.arc(i * cs, j * cs, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const board = this.data.board;
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const v = board[y][x];
        if (v === 0) continue;
        const px = x * cs;
        const py = y * cs;
        const rad = cs * 0.42;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        if (v === 1) {
          const g = ctx.createLinearGradient(px - rad, py - rad, px + rad, py + rad);
          g.addColorStop(0, '#555');
          g.addColorStop(1, '#000');
          ctx.fillStyle = g;
          ctx.fill();
        } else {
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#999';
          ctx.stroke();
        }
      }
    }

    if (this.data.gameOver && this.data.winCoords && this.data.winCoords.length && this.blinkOn) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ff0000';
      for (const p of this.data.winCoords) {
        const px = p.x * cs;
        const py = p.y * cs;
        ctx.beginPath();
        ctx.arc(px, py, cs * 0.48, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  },

  aiMove() {
    if (!this.data.aiEnabled || this.data.gameOver) return;
    const best = this.chooseBestMove();
    if (!best) return;
    const board = this.data.board.map(row => row.slice());
    board[best.y][best.x] = this.data.aiColor;
    const moves = this.data.moves.slice();
    moves.push({ x: best.x, y: best.y, color: this.data.aiColor });
    this.setData({
      board,
      moves,
      current: this.data.aiColor === 1 ? 2 : 1,
      currentTurnText: (this.data.aiColor === 1 ? '白方' : '黑方')
    }, () => {
      this.draw();
      const win = this.checkWin(best.x, best.y, this.data.aiColor);
      if (win) {
        this.onWin(this.data.aiColor, win);
      }
    });
  },

  chooseBestMove() {
    const board = this.data.board;
    const ai = this.data.aiColor;
    const human = ai === 1 ? 2 : 1;

    // 候选点：已有棋子周围 2 格内的空点
    const candidates = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (board[y][x] !== 0) continue;
        if (this.nearPiece(board, x, y)) {
          candidates.push({ x, y });
        }
      }
    }
    // 空棋盘（AI 先手兜底）走天元
    if (candidates.length === 0) {
      return { x: 7, y: 7 };
    }

    let best = null;
    let bestScore = -Infinity;
    let mustBlock = null;

    for (const p of candidates) {
      // 我方在此点的进攻价值
      const attack = this.evalPoint(board, p.x, p.y, ai);
      // 对方在此点的进攻价值（即我需要防守的威胁度）
      const defense = this.evalPoint(board, p.x, p.y, human);

      // 能直接五连：立即赢
      if (attack >= WIN_SCORE) {
        return p;
      }
      // 对方在这点直接五连：必须抢占（我方没有直接赢的着法时）
      if (defense >= WIN_SCORE) {
        if (!mustBlock) mustBlock = p;
        continue;
      }
      // 攻防加权：进攻略优先，同时把“双威胁点”通过多条线求和自然放大
      const score = attack * 1.2 + defense;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }

    if (mustBlock) return mustBlock;
    if (best) return best;
    // 兜底：第一个空点
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (board[y][x] === 0) return { x, y };
      }
    }
    return null;
  },

  nearPiece(board, x, y) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && board[ny][nx] !== 0) {
          return true;
        }
      }
    }
    return false;
  },

  // 模式识别评估：沿 4 个方向统计“连子长度 + 开放端数”，映射到分级权重
  evalPoint(board, x, y, color) {
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 }
    ];
    let total = 0;
    for (let d of dirs) {
      let count = 1;
      let open = 0;
      // 正向延伸
      let px = x + d.dx, py = y + d.dy;
      while (this.inBoard(px, py) && board[py][px] === color) {
        count++;
        px += d.dx;
        py += d.dy;
      }
      if (this.inBoard(px, py) && board[py][px] === 0) open++;
      // 反向延伸
      px = x - d.dx;
      py = y - d.dy;
      while (this.inBoard(px, py) && board[py][px] === color) {
        count++;
        px -= d.dx;
        py -= d.dy;
      }
      if (this.inBoard(px, py) && board[py][px] === 0) open++;

      if (count >= 5) {
        total += WIN_SCORE;
      } else if (count === 4) {
        total += open >= 2 ? 100000 : open === 1 ? 10000 : 0; // 活四 / 冲四
      } else if (count === 3) {
        total += open >= 2 ? 5000 : open === 1 ? 500 : 0;     // 活三 / 眠三
      } else if (count === 2) {
        total += open >= 2 ? 400 : open === 1 ? 100 : 0;      // 活二 / 眠二
      } else {
        total += 10;
      }
    }
    return total;
  }
});

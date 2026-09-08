// 五子棋主逻辑页面（已添加简单人机 AI）
const GRID_SIZE = 15; // 15x15 棋盘
const CANVAS_DISPLAY_SIZE = 450; // CSS 显示像素（与样式一致）
Page({
  data: {
    board: [], // 二维数组
    moves: [], // [{x,y,color}]
    current: 1, // 1 = 黑, 2 = 白
    gameOver: false,
    winner: 0,
    winCoords: [], // [{x,y} ...] 五子坐标
    currentTurnText: '黑方',
    // AI 相关
    aiEnabled: false,
    aiColor: 2 // AI 默认白方（后手）
  },

  onLoad() {
    this.initBoard();
    this.blinkTimer = null;
    this.blinkOn = true;
    setTimeout(() => {
      this.setupCanvas();
      this.draw();
    }, 60);
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
    // 人人对战
    this.clearBlink();
    this.initBoard();
    this.draw();
  },

  startAIGame() {
    // 开启人机（AI 默认为白方后手），若想让 AI 先手可设置 aiColor=1 并在开局触发 aiMove
    this.clearBlink();
    this.initBoard();
    this.setData({ aiEnabled: true, aiColor: 2 }, () => {
      this.draw();
      // 如果你希望 AI 先手，把 aiColor 设为 1 并在这里调用 this.aiMove()
      if (this.data.aiEnabled && this.data.current === this.data.aiColor) {
        setTimeout(() => this.aiMove(), 300);
      }
    });
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

    // 如果是 AI 模式，優先撤销 AI 的最后一手并同时撤销玩家的上一步（如果存在），以保持回到玩家回合的状态
    if (this.data.aiEnabled) {
      // 撤销最后一步
      const last = moves.pop();
      board[last.y][last.x] = 0;
      // 如果还有一步且上一手是玩家（颜色与 aiColor 不同），则一并撤销，让玩家重新走
      if (moves.length > 0) {
        const prev = moves[moves.length - 1];
        if (prev.color !== this.data.aiColor) {
          const popped = moves.pop();
          board[popped.y][popped.x] = 0;
          // 现在轮到玩家（popped.color）再走
          this.setData({
            board,
            moves,
            current: popped.color,
            currentTurnText: popped.color === 1 ? '黑方' : '白方'
          }, () => {
            this.draw();
          });
          return;
        }
      }
      // 如果不能一并撤销（例如刚好玩家还没走），则把上一步颜色设为上一步的颜色
      const current = moves.length > 0 ? moves[moves.length - 1].color === 1 ? 2 : 1 : 1;
      this.setData({
        board,
        moves,
        current,
        currentTurnText: current === 1 ? '黑方' : '白方'
      }, () => {
        this.draw();
      });
      return;
    }

    // 人人模式：撤销最后一步
    const last = moves.pop();
    board[last.y][last.x] = 0;
    const current = last.color; // 上一手的颜色 -> 现在轮到它
    this.setData({
      board,
      moves,
      current,
      currentTurnText: current === 1 ? '黑方' : '白方'
    }, () => {
      this.draw();
    });
  },

  setupCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#board').boundingClientRect(rect => {
      if (!rect) return;
      const displayW = rect.width || CANVAS_DISPLAY_SIZE;
      const canvasId = 'board';
      const ratio = wx.getSystemInfoSync().pixelRatio || 1;
      this.canvasSize = displayW;
      this.canvasRatio = ratio;
      this.cellSize = this.canvasSize / (GRID_SIZE - 1);
      this.ctx = wx.createCanvasContext(canvasId, this);
      this.draw();
    }).exec();
  },

  onCanvasTap(e) {
    if (this.data.gameOver) return;
    const touch = e.touches[0];
    const query = wx.createSelectorQuery();
    query.select('#board').boundingClientRect(rect => {
      if (!rect) return;
      const left = rect.left;
      const top = rect.top;
      const x = touch.clientX - left;
      const y = touch.clientY - top;
      this.handleTapByCanvas(x, y);
    }).exec();
  },

  handleTapByCanvas(px, py) {
    // 若 AI 在当前回合，不接受玩家点击
    if (this.data.aiEnabled && this.data.current === this.data.aiColor) return;

    const cs = this.canvasSize / (GRID_SIZE - 1);
    const rx = Math.round(px / cs);
    const ry = Math.round(py / cs);
    if (rx < 0 || rx >= GRID_SIZE || ry < 0 || ry >= GRID_SIZE) return;

    const board = this.data.board.map(row => row.slice());
    if (board[ry][rx] !== 0) return; // 已有子
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
      // 若是 AI 模式，触发 AI 落子（短延迟）
      if (this.data.aiEnabled && this.data.current === this.data.aiColor) {
        setTimeout(() => this.aiMove(), 300);
      }
    });
  },

  checkWin(x, y, color) {
    // 从 (x,y) 检查四个方向，返回五子坐标数组或 null
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
    if (!this.ctx) return;
    const ctx = this.ctx;
    const size = this.canvasSize || CANVAS_DISPLAY_SIZE;
    const cs = size / (GRID_SIZE - 1);
    const ratio = this.canvasRatio || 1;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.scale(ratio, ratio);

    ctx.setLineWidth(1);
    ctx.setStrokeStyle('#333');
    ctx.beginPath();
    for (let i = 0; i < GRID_SIZE; i++) {
      const pos = i * cs + 0.5;
      ctx.moveTo(pos, 0.5);
      ctx.lineTo(pos, size - 0.5);
      ctx.moveTo(0.5, pos);
      ctx.lineTo(size - 0.5, pos);
    }
    ctx.stroke();
    ctx.closePath();

    const starPoints = [3, 7, 11];
    ctx.setFillStyle('#333');
    for (let i of starPoints) {
      for (let j of starPoints) {
        ctx.beginPath();
        ctx.arc(i * cs, j * cs, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
      }
    }

    const board = this.data.board;
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const v = board[y][x];
        if (v === 0) continue;
        const px = x * cs;
        const py = y * cs;
        ctx.beginPath();
        const rad = cs * 0.42;
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.closePath();
        if (v === 1) {
          const g = ctx.createLinearGradient(px - rad, py - rad, px + rad, py + rad);
          g.addColorStop(0, '#555');
          g.addColorStop(1, '#000');
          ctx.setFillStyle(g);
          ctx.fill();
        } else {
          ctx.setFillStyle('#fff');
          ctx.fill();
          ctx.setStrokeStyle('#999');
          ctx.setLineWidth(1);
          ctx.stroke();
        }
      }
    }

    if (this.data.gameOver && this.data.winCoords && this.blinkOn) {
      ctx.setStrokeStyle('#ff0000');
      ctx.setLineWidth(4);
      for (let p of this.data.winCoords) {
        const px = p.x * cs;
        const py = p.y * cs;
        ctx.beginPath();
        ctx.arc(px, py, cs * 0.48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.closePath();
      }
    }

    ctx.restore();
    ctx.draw();
  },

  // AI 相关实现
  aiMove() {
    if (!this.data.aiEnabled || this.data.gameOver) return;
    // 计算落子
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
      currentTurnText: (this.data.aiColor === 1 ? '白方' : '黑方') // 之后会被更新为下一个玩家文本
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

    // 检查能直接获胜或需立即封堵的点
    let bestBlock = null;
    // 权重表：连续个数 -> 分值
    const weight = { 1: 10, 2: 100, 3: 1000, 4: 10000 };

    let bestScore = -Infinity;
    let bestMove = null;

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (board[y][x] !== 0) continue;
        // 若在此落子，检查是否能直接获胜（AI）
        if (this.willWinOnBoard(board, x, y, ai)) {
          return { x, y }; // 立即获胜直接返回
        }
        // 若人落子在此能直接获胜，则这是一个必须封堵的位置
        if (this.willWinOnBoard(board, x, y, human)) {
          bestBlock = { x, y };
          // 先记录但不必立刻返回 — 继续寻找必赢点
        }

        // 评分函数：计算连珠长度（简单版，不区分活/死）
        const scoreFor = this.evalPoint(board, x, y, ai, weight);
        const scoreAgainst = this.evalPoint(board, x, y, human, weight);
        const score = scoreFor - scoreAgainst;
        if (score > bestScore) {
          bestScore = score;
          bestMove = { x, y };
        }
      }
    }

    if (bestMove) {
      // 若无必赢点但有必须封堵点，优先堵
      if (bestBlock) return bestBlock;
      return bestMove;
    }
    // 若没找到（极罕见），返回第一个空格
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (board[y][x] === 0) return { x, y };
      }
    }
    return null;
  },

  // 在给定 board 上判断放在 (x,y) 后是否获胜（不修改原 board）
  willWinOnBoard(board, x, y, color) {
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 }
    ];
    for (let d of dirs) {
      let count = 1;
      let px = x + d.dx, py = y + d.dy;
      while (this.inBoard(px, py) && (board[py][px] === color)) {
        count++;
        px += d.dx; py += d.dy;
      }
      px = x - d.dx; py = y - d.dy;
      while (this.inBoard(px, py) && (board[py][px] === color)) {
        count++;
        px -= d.dx; py -= d.dy;
      }
      if (count >= 5) return true;
    }
    return false;
  },

  // 简单评估点的价值：对四个方向计算连续子数并累加权重
  evalPoint(board, x, y, color, weight) {
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 }
    ];
    let total = 0;
    for (let d of dirs) {
      let count = 1; // 包括当前点
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
      if (count > 4) count = 4;
      total += (weight[count] || 0);
    }
    return total;
  }
});

// 五子棋首页（国风主界面）
const GRID_SIZE = 15;

Page({
  data: {
    statusBarHeight: 20
  },

  onLoad() {
    const info = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync();
    this.setData({ statusBarHeight: info.statusBarHeight || 20 });
  },

  onReady() {
    this.setupBoard();
  },

  startAI() {
    wx.navigateTo({ url: '/pages/game/game?mode=ai' });
  },

  startPVP() {
    wx.navigateTo({ url: '/pages/game/game?mode=pvp' });
  },

  dailyChallenge() {
    wx.showToast({ title: '每日挑战即将上线', icon: 'none' });
  },

  showRules() {
    wx.showModal({
      title: '五子棋规则',
      content: '1. 黑白双方轮流落子\n2. 先在横、竖、斜方向连成五子者获胜\n3. 人机模式下 AI 执白后手',
      showCancel: false
    });
  },

  setupBoard() {
    wx.createSelectorQuery()
      .select('#home-board')
      .fields({ node: true, size: true })
      .exec(res => {
        const info = res && res[0];
        if (!info || !info.node) {
          setTimeout(() => this.setupBoard(), 120);
          return;
        }
        const canvas = info.node;
        const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2;
        const cssW = info.width;
        const cssH = info.height;
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        this.drawBoard(ctx, cssW);
      });
  },

  drawBoard(ctx, size) {
    const cs = size / (GRID_SIZE - 1);

    // 棋盘背景
    ctx.fillStyle = '#f0d9a6';
    ctx.fillRect(0, 0, size, size);

    // 棋盘线
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#8a6e45';
    ctx.beginPath();
    for (let i = 0; i < GRID_SIZE; i++) {
      const pos = i * cs;
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
    }
    ctx.stroke();

    // 星位
    ctx.fillStyle = '#5c4a2e';
    [3, 7, 11].forEach(i => {
      [3, 7, 11].forEach(j => {
        ctx.beginPath();
        ctx.arc(i * cs, j * cs, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // 装饰棋子（摆出一盘激战中的局面）
    const pieces = [
      { x: 7, y: 7, c: 1 }, { x: 7, y: 8, c: 2 }, { x: 8, y: 8, c: 1 }, { x: 6, y: 7, c: 2 },
      { x: 8, y: 7, c: 2 }, { x: 7, y: 6, c: 1 }, { x: 6, y: 6, c: 2 }, { x: 8, y: 6, c: 1 },
      { x: 5, y: 7, c: 1 }, { x: 9, y: 7, c: 2 }, { x: 7, y: 5, c: 1 }, { x: 7, y: 9, c: 2 },
      { x: 6, y: 8, c: 1 }, { x: 8, y: 9, c: 2 }, { x: 9, y: 8, c: 1 }, { x: 5, y: 8, c: 2 },
      { x: 6, y: 5, c: 1 }, { x: 8, y: 5, c: 2 }, { x: 5, y: 6, c: 1 }, { x: 9, y: 6, c: 2 }
    ];
    pieces.forEach(p => this.drawPiece(ctx, p.x * cs, p.y * cs, p.c, cs));
  },

  drawPiece(ctx, px, py, color, cs) {
    const rad = cs * 0.42;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    if (color === 1) {
      const g = ctx.createLinearGradient(px - rad, py - rad, px + rad, py + rad);
      g.addColorStop(0, '#555');
      g.addColorStop(1, '#000');
      ctx.fillStyle = g;
      ctx.fill();
    } else {
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#bbb';
      ctx.stroke();
    }
  }
});

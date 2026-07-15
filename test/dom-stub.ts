/**
 * Minimal browser-environment stub so the game's runtime logic can be exercised
 * headless in Node. Only what the game actually touches is implemented. This
 * file is for local verification only and is not part of the shipped game.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

let now = 0;
export const clock = {
  set(v: number) {
    now = v;
  },
  advance(v: number) {
    now += v;
    return now;
  },
  get() {
    return now;
  },
};

function makeContext(canvas: any): any {
  const grad = { addColorStop() {} };
  const ctx: any = {
    canvas,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    lineJoin: 'miter',
    lineCap: 'butt',
    miterLimit: 10,
    imageSmoothingEnabled: true,
  };
  const methods = [
    'save', 'restore', 'translate', 'rotate', 'scale', 'setTransform', 'resetTransform',
    'beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo',
    'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'fill', 'stroke', 'clip',
    'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'drawImage',
  ];
  for (const m of methods) ctx[m] = () => {};
  ctx.createLinearGradient = () => grad;
  ctx.createRadialGradient = () => grad;
  ctx.measureText = (t: string) => ({ width: (t?.length ?? 0) * 6 });
  return ctx;
}

class FakeCanvas {
  width = 0;
  height = 0;
  style: any = {};
  private _ctx: any = null;
  getContext() {
    if (!this._ctx) this._ctx = makeContext(this);
    return this._ctx;
  }
  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.width, height: this.height, right: this.width, bottom: this.height };
  }
}

const doc: any = {
  createElement(tag: string) {
    if (tag === 'canvas') return new FakeCanvas();
    return { style: {}, appendChild() {}, setAttribute() {}, addEventListener() {} };
  },
  getElementById() {
    return new FakeCanvas();
  },
  addEventListener() {},
  body: { appendChild() {} },
};

const storage = (() => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
})();

const win: any = {
  devicePixelRatio: 1,
  innerWidth: 400,
  innerHeight: 700,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame: () => 0, // no auto-scheduling during tests
  cancelAnimationFrame: () => {},
  AudioContext: undefined,
};

(globalThis as any).window = win;
(globalThis as any).document = doc;
(globalThis as any).localStorage = storage;
(globalThis as any).devicePixelRatio = 1;
(globalThis as any).requestAnimationFrame = win.requestAnimationFrame;
(globalThis as any).cancelAnimationFrame = win.cancelAnimationFrame;
(globalThis as any).performance = { now: () => now };
(globalThis as any).HTMLCanvasElement = FakeCanvas;

export { FakeCanvas, storage };

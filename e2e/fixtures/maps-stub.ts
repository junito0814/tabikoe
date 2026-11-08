import type { BrowserContext, Request } from "@playwright/test";

/**
 * e2e-foundation Task 4: ブラウザが読む Google マップの偽物（スタブ）
 * 出典: docs/tasks/shared-ui/e2e-foundation/04-maps-stub.md
 *
 * 【初心者向け】画面は地図を出すとき、`https://maps.googleapis.com/maps/api/js?...&callback=名前` を読み込みます
 * （src/components/map/use-google-maps.ts）。本物を読むと課金され、位置情報の許可ダイアログも出ます。
 * そこでこの要求だけを押さえ、**画面が実際に使う分だけの `google.maps`** を定義する JavaScript を返します。
 *
 * 地図の絵は出しません。代わりに、テストから見られる目印を置きます。
 *   - 地図: `data-testid="map-stub"`（`data-center`・`data-zoom`・`data-markers` に、中心・拡大率・ピンの数）
 *   - ピン: `data-testid="map-stub-marker"`（`data-title` に名前）
 *
 * **それ以外の Google 宛の通信は、すべて失敗させて記録します**（`blocked`）。
 * スタブが足りずに本物を呼ぼうとしたら、ここに残るので、テストで「0 件」を確かめれば気づけます。
 *
 * 用意しているもの（src/components/map/GoogleMap.tsx と @googlemaps/markerclusterer が使う分）
 *   Map・Marker・Circle・OverlayView・LatLng・LatLngBounds・Point・Size・event・SymbolPath・importLibrary
 * `google.maps.marker`（AdvancedMarkerElement）は**わざと用意しない**。まとめ表示の部品は、これがあると
 * 新しい形のピンを使おうとするため。いまの画面は古い形（Marker）を使っている（#1010 で移す予定）。
 */
const MAPS_STUB_SCRIPT = `(() => {
  const listeners = new WeakMap();
  const event = {
    addListener(target, name, handler) {
      let byName = listeners.get(target);
      if (!byName) { byName = {}; listeners.set(target, byName); }
      (byName[name] ||= new Set()).add(handler);
      return { remove() { byName[name].delete(handler); } };
    },
    removeListener(handle) { if (handle && handle.remove) handle.remove(); },
    trigger(target, name, ...args) {
      const byName = listeners.get(target);
      if (byName && byName[name]) [...byName[name]].forEach((handler) => handler(...args));
    },
    clearInstanceListeners(target) { listeners.delete(target); },
  };
  class MVCObject {
    addListener(name, handler) { return event.addListener(this, name, handler); }
    set(key, value) { this[key] = value; }
    get(key) { return this[key]; }
  }
  class LatLng {
    constructor(a, b) {
      if (a && typeof a === "object") {
        this._lat = typeof a.lat === "function" ? a.lat() : a.lat;
        this._lng = typeof a.lng === "function" ? a.lng() : a.lng;
      } else { this._lat = a; this._lng = b; }
    }
    lat() { return this._lat; }
    lng() { return this._lng; }
    equals(other) { return !!other && other.lat() === this._lat && other.lng() === this._lng; }
    toJSON() { return { lat: this._lat, lng: this._lng }; }
  }
  const toLatLng = (point) => (point instanceof LatLng ? point : new LatLng(point));
  class LatLngBounds {
    constructor(sw, ne) { this._sw = sw ? toLatLng(sw) : null; this._ne = ne ? toLatLng(ne) : null; }
    extend(point) {
      const p = toLatLng(point);
      if (!this._sw) { this._sw = new LatLng(p.lat(), p.lng()); this._ne = new LatLng(p.lat(), p.lng()); return this; }
      this._sw = new LatLng(Math.min(this._sw.lat(), p.lat()), Math.min(this._sw.lng(), p.lng()));
      this._ne = new LatLng(Math.max(this._ne.lat(), p.lat()), Math.max(this._ne.lng(), p.lng()));
      return this;
    }
    union(other) { if (other && !other.isEmpty()) { this.extend(other.getSouthWest()); this.extend(other.getNorthEast()); } return this; }
    getSouthWest() { return this._sw; }
    getNorthEast() { return this._ne; }
    getCenter() { return new LatLng((this._sw.lat() + this._ne.lat()) / 2, (this._sw.lng() + this._ne.lng()) / 2); }
    contains(point) {
      if (!this._sw) return false;
      const p = toLatLng(point);
      return p.lat() >= this._sw.lat() && p.lat() <= this._ne.lat() && p.lng() >= this._sw.lng() && p.lng() <= this._ne.lng();
    }
    isEmpty() { return !this._sw; }
    toJSON() { return this._sw ? { south: this._sw.lat(), west: this._sw.lng(), north: this._ne.lat(), east: this._ne.lng() } : null; }
  }
  class Point { constructor(x, y) { this.x = x; this.y = y; } equals(o) { return !!o && o.x === this.x && o.y === this.y; } }
  class Size { constructor(width, height) { this.width = width; this.height = height; } }
  class StubMap extends MVCObject {
    constructor(element, options = {}) {
      super();
      this._element = element;
      this._options = { ...options };
      this._center = toLatLng(options.center || { lat: 35.681236, lng: 139.767125 });
      this._zoom = typeof options.zoom === "number" ? options.zoom : 12;
      this._markers = new Set();
      this._root = document.createElement("div");
      this._root.setAttribute("data-testid", "map-stub");
      this._root.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#dce3ea;color:#7b8794;font-size:12px";
      this._root.textContent = "地図の代わり（E2E）";
      element.appendChild(this._root);
      this._sync();
      setTimeout(() => { event.trigger(this, "tilesloaded"); event.trigger(this, "idle"); }, 0);
    }
    _sync() {
      this._root.setAttribute("data-center", this._center.lat() + "," + this._center.lng());
      this._root.setAttribute("data-zoom", String(this._zoom));
      this._root.setAttribute("data-markers", String(this._markers.size));
    }
    _moved() { this._sync(); setTimeout(() => event.trigger(this, "idle"), 0); }
    getDiv() { return this._element; }
    getCenter() { return this._center; }
    setCenter(center) { this._center = toLatLng(center); event.trigger(this, "center_changed"); this._moved(); }
    panTo(center) { this.setCenter(center); }
    panBy() {}
    getZoom() { return this._zoom; }
    setZoom(zoom) { this._zoom = zoom; event.trigger(this, "zoom_changed"); this._moved(); }
    fitBounds(bounds) {
      const b = bounds instanceof LatLngBounds ? bounds : new LatLngBounds({ lat: bounds.south, lng: bounds.west }, { lat: bounds.north, lng: bounds.east });
      if (!b.isEmpty()) this._center = b.getCenter();
      this._moved();
    }
    getBounds() {
      const span = 360 / Math.pow(2, this._zoom);
      const c = this._center;
      return new LatLngBounds({ lat: c.lat() - span / 4, lng: c.lng() - span / 2 }, { lat: c.lat() + span / 4, lng: c.lng() + span / 2 });
    }
    setOptions(options) { Object.assign(this._options, options || {}); }
    getProjection() {
      const center = this._center;
      return {
        fromLatLngToDivPixel: () => new Point(0, 0),
        fromDivPixelToLatLng: () => center,
        fromLatLngToPoint: () => new Point(0, 0),
        fromPointToLatLng: () => center,
      };
    }
    _addMarker(marker) { this._markers.add(marker); this._root.appendChild(marker._element); this._sync(); }
    _removeMarker(marker) { this._markers.delete(marker); marker._element.remove(); this._sync(); }
  }
  class Marker extends MVCObject {
    constructor(options = {}) {
      super();
      this._options = { ...options };
      this._position = options.position ? toLatLng(options.position) : null;
      this._map = null;
      this._element = document.createElement("button");
      this._element.type = "button";
      this._element.setAttribute("data-testid", "map-stub-marker");
      if (options.title) this._element.setAttribute("data-title", options.title);
      this._element.addEventListener("click", () => event.trigger(this, "click"));
      if (options.map) this.setMap(options.map);
    }
    setMap(map) { if (this._map) this._map._removeMarker(this); this._map = map || null; if (map) map._addMarker(this); }
    getMap() { return this._map; }
    getPosition() { return this._position; }
    setPosition(position) { this._position = toLatLng(position); }
    getTitle() { return this._element.getAttribute("data-title"); }
    setTitle(title) { this._element.setAttribute("data-title", title); }
    setIcon() {}
    setLabel() {}
    setOptions(options) { Object.assign(this._options, options || {}); }
    setVisible() {}
    getVisible() { return true; }
    setZIndex() {}
    getZIndex() { return 0; }
    getClickable() { return true; }
    getDraggable() { return false; }
  }
  Marker.MAX_ZINDEX = 1000000;
  class Circle extends MVCObject {
    constructor(options = {}) { super(); this._map = options.map || null; }
    setMap(map) { this._map = map || null; }
    getMap() { return this._map; }
    setCenter() {}
    setRadius() {}
    setOptions() {}
  }
  class OverlayView extends MVCObject {
    setMap(map) {
      if (this._map && this.onRemove) this.onRemove();
      this._map = map || null;
      if (map) { if (this.onAdd) this.onAdd(); if (this.draw) this.draw(); }
    }
    getMap() { return this._map; }
    getPanes() {
      const pane = document.createElement("div");
      return { floatPane: pane, mapPane: pane, markerLayer: pane, overlayLayer: pane, overlayMouseTarget: pane };
    }
    getProjection() { return this._map ? this._map.getProjection() : null; }
    static preventMapHitsAndGesturesFrom() {}
    static preventMapHitsFrom() {}
  }
  const maps = {
    Map: StubMap, Marker, Circle, OverlayView, LatLng, LatLngBounds, Point, Size, MVCObject, event,
    SymbolPath: { CIRCLE: 0 }, ControlPosition: {}, MapTypeId: { ROADMAP: "roadmap" },
    importLibrary: async () => maps,
  };
  window.google = { maps };
})();`;

export interface GoogleBrowserStub {
  /** 失敗させた Google 宛の通信（スタブが足りずに本物を呼ぼうとしたもの） */
  blocked: string[];
  /** 地図の読み込み（スタブで答えたもの）の回数 */
  mapsScriptLoads: number;
}

const GOOGLE_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|gstatic\.com|googleusercontent\.com|google\.com)\//;

/** ブラウザの「入れ物」（context）に、Google 宛の通信の差し替えを入れる */
export async function installGoogleBrowserStub(context: BrowserContext): Promise<GoogleBrowserStub> {
  const stub: GoogleBrowserStub = { blocked: [], mapsScriptLoads: 0 };
  await context.route(GOOGLE_HOSTS, async (route) => {
    const request: Request = route.request();
    const url = new URL(request.url());
    if (url.hostname === "maps.googleapis.com" && url.pathname === "/maps/api/js") {
      stub.mapsScriptLoads += 1;
      const callback = url.searchParams.get("callback");
      const body = MAPS_STUB_SCRIPT + (callback ? `\nwindow[${JSON.stringify(callback)}] && window[${JSON.stringify(callback)}]();` : "");
      await route.fulfill({ status: 200, contentType: "text/javascript", body });
      return;
    }
    stub.blocked.push(`${request.method()} ${url.origin}${url.pathname}`);
    await route.abort("blockedbyclient");
  });
  return stub;
}

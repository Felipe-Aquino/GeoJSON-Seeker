const total_width = 800 * 0.95;
const total_height = 600 * 0.90;

const ctx = {
  width: total_width,
  height: total_height,
  img: null,
  offset: null,
  points: [],
  path: [],

  loading: false,
  coords: [],
  show_coords: false,

  marking_points: false,
  removing_points: false,

  canvas_loaded: false,

  scroll_offset: { x: 0, y: 0 },

  clear() {
    this.img = null;
    this.offset = null;
    this.points = [];
    this.path = [];
    this.coords = [];

    this.marking_points = false;
    this.removing_points = false;

    this.width = total_width;
    this.height = total_height;

    this.scroll_offset = { x: 0, y: 0 };

    this.canvas_loaded = false;
  },
};

const ui = {
  hot_id: -1,
  last_hot_id: -1,
  pressed_id: -1,
  last_pressed_id: -1,

  loader_offset: 0,

  pin_icon: null,
  path_icon: null,
  broom_icon: null,
  clipboard_icon: null,

  reset() {
    this.last_hot_id = this.hot_id;
    this.hot_id = -1;

    this.last_pressed_id = this.pressed_id;
    this.pressed_id = -1;
  },
  cyrb53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;

    for(let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
};

// Function to retrieve state
async function getState(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key]);
    });
  });
}

function setState(key, value) {
  const data = {};
  data[key] = value;
  chrome.storage.local.set(data, () => {
    console.log('State saved:', key, value);
  });
}

document.addEventListener('DOMContentLoaded', async function () {
  let coords = await getState('coords');

  if (coords) {
    coords = JSON.parse(coords);
  } else {
    coords = [];
  }

  ctx.coords = coords;

  if (ctx.coords.length === 0) {
    listenClicks();
  }

  const p5_main = document.getElementById('p5-main');
  p5_main.addEventListener('scroll', () => {
    ctx.scroll_offset.x = p5_main.scrollLeft;
    ctx.scroll_offset.y = p5_main.scrollTop;
  });
});

function getCanvas() {
  ctx.loading = true;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'get-canvas' });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'process-image-done') {
    loadP5ImageFromWasm(message.result);
    ctx.loading = false;
  }
});

function listenClicks() {
  console.log('@@ send listen clicks');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'listen-clicks' }, (response) => {
      console.log('listening clicks');
    });
  });
}

function preload() {
  // TODO: add icon attribution if needed
  // <a href="https://www.flaticon.com/free-icons/path" title="path icons">Path icons created by Bharat Icons - Flaticon</a>
  // <a href="https://www.flaticon.com/free-icons/pushpin" title="pushpin icons">Pushpin icons created by ekays.dsgn - Flaticon</a>
  // <a href="https://www.flaticon.com/free-icons/clear" title="clear icons">Clear icons created by LAFS - Flaticon</a>
  // <a href="https://www.flaticon.com/free-icons/path" title="path icons">Path icons created by prettycons - Flaticon</a>
  // <a href="https://www.flaticon.com/free-icons/path" title="path icons">Path icons created by prettycons - Flaticon</a>
  // <a href="https://www.flaticon.com/free-icons/clipboard" title="clipboard icons">Clipboard icons created by Freepik - Flaticon</a>

  ui.pin_icon = loadImage('/assets/pin2_white_32px.png');
  ui.broom_icon = loadImage('/assets/broom2_white_32px.png');
  ui.path_icon = loadImage('/assets/route_white_32px.png');
  ui.clipboard_icon = loadImage('/assets/clipboard_white_32px.png');
}

function setup() {
  createCanvas(ctx.width, ctx.height);

  ui.pin_icon.resize(20, 0);
  ui.broom_icon.resize(20, 0);
  ui.path_icon.resize(20, 0);
  ui.clipboard_icon.resize(20, 0);
}

function draw() {
  textAlign(LEFT, TOP);

  if (ctx.img) {
    image(ctx.img, 0, 0);
  } else {
    // background(110);
    background(230);
  }

  noFill();
  strokeWeight(2);

  // stroke(122, 244, 158);
  stroke(0x26, 0x35, 0xd7)
  //stroke(0x7, 0x54, 0x1e);


  if (ctx.path.length === 0) {
    for (const point of ctx.points) {
      ellipse(point.x, point.y, 10, 10);
    }
  } else {
    strokeWeight(4);
    const len = ctx.path.length;

    for (let i = 0; i < len - 1; i += 1) {
      const p1 = ctx.path[i];
      const p2 = ctx.path[i + 1];

      line(p1.x, p1.y, p2.x, p2.y);
    }
  }

  let msg = '';

  if (ctx.coords.length === 0) {
    msg = 'Adicione 2 pontos no mapa';
  } else if (ctx.coords.length === 1) {
    msg = 'Adicione 1 ponto no mapa';
  } else if (!ctx.img && !ctx.loading) {
    msg = 'Clique em Load Canvas';
  }

  if (msg) {
    fill(0x00)
    textSize(20);
    noStroke();

    const w = textWidth(msg);
    text(msg, (ctx.width - w) / 2, (ctx.height - 10) / 2);
  }

  if (ctx.loading) {
    loader(ctx.width / 2, ctx.height / 2, 5, 50, 5);
  }

  let x = 10 + ctx.scroll_offset.x;
  let y = 10 + ctx.scroll_offset.y;

  if (!ctx.canvas_loaded && button('Load Canvas', x, y)) {
    if (ctx.coords.length == 2 && !ctx.loading) {
      getCanvas();
      ctx.canvas_loaded = true;
    }
  }

  if (ctx.canvas_loaded && !ctx.loading) {
    if (icon_button(ui.pin_icon, 'Marcar pontos', x, y, ctx.marking_points)) {
      ctx.path = [];
      ctx.marking_points = !ctx.marking_points;
      ctx.removing_points = false;
    }

    y += 50;
    if (icon_button(ui.broom_icon, 'Remover pontos', x, y, ctx.removing_points)) {
      ctx.path = [];
      ctx.marking_points = false;
      ctx.removing_points = !ctx.removing_points;
    }

    y += 50;
    if (icon_button(ui.path_icon, 'Conectar pontos', x, y)) {
      const ok = !(ctx.marking_points || ctx.removing_points);
      if (ok && ctx.path.length === 0) {
        ctx.path = connect_points(ctx.points);
      } else if (ctx.path.length > 0) {
        ctx.path = [];
      }
    }

    y += 50;
    if (ctx.path.length > 0 && icon_button(ui.clipboard_icon, 'Copiar', x, y)) {
      geojson_to_clipboard(ctx.path, ctx.coords, ctx.offset);
    }
  }

  const editing = ctx.marking_points || ctx.removing_points;

  y = ctx.scroll_offset.y + total_height - 110;
  if (!editing && button('Ver Coords', x, y)) {
    ctx.show_coords = !ctx.show_coords;
  }

  if (ctx.show_coords) {
    const w = textWidth('Limpar Coords') + 20;
    points_table(ctx.coords, x + w, y - 40);
  }

  y += 50;
  if (!editing &&  button('Limpar Coords', x, y)) {
    setState('coords', '');
    listenClicks();

    ctx.clear();
    resizeCanvas(ctx.width, ctx.height);
  }

  ui.reset();
}

function mouseClicked() {
  if (ui.hot_id !== -1 || ui.last_hot_id !== -1) {
    return;
  }

  if (ctx.marking_points) {
    const pt = {
      x: mouseX,
      y: mouseY,
    };

    const found = ctx.points.find((p) => pt_dist2(p, pt) < 144);

    if (!found) {
      ctx.points.push(pt);
    }
  }

  if (ctx.removing_points) {
    const pt = {
      x: mouseX,
      y: mouseY,
    };

    const idx = ctx.points.findIndex((p) => pt_dist2(p, pt) < 144);

    if (idx >= 0) {
      ctx.points.splice(idx, 1);
    }
  }
}

function button(name, x, y) {
  const id = ui.cyrb53(name, x * y);

  strokeWeight(0.5);
  textStyle(NORMAL);
  textSize(16);

  const w = textWidth(name) + 16;
  const h = 40;
  const r = 2;
  
  let clicked = false;
  if (mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h) {
    ui.hot_id = id;

    if (mouseIsPressed) {
      ui.pressed_id  = id;
      if (id !== ui.last_pressed_id) {
        clicked = true;
      }

      fill(0x33, 0x33, 0x33);
    } else {
      fill(21, 188, 163);
    }
  } else {
    fill(0, 0xd1, 0xb2);
  }
  
  strokeWeight(0.5);
  // stroke(0, 0xd1, 0xb2);
  // stroke(0x7, 0x54, 0x1e);
  stroke(0x27, 0x74, 0x2e);

  rect(x, y, w, h, r);
  
  fill(0xff);
  noStroke();

  text(name, x + 8, y + h / 2 - 7);
  
  return clicked;
}

function icon_button(icon, name, x, y, toggle) {
  if (!icon) {
    return;
  }

  const id = ui.cyrb53(name, x * y);

  strokeWeight(0.5);
  textStyle(NORMAL);
  textSize(16);

  const w = icon.width + 16;
  const h = 40;
  const r = 2;
  
  let clicked = false;
  if (mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h) {
    ui.hot_id = id;

    if (mouseIsPressed) {
      ui.pressed_id  = id;
      if (id !== ui.last_pressed_id) {
        clicked = true;
      }

      fill(0x33, 0x33, 0x33);
    } else {
      fill(21, 188, 163);
    }
  } else {
    fill(0, 0xd1, 0xb2);
  }

  if (toggle) {
    fill(0x33, 0x33, 0x33);
  }
  
  strokeWeight(0.5);
  // stroke(0, 0xd1, 0xb2);
  // stroke(0x7, 0x54, 0x1e);
  stroke(0x27, 0x74, 0x2e);

  const w2 = ui.hot_id === id || toggle
    ? w + textWidth(name) + 6
    : w;

  rect(x, y, w2, h, r);
  
  image(icon, x + (w - icon.width) / 2, y + (h - icon.height) / 2);

  if (ui.hot_id === id || toggle) {
    fill(0xff);
    noStroke();

    const x2 = x + icon.width + 8 + 6;
    text(name, x2, y + h / 2 - 7);
  }
  
  return clicked;
}

function points_table(points, x, y) {
  const letter_width = textWidth('M');
  const pad = 6;
  const xspacing = 3;
  const yspacing = 13;
  const w = letter_width * (9 * 2 + 3) + 2 * xspacing + 2 * pad;
  const h = 16 + 4 * 14 + 4 * yspacing + 2 * pad;

  fill(0xff);
  stroke(0x00);
  strokeWeight(0.5);
  
  rect(x, y, w, h);

  stroke(0x99);
  strokeWeight(0.5);
  
  let x0 = x;
  let y0 = y + pad + 16 + yspacing / 2 - 2;
  
  for (let i = 0; i < 4; ++i) {
    line(x0, y0, x0 + w, y0);
    y0 += 14 + yspacing;
  }
  
  fill(0x00);
  stroke(0x00);
  strokeWeight(0.5);
  textStyle(NORMAL);
  textSize(16);

  x0 = x + letter_width * 3 + xspacing + pad;
  y0 = y + pad;

  text("Ponto 1", x0, y0);

  x0 = x0 + letter_width * 10 + xspacing;
  text("Ponto 2", x0, y0);
  
  noStroke();
  textSize(14);

  const keys = ['x', 'y', 'lat', 'lng']; 
  x0 = x + pad;
  y0 = y0 + 16 + yspacing;
  for (const k of keys) {
    text(k, x0, y0);
    y0 += 14 + yspacing;
  }
  
  x0 = x + pad + 3 * letter_width + xspacing;
  y0 = y + pad + 16 + yspacing;

  for (const p of points) {
    y0 = y + pad + 16 + yspacing;

    for (const k of keys) {
      text(p[k], x0, y0);
      y0 += 14 + yspacing;
    }
    
    x0 += 10 * letter_width + xspacing;
    y0 = y + pad + 16 + yspacing;
  }
}

function loader(x, y, gap, r1, r2) {
  const speed = 20;
    
  const k = r2 / (2 * r1);
  const theta = Math.atan(2 * k * Math.sqrt(1 - k * k) / (1 - 2 * k * k));
  const n = Math.floor(2 * Math.PI * r1 / (theta * r1 + gap));
  
  for (let i = 0; i < n; i += 1) {
    const ang = 2 * Math.PI * i / n;
    const x1 = x + r1 * Math.cos(ang) + r1 * Math.sin(ang);
    const y1 = y + r1 * Math.cos(ang) - r1 * Math.sin(ang);

    const alfa = 255 - ((Math.floor(ui.loader_offset + i) % n) * 255 / n);
    fill(0, 0, 0, alfa);
    stroke(0, 0, 0, alfa)

    circle(x1, y1, r2);
  }
  
  ui.loader_offset += speed * deltaTime / 1000;
  if (ui.loader_offset >= n) {
    ui.loader_offset = 0;
  }
}

function pt_dist2(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return dx * dx + dy * dy;
}

function swap_remove(arr, len, at) {
  const aux = arr[at];
  arr[at] = arr[len - 1];
  arr[len - 1] = aux;

  return len - 1;
}

function loadP5ImageFromWasm({
  pixels,
  width,
  height,
  offset_x,
  offset_y,
  points,
}) {
  ctx.img = createImage(width, height);
  ctx.img.loadPixels();

  for (let i = 0; i < pixels.length; i += 1) {
    ctx.img.pixels[i] = pixels[i];
  }

  ctx.img.updatePixels();

  ctx.offset = {
    x: offset_x,
    y: offset_y,
  };

  ctx.points = points;

  ctx.width = width;
  ctx.height = height;

  resizeCanvas(ctx.width, ctx.height);
}

function connect_points(points) {
  const path = [];
  const points2 = points.slice();
  let len = points.length;

  const idx = Math.floor(len * Math.random());

  let p1 = points2[idx];
  path.push(p1);

  len = swap_remove(points2, len, idx);

  while (len > 0) {
    let min_dist = Infinity;
    let min_dist_idx = -1;

    for (let j = len - 1; j >= 0; j -= 1) {
      const p2 = points2[j];

      if (min_dist > pt_dist2(p1, p2)) {
        min_dist = pt_dist2(p1, p2);
        min_dist_idx = j;
      }
    }

    p1 = points2[min_dist_idx];
    len = swap_remove(points2, len, min_dist_idx);

    path.push(p1);
  }

  return path;
}

function geojson_to_clipboard(path, coords, offset) {
  const [coord1, coord2] = coords;

  const lng_per_pixel = (coord2.lng - coord1.lng) / (coord2.x - coord1.x);
  const lat_per_pixel = (coord2.lat - coord1.lat) / (coord2.y - coord1.y);

  const lnglats = path.map((pt) => [
    lng_per_pixel * (pt.x + offset.x - coord1.x) + coord1.lng,
    lat_per_pixel * (pt.y + offset.y - coord1.y) + coord1.lat - 0.000085,
  ]);

  lnglats.push(lnglats[0]);

  const geojson = JSON.stringify({ type: 'Polygon', coordinates: [lnglats] });

  navigator.clipboard.writeText(geojson);
}

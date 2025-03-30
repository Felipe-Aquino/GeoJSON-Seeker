const ctx = {
  width: 800 * 0.95,
  height: 600 * 0.90,
  img: null,
  showing_img: null,
  offset: null,
  points: [],

  loading: false,
  coords: [],
  show_points: false,

  scroll_offset: { x: 0, y: 0 },

  clear() {
    this.img = null;
    this.showing_img = null;
    this.offset = null;
    this.points = [];
    this.coords = [];

    this.width = 800 * 0.95;
    this.height = 600 * 0.9;

    this.scroll_offset = { x: 0, y: 0 };
  },
};

const ui = {
  hot_id: -1,
  last_hot_id: -1,
  pressed_id: -1,
  last_pressed_id: -1,

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
    chrome.tabs.sendMessage(tabs[0].id, { action: 'get-canvas' }, (response) => {
      console.log('content\'s response', response);
      if (response.pixels) {
        console.log('len', response.pixels.length);
        loadP5Image(response);
        ctx.loading = false;
      }
    });
  });
}

function listenClicks() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'listen-clicks' }, (response) => {
      console.log('listening clicks');
    });
  });
}

function setup() {
  createCanvas(ctx.width, ctx.height);
}

function draw() {
  textAlign(LEFT, TOP);

  if (ctx.showing_img) {
    image(ctx.showing_img, 0, 0);
  } else {
    // background(110);
    background(230);
  }

  noFill();
  strokeWeight(2);

  stroke(122, 244, 158);

  for (const point of ctx.points) {
    ellipse(point.x, point.y, 10, 10);
  }

  let msg = '';

  if (ctx.coords.length === 0) {
    msg = 'Adicione 2 pontos no mapa';
  } else if (ctx.coords.length === 1) {
    msg = 'Adicione 1 ponto no mapa';
  } else if (!ctx.coords.showing_img) {
    msg = 'Clique em Load Canvas';
  }

  if (msg) {
    fill(0x00)
    textSize(20);
    noStroke();

    const w = textWidth(msg);
    text(msg, (ctx.width - w) / 2, (ctx.height - 10) / 2);
  }

  let x = 10 + ctx.scroll_offset.x;
  let y = 10 + ctx.scroll_offset.y;

  if (button('Load Canvas', x, y) && !ctx.loading) {
    if (ctx.coords.length == 2) {
      getCanvas();
    }
  }

  y += 60;
  if (button('Pontos/Coords', x, y)) {
    ctx.show_points = !ctx.show_points;
  }

  if (ctx.show_points) {
    const w = textWidth('Limpar Coords') + 20;
    points_table(ctx.coords, x + w, y);
  }

  y += 50;
  if (button('Limpar Coords', x, y)) {
    setState('coords', '');
    listenClicks();

    ctx.clear();
    resizeCanvas(ctx.width, ctx.height);
  }

  ui.reset();
}

function button(name, x, y) {
  const id = ui.cyrb53(name, x * y);

  strokeWeight(0.5);
  textStyle(NORMAL);
  textSize(16);

  const w = textWidth(name) + 16;
  const h = 40;
  const r = 2;
  
  let pressed = false;
  if (mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h) {
    ui.hot_id = id;

    if (mouseIsPressed) {
      ui.pressed_id  = id;
      if (id !== ui.last_pressed_id) {
        pressed = true;
      }

      fill(0x33, 0x33, 0x33);
    } else {
      fill(21, 188, 163);
    }
  } else {
    fill(0, 0xd1, 0xb2);
  }
  
  strokeWeight(1);

  rect(x, y, w, h, r);
  
  noFill();
  stroke(0, 0xd1, 0xb2);
  rect(x, y, w, h, r);
  
  fill(0xff);
  noStroke();

  text(name, x + 8, y + h / 2 - 7);
  
  return pressed;
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

function isAround(x, value, p) {
  return (((1 - p) * value <= x) && (x <= (1 + p) * value));
}

function testColor(r, g, b) {
  const v = 0.1;

    // ea4335
    // e27a69
    // e37867
  return isAround(r, 0xea, v) && isAround(g, 0x43, v) && isAround(b, 0x35, v);
  // return isAround(r, 0xf2, v) && isAround(g, 0x78, v) && isAround(b, 0x6b, v);
}

function pt_dist2(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return dx * dx + dy * dy;
}

function swap_remove(arr, size, at) {
  const aux = arr[at];
  arr[at] = arr[size - 1];
  arr[size - 1] = aux;

  return size - 1;
}

function simplify_points(points) {
  const result = [];

  let size = points.length;

  for (let i = size - 1; i >= 0; i -= 1) {
    const p1 = points[i];
    size -= 1;

    for (let j = size - 1; j >= 0; j -= 1) {
      if (i !== j) {
        const p2 = points[j];

        if (pt_dist2(p1, p2) < 144) {
          size = swap_remove(points, size, j);
          i -= 1;
        }
      }
    }

    result.push(p1);
  }

  return result;
}

function loadP5Image({ width, height, pixels }) {
  ctx.img = createImage(width, height);
  
  ctx.img.loadPixels();

  for (let i = 0; i < pixels.length; i += 1) {
    ctx.img.pixels[i] = pixels[i];
  }

  ctx.img.updatePixels();

  const bounds = {
    min_x: width,
    min_y: height,
    max_x: 0,
    max_y: 0,
  };

  let numPixels = 4 * width * height;

  let j = 0;

  for (let i = 0; i < numPixels; i += 4) {
    if (testColor(ctx.img.pixels[i], ctx.img.pixels[i + 1], ctx.img.pixels[i + 2])) {
      const x = j % width;
      const y = Math.floor(j / width);

      if (x < bounds.min_x) {
        bounds.min_x = x;
      }

      if (x > bounds.max_x) {
        bounds.max_x = x;
      }

      if (y < bounds.min_y) {
        bounds.min_y = y;
      }

      if (y > bounds.max_y) {
        bounds.max_y = y;
      }
    }

    j += 1;
  }

  const dw = bounds.max_x - bounds.min_x;
  const dh = bounds.max_y - bounds.min_y;
  const pad = 40;

  ctx.offset = {
    x: bounds.min_x - pad,
    y: bounds.min_y - pad,
  };

  const img2 = createImage(dw + 2 * pad, dh + 2 * pad);

  img2.blend(
    ctx.img,
    ctx.offset.x,
    ctx.offset.y,
    dw + 2 * pad,
    dh + 2 * pad,

    0,
    0,
    dw + 2 * pad,
    dh + 2 * pad,
    ADD
  );

  img2.loadPixels();

  numPixels = 4 * img2.width * img2.height;

  // Black and white pixels used by hough algorithm
  const bw_pixels = new Array(numPixels);
  // let img3 = createImage(img2.width, img2.height);
  // img3.loadPixels();

  for (let i = 0; i < numPixels; i += 4) {
    bw_pixels[i + 3] = 255;
    // img3.pixels[i + 3] = 255;

    if (testColor(img2.pixels[i], img2.pixels[i + 1], img2.pixels[i + 2])) {
      bw_pixels[i] = 0;
      bw_pixels[i + 1] = 0;
      bw_pixels[i + 2] = 0;

      // img3.pixels[i] = 0;
      // img3.pixels[i + 1] = 0;
      // img3.pixels[i + 2] = 0;

    } else {
      bw_pixels[i] = 0xff;
      bw_pixels[i + 1] = 0xff;
      bw_pixels[i + 2] = 0xff;

      // img3.pixels[i] = 0xff;
      // img3.pixels[i + 1] = 0xff;
      // img3.pixels[i + 2] = 0xff;
    }
  }

  // img3.updatePixels();

  const hough = hough_create(bw_pixels, img2.width, img2.height);

  hough_proccess(hough);

  // const lines = hough_lines_of_interest0(hough);

  // ctx.points = lines.flat();

  ctx.points = hough_points_of_interest(hough);
  console.log('points count', ctx.points.length);
  ctx.points = simplify_points(ctx.points);
  console.log('points count', ctx.points.length);

  ctx.width = img2.width;
  ctx.height = img2.height;

  ctx.showing_img = img2;
  // ctx.showing_img = img3;

  resizeCanvas(ctx.width, ctx.height);
}

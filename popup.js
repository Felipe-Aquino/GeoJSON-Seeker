const ctx = {
  width: 1,
  height: 1,
  img: null,
  showing_img: null,
  offset: null,
  points: [],
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
  const load_canvas_btn = document.getElementById("load-canvas");

  load_canvas_btn.addEventListener("click", async () => {
    // setState('coords', '');
    getCanvas();
  });

  const start_clicks_btn = document.getElementById("start-clicks");

  start_clicks_btn.addEventListener("click", async () => {
    setState('coords', '');
    listenClicks();
  });

  const message = document.getElementById("message");

  let coords = await getState('coords');

  if (coords) {
    coords = JSON.parse(coords);
  } else {
    coords = [];
  }

  if (coords.length === 0) {
    load_canvas_btn.style.display = 'none';
    message.innerHTML = '<div>Adicione 2 pontos no mapa</div>';
  } else if (coords.length === 1) {
    load_canvas_btn.style.display = 'none';
    const c = coords[0];

    const table = `
      <table class="table">
        <tr>
          <th></th>
          <th>Ponto 1</th>
          <th>Ponto 2</th>
        </tr>
        <tr>
          <td>x:</td>
          <td>${c.x}</td>
        </tr>
        <tr>
          <td>y:</td>
          <td>${c.y}</td>
        </tr>
        <tr>
          <td>lat:</td>
          <td>${c.lat}</td>
        </tr>
        <tr>
          <td>lng:</td>
          <td>${c.lng}</td>
        </tr>
      </table>
    `;

    message.innerHTML = `${table}<div>Ainda falta 1 ponto</div>`;
  } else {
    start_clicks_btn.style.display = 'none';
    const c1 = coords[0];
    const c2 = coords[1];

    const table = `
      <table class="table">
        <tr>
          <th></th>
          <th>Ponto 1</th>
          <th>Ponto 2</th>
        </tr>
        <tr>
          <td>x:</td>
          <td>${c1.x}</td>
          <td>${c2.x}</td>
        </tr>
        <tr>
          <td>y:</td>
          <td>${c1.y}</td>
          <td>${c2.y}</td>
        </tr>
        <tr>
          <td>lat:</td>
          <td>${c1.lat}</td>
          <td>${c2.lat}</td>
        </tr>
        <tr>
          <td>lng:</td>
          <td>${c1.lng}</td>
          <td>${c2.lng}</td>
        </tr>
      </table>
    `;

    message.innerHTML = `${table}`;
  }
});

function getCanvas() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'get-canvas' }, (response) => {
      console.log('content\'s response', response);
      if (response.pixels) {
        console.log('len', response.pixels.length);
        loadP5Image(response);
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
  if (ctx.showing_img) {
    image(ctx.showing_img, 0, 0);
  } else {
    background(220);
  }

  noFill();
  strokeWeight(2);

  stroke(122, 244, 158);

  for (const point of ctx.points) {
    ellipse(point.x, point.y, 10, 10);
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

const ctx = {
  width: 1,
  height: 1,
  img: null,
  img2: null,
  offset: null,
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
  if (ctx.img2) {
    image(ctx.img2, 0, 0);
  } else {
    background(220);
  }
}

function isAround(x, value, p) {
  return (((1 - p) * value <= x) && (x <= (1 + p) * value));
}

function testColor(r, g, b) {
  const v = 0.1;
  return isAround(r, 0xf2, v) && isAround(g, 0x78, v) && isAround(b, 0x6b, v);
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

  const numPixels = 4 * width * height;

  let j = 0;

  for (let i = 0; i < numPixels; i += 4) {
    // img2.pixels[i + 3] = 255;

    if (testColor(ctx.img.pixels[i], ctx.img.pixels[i + 1], ctx.img.pixels[i + 2])) {
      // img2.pixels[i] = 0;
      // img2.pixels[i + 1] = 0;
      // img2.pixels[i + 2] = 0;

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

    } else {
      // img2.pixels[i] = 0xff;
      // img2.pixels[i + 1] = 0xff;
      // img2.pixels[i + 2] = 0xff;
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

  ctx.img2 = createImage(dw + 2 * pad, dh + 2 * pad);

  ctx.img2.loadPixels();
  
  ctx.img2.blend(
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

  // ctx.img2.updatePixels();

  // ctx.width = 960;
  // ctx.height = ctx.width * height / width | 0;
  ctx.width = ctx.img2.width;
  ctx.height = ctx.img2.height;

  // ctx.img2.resize(ctx.width, ctx.height);
  // ctx.img2.updatePixels();

  resizeCanvas(ctx.width, ctx.height);
}

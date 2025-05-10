// Function to retrieve state
async function get_state(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key]);
    });
  });
}

function set_state(key, value) {
  const data = {};
  data[key] = value;
  chrome.storage.local.set(data, () => {
    console.log('State saved:', key, value);
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

chrome.runtime.onMessage.addListener((message) => {
  console.log('@@ content got', message);
  if (message.action === 'load-map') {
    const all_canvas = document.getElementsByTagName('canvas');

    const canvas = all_canvas[0];

    if (!canvas) {
      console.log('@@ canvas not found');
      return;
    }

    let pixels = null;

    if (canvas.getContext('2d')) { 
      const ctx = canvas.getContext('2d');

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
      pixels = imageData.data;
    } else if (canvas.getContext('webgl')) {
      const ctx = canvas.getContext('webgl');

      pixels = new Uint8Array(canvas.width * canvas.height * 4);

      ctx.readPixels(0, 0, canvas.width, canvas.height, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
    }

    chrome.runtime.sendMessage({
      action: 'process-image',
      pixels,
      width: canvas.width,
      height: canvas.height,
    });
  }

  if (message.action === 'listen-clicks') {
    const all_canvas = document.getElementsByTagName('canvas');

    const canvas = all_canvas[0];

    canvas.addEventListener('click', async (event) => {
      await sleep(3000);
      const coordButton = document.getElementsByClassName('ZqLNQd t9f27')[0];

      console.log(
        'User clicked!!',
        event,
        coordButton && coordButton.innerText,
        coordButton && coordButton.innerHTML
      );

      if (coordButton && coordButton.innerText) {
        // layerX and layerY are non-standard but it's the only way to get an accurate position
        const x = event.layerX * (canvas.width / canvas.clientWidth);
        const y = event.layerY * (canvas.height / canvas.clientHeight);

        const values = coordButton.innerText.split(', ').map((v) => parseFloat(v));
        const state = {
          lat: values[0],
          lng: values[1],
          x,
          y,
        };

        const coords = await get_state('coords');

        if (!coords) {
          set_state('coords', JSON.stringify([state]));
          return;
        }

        const coords_state = JSON.parse(coords);

        if (coords_state[0] && !coords_state[1]) {
          if (state.lat !== coords_state[0].lat || state.lng !== coords_state[0].lng) {
            coords_state.push(state);
            set_state('coords', JSON.stringify(coords_state));
          }
        }
      }
    });
  }
});


// Function to save state
function setState(key, value) {
  const data = {};
  data[key] = value;
  chrome.storage.local.set(data, () => {
    console.log('State saved:', key, value);
  });
}

// Function to retrieve state
function getState(key, callback) {
  chrome.storage.local.get(key, (result) => {
    callback(result[key]);
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get-canvas') {
    const all_canvas = document.getElementsByTagName('canvas');

    const canvas = all_canvas[0];

    let pixels = null;

    if (canvas.getContext('2d')) { 
      const ctx = canvas.getContext('2d');

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // pixels = new Uint8Array(imageData.data);
      pixels = imageData.data;
    } else if (canvas.getContext('webgl')) {
      const ctx = canvas.getContext('webgl');

      pixels = new Uint8Array(canvas.width * canvas.height * 4);

      ctx.readPixels(0, 0, canvas.width, canvas.height, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
    }

    sendResponse({
      pixels,
      width: canvas.width,
      height: canvas.height,
    });
  } else if (request.action === 'listen-clicks') {
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
        const values = coordButton.innerText.split(', ').map((v) => parseFloat(v));
        const state = {
          lat: values[0],
          lng: values[1],
          x: event.clientX,
          y: event.clientY,
        };

        getState('coords', (coords) => {
          if (!coords) {
            setState('coords', JSON.stringify([state]));
            return;
          }

          const coords_state = JSON.parse(coords);

          if (coords_state[0] && !coords_state[1]) {
            if (state.lat !== coords_state[0].lat || state.lng !== coords_state[0].lng) {
              coords_state.push(state);
              setState('coords', JSON.stringify(coords_state));
            }
          }
        });
      }

      // Send a message to the background script
      chrome.runtime.sendMessage({
        action: "clicked-outside",
        target: event.target.tagName,
        x: event.clientX,
        y: event.clientY,
      });
    });
  }

  sendResponse({ data: 'unknown action' });
});


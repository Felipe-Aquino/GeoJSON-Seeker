function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('slept for', ms);
      resolve();
    }, ms);
  });
}

let auto_coord = null;

chrome.runtime.onMessage.addListener(async (message) => {
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

  if (message.action === 'get-auto-coords') {
    const all_canvas = document.getElementsByTagName('canvas');

    const canvas = all_canvas[0];

    const box = canvas.getBoundingClientRect();

    const x1 = canvas.clientWidth - 10;
    const x2 = x1 - 10;
    const y1 = canvas.clientHeight / 2;
    const y2 = y1 - 10;

    const event_positions = [
      {
        clientX: x1,
        clientY: y1,
      },
      {
        clientX: x2,
        clientY: y2,
      },
    ];

    const coords = [];

    let max_attempts = 6;
    let count = 1;

    while (count <= 2 && max_attempts > 0) {
      auto_coord = null;

      fire_mouse_event('mousedown', canvas, event_positions[count - 1]);
      await sleep(30);

      fire_mouse_event('mouseup', canvas, event_positions[count - 1]);
      fire_mouse_event('click', canvas, event_positions[count - 1]);

      await sleep(1000);

      if (auto_coord) {
        const layerX = event_positions[count - 1].clientX - box.x;
        const layerY = event_positions[count - 1].clientY - box.y;
        const x = layerX * (canvas.width / canvas.clientWidth);
        const y = layerY * (canvas.height / canvas.clientHeight);

        coords.push({
          x,
          y,
          ...auto_coord,
        });

        count += 1;
      }

      max_attempts -= 1;
    }

    console.log('coords', coords);

    if (coords.length > 0) {
      chrome.runtime.sendMessage({
        action: 'coords-loaded',
        coords,
      });
    } else {
      chrome.runtime.sendMessage({
        action: 'coords-not-loaded',
      });
    }
  }
});

// content.js
window.addEventListener('message', function(event) {
  if (event.source !== window) return;

  if (event.data.type && event.data.type === 'seeker-xhr-event') {
    console.log('Received message from injected script:', event.data);
    auto_coord = {
      lat: event.data.lat,
      lng: event.data.lng,
    }
  }
}, false);

function fire_mouse_event(type, target, options) {
  const event = target.ownerDocument.createEvent('MouseEvents');

  options = {
    type,
    canBubble: true,
    cancelable: true,
    view: target.ownerDocument.defaultView,
    detail: 1,
    screenX: 0,
    screenY: 0,
    clientX: 0,
    clientY: 0,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    button: 0, // 0 = left, 1 = middle, 2 = right
    relatedTarget: null,
    ...(options || {}),
  };

  event.initMouseEvent(
    options.type,
    options.canBubble,
    options.cancelable,
    options.view,
    options.detail,
    options.screenX,
    options.screenY,
    options.clientX,
    options.clientY,
    options.ctrlKey,
    options.altKey,
    options.shiftKey,
    options.metaKey,
    options.button,
    options.relatedTarget
  );

  target.dispatchEvent(event);
}

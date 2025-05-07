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
});


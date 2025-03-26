console.log('@@ Hello from background');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "clicked-outside") {
    if (message.target === 'CANVAS') {
      console.log('Clicked outside the popup! Target:', message);
    }
  }
});


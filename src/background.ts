const REPLAYS_URL = 'https://playtupo.com/?replay';

browser.browserAction.onClicked.addListener((tab) => {
  const onTupo = tab.url?.startsWith('https://playtupo.com/') ?? false;
  if (onTupo && tab.id !== undefined) void browser.tabs.update(tab.id, { url: REPLAYS_URL });
  else void browser.tabs.create({ url: REPLAYS_URL, windowId: tab.windowId });
});

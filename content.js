window.addEventListener(
  "message",
  event => {

    if (
      event.source !== window ||
      event.data?.source !== "SIAPS_TOOL"
    ) {

      return;

    }

    chrome.runtime.sendMessage(
      event.data
    );

  }
);

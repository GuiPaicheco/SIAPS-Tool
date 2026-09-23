if (
  !globalThis.__SIAPS_TOOL_BRIDGE_ATIVA__
) {

  globalThis.__SIAPS_TOOL_BRIDGE_ATIVA__ =
    true;

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

}

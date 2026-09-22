async function executarNoSiaps(
  tabId,
  configuracao
) {

  await chrome.scripting.executeScript({

    target: {
      tabId
    },

    world:
      "MAIN",

    func: config => {
      window.__SIAPS_TOOL_CONFIG__ =
        config;
    },

    args: [
      configuracao
    ]

  });

  return chrome.scripting.executeScript({

    target: {
      tabId
    },

    world:
      "MAIN",

    files: [
      "main.js"
    ]

  });

}

chrome.runtime.onMessage.addListener(
  (mensagem, sender, responder) => {

    if (
      mensagem.type === "getCatalog"
    ) {

      executarNoSiaps(
        mensagem.tabId,
        {
          catalogo:
            true
        }
      )
        .then(
          () =>
            chrome.scripting.executeScript({

              target: {
                tabId:
                  mensagem.tabId
              },

              world:
                "MAIN",

              func: () => {
                const catalogo =
                  window.__SIAPS_TOOL_CATALOGO__;

                delete window.__SIAPS_TOOL_CONFIG__;

                return catalogo;
              }

            })
        )
        .then(
          resultado =>
            responder(
              {
                catalogo:
                  resultado[0]?.result ||
                  null
              }
            )
        )
        .catch(
          erro =>
            responder(
              {
                erro:
                  erro.message
              }
            )
        );

      return true;

    }

    if (
      mensagem.type === "start"
    ) {

      executarNoSiaps(
        mensagem.tabId,
        mensagem.configuracao
      )
        .then(
          () =>
            responder(
              {
                iniciado:
                  true
              }
            )
        )
        .catch(
          erro =>
            responder(
              {
                erro:
                  erro.message
              }
            )
        );

      return true;

    }

    if (
      mensagem.source === "SIAPS_TOOL" &&
      sender.tab
    ) {

      if (
        mensagem.type === "options"
      ) {

        chrome.storage.session.set(
          {
            siapsToolOptions:
              mensagem.opcoes
          }
        );

      }

      chrome.runtime.sendMessage(
        mensagem
      );

    }

  }
);

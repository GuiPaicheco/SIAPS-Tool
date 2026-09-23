(async () => {

  // ============================================================
  // Desenvolvido por: Guilherme Paicheco Ferreira (guilherme.paicheco@betim.mg.gov.br)
  // ============================================================
  // Aplicação consolidadora de planilhas do SIAPS
  // Público-Alvo: profissionais de saúde e gestores municipais
  // 31 INDICADORES (eESF, eSB, eMulti, eCR, eAPP, eSFR)
  // MUNICÍPIO: BETIM/MG IBGE: 310670
  // ============================================================
  // CONFIGURAÇÃO
  // ============================================================

  const API =
    "https://apisiaps.saude.gov.br/";

  const MUNICIPIO_IBGE =
    "310670";

  const MUNICIPIO =
    "BETIM";

  const UF =
    "MG";

  const COMPETENCIA =
    window.__SIAPS_TOOL_CONFIG__
      ?.competencia ||
    "202606";

  /*
   * Quantidade de registros solicitados por página.
   *
   * 100 reduz bastante o número de requisições.
   */
  const PAGE_SIZE = 100;

  /*
   * Quantidade de tentativas em caso de erro HTTP/rede.
   */
  const MAX_TENTATIVAS = 3;

  /*
   * Tempo entre tentativas.
   */
  const ESPERA_RETRY = 2000;

  /*
   * Tempo entre downloads.
   */
  const ESPERA_DOWNLOAD = 1500;


  // ============================================================
  // 31 INDICADORES
  // ============================================================

  const INDICADORES = [

    // ==========================================================
    // C — eSF / eAP
    // ==========================================================

    {
      grupo: "C",
      codigo: "C1",
      id: 110,
      nome:
        "Mais Acesso à Atenção Primária à Saúde"
    },

    {
      grupo: "C",
      codigo: "C2",
      id: 108,
      nome:
        "Desenvolvimento Infantil"
    },

    {
      grupo: "C",
      codigo: "C3",
      id: 107,
      nome:
        "Gestação e Puerpério"
    },

    {
      grupo: "C",
      codigo: "C4",
      id: 105,
      nome:
        "Diabetes"
    },

    {
      grupo: "C",
      codigo: "C5",
      id: 104,
      nome:
        "Hipertensão"
    },

    {
      grupo: "C",
      codigo: "C6",
      id: 106,
      nome:
        "Pessoa Idosa"
    },

    {
      grupo: "C",
      codigo: "C7",
      id: 109,
      nome:
        "Prevenção do Câncer"
    },


    // ==========================================================
    // O — eSB
    // ==========================================================

    {
      grupo: "O",
      codigo: "O1",
      id: 111,
      nome:
        "1ª Consulta Odontológica"
    },

    {
      grupo: "O",
      codigo: "O2",
      id: 112,
      nome:
        "Tratamento Odontológico Concluído"
    },

    {
      grupo: "O",
      codigo: "O3",
      id: 113,
      nome:
        "Taxa de Exodontia"
    },

    {
      grupo: "O",
      codigo: "O4",
      id: 114,
      nome:
        "Escovação Supervisionada"
    },

    {
      grupo: "O",
      codigo: "O5",
      id: 115,
      nome:
        "Procedimentos Odontológicos Preventivos"
    },

    {
      grupo: "O",
      codigo: "O6",
      id: 116,
      nome:
        "Tratamento Restaurador Atraumático"
    },


    // ==========================================================
    // M — eMulti
    // ==========================================================

    {
      grupo: "M",
      codigo: "M1",
      id: 117,
      nome:
        "Média de Atendimentos da eMulti por pessoa"
    },

    {
      grupo: "M",
      codigo: "M2",
      id: 118,
      nome:
        "Ações Interprofissionais realizadas pela eMulti na APS"
    },


    // ==========================================================
    // R — eCR
    // ==========================================================

    {
      grupo: "R",
      codigo: "R1",
      id: 121,
      nome:
        "Mais Acesso"
    },

    {
      grupo: "R",
      codigo: "R2",
      id: 122,
      nome:
        "Gestação"
    },

    {
      grupo: "R",
      codigo: "R3",
      id: 123,
      nome:
        "IST (HIV/Sífilis/Hepatites B e C)"
    },

    {
      grupo: "R",
      codigo: "R4",
      id: 124,
      nome:
        "Tuberculose"
    },


    // ==========================================================
    // A — eAPP
    // ==========================================================

    {
      grupo: "A",
      codigo: "A1",
      id: 125,
      nome:
        "Mais Acesso"
    },

    {
      grupo: "A",
      codigo: "A2",
      id: 126,
      nome:
        "Gestação"
    },

    {
      grupo: "A",
      codigo: "A3",
      id: 127,
      nome:
        "Diabetes e/ou Hipertensão"
    },

    {
      grupo: "A",
      codigo: "A4",
      id: 128,
      nome:
        "IST (HIV/Sífilis/Hepatites B e C)"
    },

    {
      grupo: "A",
      codigo: "A5",
      id: 129,
      nome:
        "Tuberculose"
    },

    {
      grupo: "A",
      codigo: "A6",
      id: 130,
      nome:
        "Prevenção do Câncer"
    },


    // ==========================================================
    // S — eSFR
    // ==========================================================

    {
      grupo: "S",
      codigo: "S1",
      id: 131,
      nome:
        "Mais acesso"
    },

    {
      grupo: "S",
      codigo: "S2",
      id: 132,
      nome:
        "Desenvolvimento Infantil"
    },

    {
      grupo: "S",
      codigo: "S3",
      id: 133,
      nome:
        "Cuidado na Gestação e Puerpério"
    },

    {
      grupo: "S",
      codigo: "S4",
      id: 134,
      nome:
        "Diabetes"
    },

    {
      grupo: "S",
      codigo: "S5",
      id: 135,
      nome:
        "Hipertensão"
    },

    {
      grupo: "S",
      codigo: "S6",
      id: 136,
      nome:
        "Prevenção do Câncer"
    }

  ];


  // ============================================================
  // CONFIGURAÇÃO DA INTERFACE
  // ============================================================

  const configuracaoInterface =
    window.__SIAPS_TOOL_CONFIG__ ||
    {};

  delete window.__SIAPS_TOOL_CONFIG__;

 const incluirMetadados =
   configuracaoInterface.incluirMetadados !==
   false;

  const modoDados =
    configuracaoInterface.modoDados ===
    "analitico"
      ? "analitico"
      : "completo";

  const indicadoresSelecionados =
    Array.isArray(
      configuracaoInterface.indicadores
    ) &&
    configuracaoInterface.indicadores.length
      ? INDICADORES.filter(
          indicador =>
            configuracaoInterface.indicadores.includes(
              indicador.codigo
            )
        )
      : INDICADORES;

  const unidadesSelecionadas =
    new Set(
      configuracaoInterface.unidades ||
      []
    );

  const equipesSelecionadas =
    new Set(
      configuracaoInterface.equipes ||
      []
    );

  const direcaoOrdenacao =
    configuracaoInterface.ordenacao?.direcao ===
    "asc"
      ? "asc"
      : "desc";

  const modoOperacao =
    configuracaoInterface.modo ||
    "exportar";

  function codigoExibicaoIndicador(
    indicador
  ) {

    const prefixos = {
      C: "eSF/eAP",
      O: "eSB",
      M: "eMulti",
      R: "eCR",
      A: "eAPP",
      S: "eSFR"
    };

    const numero =
      String(
        indicador.codigo ||
        ""
      ).replace(
        /^\D+/,
        ""
      );

    return `${prefixos[indicador.grupo] || indicador.grupo}${numero}`;

  }

  function publicarProgresso(
    mensagem,
    tipo = "info"
  ) {

    window.postMessage(
      {
        source:
          "SIAPS_TOOL",

        type:
          "progress",

        mensagem,

        nivel:
          tipo

      },
      "*"
    );

  }

  if (
    configuracaoInterface.catalogo
  ) {

    window.__SIAPS_TOOL_CATALOGO__ = {

      competencia:
        COMPETENCIA,

      indicadores:
        INDICADORES.map(
          indicador =>
            ({
              ...indicador,
              codigoExibicao:
                codigoExibicaoIndicador(
                  indicador
                )
            })
        )

    };

    return;

  }


  // ============================================================
  // SISTEMA DE LOG
  // ============================================================

  const inicioGeral =
    Date.now();

  let etapaAtual =
    "";

  function horario() {

    return new Date()
      .toLocaleTimeString(
        "pt-BR"
      );

  }

  function log(
    mensagem
  ) {

    console.log(
      `%c[${horario()}] ${mensagem}`,
      "color:#4caf50;"
    );

    publicarProgresso(
      mensagem,
      "success"
    );

  }

  function info(
    mensagem
  ) {

    console.log(
      `%c[${horario()}] ${mensagem}`,
      "color:#2196f3;"
    );

    publicarProgresso(
      mensagem
    );

  }

  function aviso(
    mensagem
  ) {

    console.warn(
      `[${horario()}] ${mensagem}`
    );

    publicarProgresso(
      mensagem,
      "warning"
    );

  }

  function erro(
    mensagem
  ) {

    console.error(
      `[${horario()}] ${mensagem}`
    );

    publicarProgresso(
      mensagem,
      "error"
    );

  }

  function separador() {

    console.log(
      "%c============================================================",
      "color:#777;"
    );

  }


  // ============================================================
  // INÍCIO
  // ============================================================

  publicarProgresso(
    "Motor SIAPS iniciado. Validando configuração..."
  );

  console.clear();

  separador();

  console.log(
    "%c🚀 SIAPS — EXPORTADOR COMPLETO",
    "font-size:22px;font-weight:bold;"
  );

  console.log(
    "%c31 indicadores • todos os tipos • todas as equipes",
    "font-size:13px;"
  );

  console.log(
    `Competência: ${COMPETENCIA}`
  );

  console.log(
    `Município: ${MUNICIPIO} (${MUNICIPIO_IBGE})`
  );

  console.log(
    `Início: ${horario()}`
  );

  separador();


  // ============================================================
  // VALIDAÇÃO
  // ============================================================

  if (
    INDICADORES.length !== 31
  ) {

    erro(
      `Lista possui ${INDICADORES.length}, mas deveria possuir 31.`
    );

    return;

  }

  log(
    "✅ Lista dos 31 indicadores validada."
  );


  // ============================================================
  // TOKEN
  // ============================================================

  const token =
    sessionStorage.getItem(
      "access_token"
    );

  if (!token) {

    erro(
      "❌ access_token não encontrado."
    );

    erro(
      "Abra o SIAPS normalmente e execute novamente."
    );

    return;

  }

  log(
    "🔑 Token de autenticação encontrado."
  );


  // ============================================================
  // EXCELJS
  // ============================================================

  let ExcelJS =
    null;

  try {

    let webpackRequire =
      null;

    window.webpackChunksiaps.push([
      [Date.now()],
      {},
      r => {
        webpackRequire = r;
      }
    ]);

    if (
      webpackRequire
    ) {

      ExcelJS =
        webpackRequire(2887);

    }

  } catch (
    e
  ) {

    erro(
      `Erro ao carregar ExcelJS: ${e.message}`
    );

    return;

  }

  if (!ExcelJS) {

    erro(
      "❌ ExcelJS não encontrado."
    );

    erro(
      "Abra primeiro a tela de Visão por Competência."
    );

    return;

  }

  log(
    "📗 ExcelJS carregado."
  );


  // ============================================================
  // REQUEST COM RETRY
  // ============================================================

  async function request(
    url,
    descricao = ""
  ) {

    let ultimoErro =
      null;

    for (
      let tentativa = 1;
      tentativa <= MAX_TENTATIVAS;
      tentativa++
    ) {

      try {

        const response =
          await fetch(
            url,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,

                Accept:
                  "application/json"
              }
            }
          );

        if (
          response.ok
        ) {

          return await response.json();

        }

        const texto =
          await response.text();

        ultimoErro =
          new Error(
            `HTTP ${response.status}: ${texto}`
          );

        aviso(
          `⚠️ ${descricao} — tentativa ${tentativa}/${MAX_TENTATIVAS} — HTTP ${response.status}`
        );

      } catch (
        e
      ) {

        ultimoErro =
          e;

        aviso(
          `⚠️ ${descricao} — tentativa ${tentativa}/${MAX_TENTATIVAS} — ${e.message}`
        );

      }

      if (
        tentativa <
        MAX_TENTATIVAS
      ) {

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              ESPERA_RETRY
            )
        );

      }

    }

    throw ultimoErro;

  }


  // ============================================================
  // TIPOS DE EQUIPE
  // ============================================================

  async function obterTiposEquipe(
    indicador
  ) {

    const url =
      API +
      "api/public/filtros/tipos-equipes" +
      `?indicadores=${indicador.id}`;

    try {

      const tipos =
        await request(
          url,
          `${indicador.codigo} — tipos`
        );

      if (
        Array.isArray(tipos) &&
        tipos.length
      ) {

        return tipos;

      }

    } catch (
      e
    ) {

      /*
       * O SIAPS já foi testado e sabemos que
       * estes dois indicadores apresentam HTTP 500
       * especificamente neste endpoint.
       */

      if (
        indicador.id === 118
      ) {

        aviso(
          "⚠️ M2 (118): endpoint de tipos retornou erro."
        );

        aviso(
          "↳ Usando fallback confirmado: eMulti."
        );

        return [
          "eMulti"
        ];

      }

      if (
        indicador.id === 128
      ) {

        aviso(
          "⚠️ A4 (128): endpoint de tipos retornou erro."
        );

        aviso(
          "↳ Usando fallback confirmado: eAPP."
        );

        return [
          "eAPP"
        ];

      }

      throw e;

    }

    throw new Error(
      `Nenhum tipo de equipe retornado para ${indicador.codigo}.`
    );

  }


  // ============================================================
  // METADATA DAS VARIÁVEIS
  // ============================================================

  async function obterVariaveis(
    indicador
  ) {

    const url =
      API +
      "api/public/filtros/variaveis" +
      `?indicador=${indicador.id}`;

    const variaveis =
      await request(
        url,
        `${indicador.codigo} — variáveis`
      );

    if (
      !Array.isArray(
        variaveis
      )
    ) {

      throw new Error(
        `Metadata inválido para ${indicador.codigo}.`
      );

    }

    variaveis.sort(
      (a, b) =>
        (a.nuIndice ?? 0) -
        (b.nuIndice ?? 0)
    );

    return variaveis;

  }


  // ============================================================
  // ETAPA 1 — DIAGNÓSTICO
  // ============================================================

  etapaAtual =
    "Diagnóstico";

  separador();

  console.log(
    "%c🔎 ETAPA 1/4 — DIAGNÓSTICO DOS INDICADORES",
    "font-size:18px;font-weight:bold;"
  );

  console.log(
    "Consultando os tipos de equipe disponíveis..."
  );

  const diagnostico =
    [];

  for (
    let i = 0;
    i < indicadoresSelecionados.length;
    i++
  ) {

    const indicador =
      indicadoresSelecionados[i];

    try {

      const tipos =
        await obterTiposEquipe(
          indicador
        );

      diagnostico.push({

        codigo:
          indicador.codigo,

        id:
          indicador.id,

        tipos:
          tipos.join(", "),

        status:
          "OK"

      });

      log(
        `[${i + 1}/${indicadoresSelecionados.length}] ${indicador.codigo} → ${tipos.join(", ")}`
      );

    } catch (
      e
    ) {

      diagnostico.push({

        codigo:
          indicador.codigo,

        id:
          indicador.id,

        tipos:
          "",

        status:
          "ERRO",

        erro:
          e.message

      });

      erro(
        `[${i + 1}/${indicadoresSelecionados.length}] ${indicador.codigo} → ${e.message}`
      );

    }

  }

  console.table(
    diagnostico
  );

  const errosDiagnostico =
    diagnostico.filter(
      x =>
        x.status !==
        "OK"
    );

  if (
    errosDiagnostico.length
  ) {

    erro(
      `Diagnóstico encontrou ${errosDiagnostico.length} problema(s).`
    );

    console.table(
      errosDiagnostico
    );

    erro(
      "⛔ Exportação interrompida antes dos downloads."
    );

    return;

  }

  log(
    `✅ Diagnóstico concluído: ${indicadoresSelecionados.length}/${indicadoresSelecionados.length} indicadores.`
  );


  // ============================================================
  // ETAPA 2 — METADATA
  // ============================================================

  etapaAtual =
    "Metadata";

  separador();

  console.log(
    "%c🧩 ETAPA 2/4 — CARREGANDO METADATA DAS VARIÁVEIS",
    "font-size:18px;font-weight:bold;"
  );

  const metadados =
    new Map();

  for (
    let i = 0;
    i < indicadoresSelecionados.length;
    i++
  ) {

    const indicador =
      indicadoresSelecionados[i];

    try {

      const variaveis =
        await obterVariaveis(
          indicador
        );

      if (
        !variaveis.length
      ) {

        throw new Error(
          "Nenhuma variável encontrada."
        );

      }

      metadados.set(
        indicador.id,
        variaveis
      );

      log(
        `[${i + 1}/${indicadoresSelecionados.length}] ${indicador.codigo} → ${variaveis.length} variáveis`
      );

    } catch (
      e
    ) {

      erro(
        `${indicador.codigo} — metadata: ${e.message}`
      );

      erro(
        "⛔ Exportação interrompida."
      );

      return;

    }

  }

  log(
    "✅ Metadata dos 31 indicadores carregado."
  );


  // ============================================================
  // BUSCAR TODAS AS EQUIPES
  // ============================================================

  async function obterTodasEquipes(
    indicador,
    tipos
  ) {

    const todas =
      [];

    for (
      let t = 0;
      t < tipos.length;
      t++
    ) {

      const tipo =
        tipos[t];

      info(
        `👥 ${indicador.codigo} — tipo ${tipo} (${t + 1}/${tipos.length})`
      );

      let pagina =
        0;

      let totalEsperado =
        null;

      let totalRecebido =
        0;

      while (
        true
      ) {

        const params =
          new URLSearchParams();

        params.set(
          "page",
          pagina
        );

        params.set(
          "size",
          PAGE_SIZE
        );

        params.set(
          "search",
          ""
        );

        params.set(
          "sort",
          "string"
        );

        params.append(
          "competencias",
          COMPETENCIA
        );

        params.set(
          "coMunicipioIbge",
          MUNICIPIO_IBGE
        );

        /*
         * Um tipo por requisição.
         */

        params.append(
          "sgEquipes",
          tipo
        );

        params.append(
          "indicadores",
          indicador.id
        );

        /*
         * NÃO usar:
         *
         * stEquipeHomologada=S
         *
         * porque isso excluiria equipes.
         */

        const url =
          API +
          "componente/qualidade/visao-competencia?" +
          params.toString();

        const resposta =
          await request(
            url,
            `${indicador.codigo}/${tipo}/página ${pagina + 1}`
          );

        const equipes =
          resposta
            ?.content?.[0]
            ?.equipes || [];

        if (
          totalEsperado === null
        ) {

          totalEsperado =
            resposta.total ??
            0;

        }

        totalRecebido +=
          equipes.length;

        todas.push(
          ...equipes
        );

        const totalPaginas =
          resposta.totalPages ??
          "?";

        console.log(
          `%c      📄 ${indicador.codigo} | ${tipo} | página ${pagina + 1}/${totalPaginas} | +${equipes.length} | acumulado ${totalRecebido}/${totalEsperado}`,
          "color:#03a9f4;"
        );

        if (
          !resposta.hasNext
        ) {

          break;

        }

        pagina++;

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              150
            )
        );

      }

      log(
        `      ✅ ${tipo} finalizado: ${totalRecebido}/${totalEsperado} equipes`
      );

    }

    /*
     * Deduplicação.
     */

    const mapa =
      new Map();

    for (
      const equipe
      of todas
    ) {

      const chave =
        `${equipe.sgEquipe ?? ""}|${equipe.coEquipe ?? ""}`;

      if (
        !mapa.has(chave)
      ) {

        mapa.set(
          chave,
          equipe
        );

      }

    }

    const resultado =
      [...mapa.values()];

    if (
      resultado.length !==
      todas.length
    ) {

      aviso(
        `      🔄 ${todas.length - resultado.length} duplicidade(s) removida(s).`
      );

    }

    return resultado;

  }


  // ============================================================
  // OPÇÕES E FILTROS DA INTERFACE
  // ============================================================

  function publicarOpcoes(
    equipes
  ) {

    const opcoes =
      window.__SIAPS_TOOL_OPCOES__ ||
      {
        unidades: [],
        equipes: []
      };

    const unidades =
      new Map(
        opcoes.unidades.map(
          unidade =>
            [
              unidade.valor,
              unidade
            ]
        )
      );

    const equipesDisponiveis =
      new Map(
        opcoes.equipes.map(
          equipe =>
            [
              equipe.valor,
              equipe
            ]
        )
      );

    for (
      const equipe
      of equipes
    ) {

      const cnes =
        String(
          equipe.coCnes ??
          ""
        );

      const codigoEquipe =
        String(
          equipe.coEquipe ??
          ""
        );

      if (
        cnes
      ) {

        unidades.set(
          cnes,
          {
            valor: cnes,
            rotulo:
              `${cnes} - ${equipe.noUnidade ?? "Sem estabelecimento"}`
          }
        );

      }

      if (
        codigoEquipe
      ) {

        equipesDisponiveis.set(
          codigoEquipe,
          {
            valor: codigoEquipe,
            rotulo:
              equipe.noEquipe ??
              "Sem equipe",
            unidade: cnes,
            ine: codigoEquipe,
            tipo:
              equipe.sgEquipe ??
              ""
          }
        );

      }

    }

    const resultado = {

      unidades:
        [...unidades.values()]
          .sort(
            (a, b) =>
              a.rotulo.localeCompare(
                b.rotulo,
                "pt-BR"
              )
          ),

      equipes:
        [...equipesDisponiveis.values()]
          .sort(
            (a, b) =>
              a.rotulo.localeCompare(
                b.rotulo,
                "pt-BR"
              )
          )

    };

    window.__SIAPS_TOOL_OPCOES__ =
      resultado;

    window.postMessage(
      {
        source:
          "SIAPS_TOOL",

        type:
          "options",

        opcoes:
          resultado

      },
      "*"
    );

  }

  function filtrarEquipes(
    equipes,
    filtros = {}
  ) {

    const unidades =
      filtros.unidades
        ? new Set(
            filtros.unidades
          )
        : unidadesSelecionadas;

    const equipesFiltro =
      filtros.equipes
        ? new Set(
            filtros.equipes
          )
        : equipesSelecionadas;

    return equipes.filter(
      equipe => {

        const cnes =
          String(
            equipe.coCnes ??
            ""
          );

        const codigoEquipe =
          String(
            equipe.coEquipe ??
            ""
          );

        return (
          (!unidades.size ||
            unidades.has(cnes)) &&
          (!equipesFiltro.size ||
            equipesFiltro.has(codigoEquipe))
        );

      }
    );

  }


  // ============================================================
  // FORMATAR COMPETÊNCIA
  // ============================================================

  function formatarCompetencia(
    competencia
  ) {

    const valor =
      String(
        competencia ??
        ""
      ).trim();

    const meses = [

      "JANEIRO",
      "FEVEREIRO",
      "MARÇO",
      "ABRIL",
      "MAIO",
      "JUNHO",
      "JULHO",
      "AGOSTO",
      "SETEMBRO",
      "OUTUBRO",
      "NOVEMBRO",
      "DEZEMBRO"

    ];

    if (
      !/^\d{6}$/.test(
        valor
      )
    ) {

      return valor;

    }

    const mes =
      Number(
        valor.slice(4, 6)
      );

    if (
      mes < 1 ||
      mes > 12
    ) {

      return valor;

    }

    return `${meses[mes - 1]} de ${valor.slice(0, 4)}`;

  }


  // ============================================================
  // CONSTRUIR COLUNAS
  // ============================================================

 function construirColunas(
    variaveis,
    modo = modoDados
 ) {

    const colunas = [

      "COMPETÊNCIA",

      "INDICADOR",

      "CNES",

      "ESTABELECIMENTO",

      "TIPO DO ESTABELECIMENTO",

      "INE",

      "NOME DA EQUIPE",

     "SIGLA DA EQUIPE"

   ];

    if (
      modo === "analitico"
    ) {

      colunas.push(
        "PONTUAÇÃO"
      );

      colunas.push(
        "CLASSIFICAÇÃO"
      );

      return colunas;

    }

   const ordenadas =
      [...variaveis]
        .filter(
          v =>
            String(
              v.noVariavel ??
              ""
            )
              .trim()
              .toUpperCase() !==
            "CLASSIFICAÇÃO"
        )
        .sort(
          (a, b) =>
            (a.nuIndice ?? 0) -
            (b.nuIndice ?? 0)
        );

    for (
      const variavel
      of ordenadas
    ) {

      const descricao =
        variavel.descricao ||
        variavel.noVariavel;

      if (
        !descricao
      ) {

        continue;

      }

      if (
        String(
          descricao
        )
          .trim()
          .toUpperCase() ===
        "CLASSIFICAÇÃO"
      ) {

        continue;

      }

      if (
        descricao
          .toUpperCase() ===
        "NUMERADOR/DENOMINADOR"
      ) {

        colunas.push(
          "PONTUAÇÃO"
        );

      } else {

        colunas.push(
          descricao.toUpperCase()
        );

      }

    }

    colunas.push(
      "CLASSIFICAÇÃO"
    );

    return colunas;

  }


  // ============================================================
  // CONSTRUIR DADOS
  // ============================================================

 function construirDados(
   equipes,
   variaveis,
   indicadorId,
   indicadorConfigurado,
   direcao = direcaoOrdenacao,
    modo = modoDados,
    competencia = COMPETENCIA
 ) {

    const dados =
      [];

    const variaveisParametros =
      (modo === "analitico"
        ? []
        : [...variaveis])
        .filter(
          v =>
            v.noParametro &&
            ![
              "NUMERADOR",
              "DENOMINADOR",
              "PONTUACAO",
              "CLASSIFICACAO"
            ].includes(
              v.noParametro
            )
        )
        .sort(
          (a, b) =>
            (a.nuIndice ?? 0) -
            (b.nuIndice ?? 0)
        );

    for (
      const equipe
      of equipes
    ) {

      const linha = [

        formatarCompetencia(
          competencia
        ),

        `${codigoExibicaoIndicador(indicadorConfigurado)} - ${indicadorConfigurado.nome}`,

        equipe.coCnes ??
          "",

        equipe.noUnidade ??
          "",

        equipe.dsTipoUnidade ??
          "",

        equipe.coEquipe ??
          "",

        equipe.noEquipe ??
          "",

        equipe.sgEquipe ??
          ""

      ];

      /*
       * Encontrar o indicador correspondente.
       */

      const indicador =
        equipe
          ?.indicadores
          ?.find(
            x =>
              Number(
                x.coTipoIndicador ??
                x.coIndicador ??
                indicadorId
              ) ===
              Number(indicadorId)
          )
          ??
        equipe
          ?.indicadores
          ?.[0];

      const vars =
        indicador
          ?.variaveis ||
        {};

      // --------------------------------------------------------
      // C7 — 109
      // --------------------------------------------------------

      if (
        indicadorId === 109
      ) {

        for (
          const variavel
          of variaveisParametros
        ) {

          linha.push(
            vars[
              variavel.noParametro
            ] ?? null
          );

        }

        linha.push(
          indicador
            ?.scoreFormatado ??
          null
        );

        linha.push(
          indicador
            ?.scoreClassificacao ??
          null
        );

      }

      // --------------------------------------------------------
      // DEMAIS INDICADORES
      // --------------------------------------------------------

      else {

        for (
          const variavel
          of variaveisParametros
        ) {

          linha.push(
            vars[
              variavel.noParametro
            ] ?? null
          );

        }

        if (
          modo !== "analitico"
        ) {

          linha.push(
            indicador
              ?.numerador ??
            null
          );

          linha.push(
            indicador
              ?.denominador ??
            null
          );

        }

        linha.push(
          indicador
            ?.scoreFormatado ??
          null
        );

        linha.push(
          indicador
            ?.scoreClassificacao ??
          null
        );

      }

      dados.push({

        linha,

        score:
          indicador
            ?.score

      });

    }

    return dados
      .sort(
        (a, b) => {

          const pontuacaoA =
            Number(
              a.score
            );

          const pontuacaoB =
            Number(
              b.score
            );

          const possuiPontuacaoA =
            a.score != null &&
            String(
              a.score
            ).trim() !==
            "" &&
            Number.isFinite(
              pontuacaoA
            );

          const possuiPontuacaoB =
            b.score != null &&
            String(
              b.score
            ).trim() !==
            "" &&
            Number.isFinite(
              pontuacaoB
            );

          if (
            !possuiPontuacaoA &&
            !possuiPontuacaoB
          ) {

            return 0;

          }

          if (
            !possuiPontuacaoA
          ) {

            return 1;

          }

          if (
            !possuiPontuacaoB
          ) {

            return -1;

          }

          return direcao === "asc"
            ? pontuacaoA - pontuacaoB
            : pontuacaoB - pontuacaoA;

        }
      )
      .map(
        item =>
          item.linha
      );

  }

  function ordenarDadosPorColuna(
    dados,
    colunas,
    ordenacao = {}
  ) {

    const campo =
      ordenacao.campo;

    const indice =
      colunas.indexOf(campo);

    const campoPontuacao =
      colunas[colunas.length - 2];

   /*
     * PONTUACAO ja e ordenada em construirDados com o score bruto
     * retornado pelo SIAPS. Nunca use scoreFormatado para comparar.
     */
    if (
      !campo ||
      campo === "score" ||
      campo === campoPontuacao
    ) {

      return dados;

    }

   if (
     indice < 0
    ) {

      return dados;

    }

    const direcao =
      ordenacao.direcao === "asc"
        ? 1
        : -1;

    const vazio =
      valor =>
        valor == null ||
        String(valor).trim() === "";

    const numero =
      valor => {

        if (
          typeof valor === "number" &&
          Number.isFinite(valor)
        ) {

          return valor;

        }

        const texto =
          String(valor).trim();

        if (
          !/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(texto)
        ) {

          return null;

        }

        const normalizado =
          texto.includes(",")
            ? texto.replace(/\./g, "").replace(",", ".")
            : texto;

        const resultado =
          Number(normalizado);

        return Number.isFinite(resultado)
          ? resultado
          : null;

      };

    return [...dados].sort(
      (linhaA, linhaB) => {

        const valorA = linhaA[indice];
        const valorB = linhaB[indice];

        /* Valores ausentes ou invalidos ficam sempre no fim. */
        if (vazio(valorA) && vazio(valorB)) return 0;
        if (vazio(valorA)) return 1;
        if (vazio(valorB)) return -1;

        const numeroA = numero(valorA);
        const numeroB = numero(valorB);

        if (numeroA != null && numeroB != null) {

          return direcao * (numeroA - numeroB);

        }

        return direcao * String(valorA).localeCompare(
          String(valorB),
          "pt-BR",
          { numeric: true, sensitivity: "base" }
        );

      }
    );

  }


 // ============================================================
  // CABEÇALHO
  // ============================================================

  function cabecalhoInstitucional(
    titulo
  ) {

    return [

      [
        "Ministério da Saúde - MS"
      ],

      [
        "Secretaria de Atenção Primária à Saúde - Saps"
      ],

      [
        "Sistema de Informação para a Atenção Primária à Saúde – Siaps"
      ],

      [
        `Dado gerado em: ${new Date().toLocaleString("pt-BR")}`
      ],

      [
        titulo
      ],

      [
        "Dado Preliminar"
      ],

      [
        ""
      ]

    ];

  }


  // ============================================================
  // BLOCO DEMOGRÁFICO
  // ============================================================

  function blocoDemografico() {

    return [

      [
        "Dados sociodemográficos:"
      ],

      [
        `UF: ${UF}`
      ],

      [
        `Município: ${MUNICIPIO_IBGE} / ${MUNICIPIO}`
      ],

      [
        ""
      ]

    ];

  }


  // ============================================================
  // RODAPÉ
  // ============================================================

  function rodape() {

    return [

      [
        ""
      ],

      [
        "Fonte: Sistema de Informação para a Atenção Primária à Saúde - SIAPS"
      ]

    ];

  }


  // ============================================================
  // FORMATAÇÃO
  // ============================================================

  function formatarWorksheet(
    worksheet
  ) {

    worksheet.eachRow(
      row => {

        row.eachCell(
          cell => {

            cell.alignment = {

              vertical:
                "middle",

              wrapText:
                true

            };

            cell.font = {

              ...cell.font,

              name:
                "Arial",

              size:
                12

            };

          }
        );

      }
    );

    worksheet.columns.forEach(
      column => {

        let maior =
          0;

        column.eachCell(
          {
            includeEmpty:
              false
          },
          cell => {

            const valor =
              cell.value == null
                ? ""
                : String(
                    cell.value
                  );

            maior =
              Math.max(
                maior,
                valor.length
              );

          }
        );

        column.width =
          Math.min(
            Math.max(
              maior + 2,
              12
            ),
            60
          );

      }
    );

    const coresClassificacao = {

      "ÓTIMO":
        "FFA5A5FF",

      "BOM":
        "FF5FE15F",

      "SUFICIENTE":
        "FFFFE121",

      "REGULAR":
        "FFC46500"

    };

    let colunaClassificacao =
      null;

    let linhaCabecalho =
      null;

    worksheet.eachRow(
      (row, numeroLinha) => {

        row.eachCell(
          (cell, numeroColuna) => {

            if (
              cell.value ===
              "CLASSIFICAÇÃO"
            ) {

              colunaClassificacao =
                numeroColuna;

              linhaCabecalho =
                numeroLinha;

            }

          }
        );

      }
    );

    if (
      colunaClassificacao &&
      linhaCabecalho
    ) {

      worksheet
        .getRow(
          linhaCabecalho
        )
        .eachCell(
          cell => {

            cell.font = {

              ...cell.font,

              name:
                "Arial",

              size:
                12,

              bold:
                true

            };

          }
        );

      worksheet.eachRow(
        (row, numeroLinha) => {

          if (
            numeroLinha <=
            linhaCabecalho
          ) {

            return;

          }

          const cell =
            row.getCell(
              colunaClassificacao
            );

          const classificacao =
            String(
              cell.value ??
              ""
            )
              .trim()
              .toUpperCase();

          const cor =
            coresClassificacao[
              classificacao
            ];

          if (
            cor
          ) {

            cell.fill = {

              type:
                "pattern",

              pattern:
                "solid",

              fgColor: {

                argb:
                  cor

              }

            };

          }

        }
      );

    }

  }


  // ============================================================
  // NOME SEGURO
  // ============================================================

  function nomeSeguro(
    texto
  ) {

    return texto
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-zA-Z0-9]+/g,
        "_"
      )
      .replace(
        /^_+|_+$/g,
        "");

  }


  // ============================================================
  // GERAR XLSX
  // ============================================================

  async function exportarExcel(
    indicador,
    tipos,
    variaveis,
    equipes,
    opcoes = {}
  ) {

    info(
      `      📗 Criando XLSX de ${indicador.codigo}...`
    );

    const workbook =
      new ExcelJS.Workbook();

   const worksheet =
     workbook.addWorksheet(
       "Relatório - SIAPS"
     );

   const modoDadosExportacao =
     opcoes.modoDados === "analitico"
       ? "analitico"
       : modoDados;

    const competenciaExportacao =
      opcoes.competencia ||
      COMPETENCIA;

   const colunas =
     construirColunas(
        variaveis,
        modoDadosExportacao
     );

    let dados =
     construirDados(
        equipes,
        variaveis,
        indicador.id,
       indicador,
       opcoes.ordenacao?.direcao ||
         direcaoOrdenacao,
        modoDadosExportacao,
        competenciaExportacao
     );

    dados =
      ordenarDadosPorColuna(
        dados,
        colunas,
        opcoes.ordenacao
      );

   const quantidadeClassificacoes =
      colunas.filter(
        coluna =>
          coluna ===
          "CLASSIFICAÇÃO"
      ).length;

    const possuiColunasDuplicadas =
      new Set(
        colunas
      ).size !==
      colunas.length;

    if (
      possuiColunasDuplicadas ||
      quantidadeClassificacoes !== 1 ||
      colunas[
        colunas.length - 1
      ] !== "CLASSIFICAÇÃO"
    ) {

      throw new Error(
        "A coluna CLASSIFICAÇÃO deve existir uma única vez e ser a última coluna."
      );

    }

    /*
     * Verificação fundamental:
     *
     * cada linha precisa possuir a mesma
     * quantidade de colunas do cabeçalho.
     */

    const problemas =
      dados.filter(
        linha =>
          linha.length !==
          colunas.length
      );

    if (
      problemas.length
    ) {

      throw new Error(
        `${problemas.length} linha(s) possuem quantidade de colunas incompatível.`
      );

    }

    info(
      `      📊 ${equipes.length} equipes × ${colunas.length} colunas`
    );

    const linhas =
      opcoes.incluirMetadados ??
      incluirMetadados
        ? [

            ...cabecalhoInstitucional(
              indicador.nome
            ),

            ...blocoDemografico(),

            [
              "Filtro:"
            ],

            [
              `Competência: ${competenciaExportacao}`
            ],

            [
              `Tipos de Equipe: ${tipos.join(", ")}`
            ],

            [
              ""
            ],

            colunas,

            ...dados,

            ...rodape()

          ]
        : [

            colunas,

            ...dados

          ];

    for (
      const linha
      of linhas
    ) {

      worksheet.addRow(
        linha
      );

    }

    if (
      worksheet.columnCount !==
      colunas.length
    ) {

      throw new Error(
        "O worksheet possui colunas além da estrutura da tabela."
      );

    }

    formatarWorksheet(
      worksheet
    );

    info(
      `      ⚙️ Gerando arquivo XLSX...`
    );

    const buffer =
      await workbook.xlsx.writeBuffer();

    const blob =
      new Blob(
        [buffer],
        {
          type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
      );

   const arquivo =
      `${nomeSeguro(codigoExibicaoIndicador(indicador))}_${nomeSeguro(indicador.nome)}_${nomeSeguro(formatarCompetencia(competenciaExportacao))}.xlsx`;

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      url;

    link.download =
      arquivo;

    document.body.appendChild(
      link
    );

    info(
      `      ⬇️ Iniciando download: ${arquivo}`
    );

    link.click();

    link.remove();

    setTimeout(
      () =>
        URL.revokeObjectURL(
          url
        ),
      10000
    );

    return arquivo;

  }


  window.__SIAPS_TOOL_PREVER_EXPORTACAO__ =
    opcoes => {
      const consolidacao = window.__SIAPS_TOOL_CONSOLIDACAO__;
      if (!consolidacao) {
        throw new Error("A consolidação não está disponível nesta aba. Gere uma nova consolidação.");
      }
      const relatorios = consolidacao.competencias
        ? consolidacao.competencias.flatMap(competencia => competencia.relatorios)
        : consolidacao.relatorios || [];
      const relatoriosFiltrados = relatorios.map(relatorio => ({
        relatorio,
        equipes: filtrarEquipes(relatorio.equipes, opcoes)
      })).filter(item => item.equipes.length);
      return {
        arquivos: relatoriosFiltrados.length,
        registros: relatoriosFiltrados.reduce((total, item) => total + item.equipes.length, 0)
      };
    };

  window.__SIAPS_TOOL_EXPORTAR_CONSOLIDACAO__ =
    async opcoes => {

      const consolidacao =
        window.__SIAPS_TOOL_CONSOLIDACAO__;

      if (
        !consolidacao ||
        !Array.isArray(
          consolidacao.competencias ||
          consolidacao.relatorios
        )
      ) {

        throw new Error(
          "A consolidação não está disponível nesta aba. Gere uma nova consolidação."
        );

      }

     const arquivos =
       [];

      const relatorios =
        consolidacao.competencias
          ? consolidacao.competencias.flatMap(
              competencia =>
                competencia.relatorios
            )
          : consolidacao.relatorios;

     for (
       const relatorio
        of relatorios
      ) {

       const equipes =
         filtrarEquipes(
           relatorio.equipes,
            opcoes
         );

        if (
          !equipes.length
        ) {

          continue;

        }

        arquivos.push(
          await exportarExcel(
            relatorio.indicador,
            relatorio.tipos,
           relatorio.variaveis,
           equipes,
            {
              ...opcoes,
              competencia:
                relatorio.competencia ||
                consolidacao.competencia
            }
         )
        );

      }

      if (
        !arquivos.length
      ) {

        throw new Error(
          "Nenhum registro corresponde aos filtros selecionados."
        );

      }

      publicarProgresso(
        "✓ Planilha gerada com sucesso.",
        "success"
      );

      return {
        arquivos:
          arquivos.length
      };

    };


  // ============================================================
  // ETAPA 3 — COLETA E EXPORTAÇÃO
  // ============================================================

  etapaAtual =
    "Coleta e exportação";

  separador();

  console.log(
    "%c📦 ETAPA 3/4 — COLETA DAS EQUIPES E EXPORTAÇÃO",
    "font-size:18px;font-weight:bold;"
  );

  console.log(
    "⚠️ Não feche esta aba enquanto o processo estiver executando."
  );

  console.log(
    "⚠️ Aguarde até aparecer o resumo FINAL."
  );

  const resultados =
    [];

 const relatoriosConsolidados =
   [];

  const camposOrdenacao =
    new Set();

  let camposOrdenacaoComuns =
    null;

  const camposOrdenacaoAnaliticos =
    construirColunas(
      [],
      "analitico"
    );

 let campoPadraoOrdenacao =
    "score";

 for (
    let i = 0;
    i < indicadoresSelecionados.length;
    i++
  ) {

    const indicador =
      indicadoresSelecionados[i];

    const inicioIndicador =
      Date.now();

    const diagnosticoItem =
      diagnostico.find(
        x =>
          x.id ===
          indicador.id
      );

    const tipos =
      diagnosticoItem
        .tipos
        .split(",")
        .map(
          x =>
            x.trim()
        )
        .filter(Boolean);

    separador();

    console.log(
      `%c📌 [${i + 1}/${indicadoresSelecionados.length}] ${indicador.codigo} — ${indicador.nome}`,
      "font-size:16px;font-weight:bold;"
    );

    info(
      `Tipos: ${tipos.join(", ")}`
    );

    try {

      // --------------------------------------------------------
      // EQUIPES
      // --------------------------------------------------------

      info(
        "🔍 Buscando equipes..."
      );

      const equipes =
        await obterTodasEquipes(
          indicador,
          tipos
        );

      if (
        !equipes.length
      ) {

        throw new Error(
          "Nenhuma equipe foi retornada pela API."
        );

      }

      log(
        `      ✅ Coleta concluída: ${equipes.length} equipes`
      );

      publicarOpcoes(
        equipes
      );

      const equipesFiltradas =
        filtrarEquipes(
          equipes
        );

      if (
        !equipesFiltradas.length
      ) {

        throw new Error(
          "Nenhuma equipe corresponde aos filtros selecionados."
        );

      }


      // --------------------------------------------------------
      // METADATA
      // --------------------------------------------------------

      const variaveis =
        metadados.get(
          indicador.id
        );

      if (
        !variaveis
      ) {

        throw new Error(
          "Metadata não encontrado."
        );

      }

      const colunasOrdenacao =
        construirColunas(
        variaveis
        );

      colunasOrdenacao.forEach(
        coluna =>
          camposOrdenacao.add(coluna)
      );

      const camposDesteIndicador =
        new Set(colunasOrdenacao);
      camposOrdenacaoComuns =
        camposOrdenacaoComuns === null
          ? [...colunasOrdenacao]
          : camposOrdenacaoComuns.filter(
              coluna => camposDesteIndicador.has(coluna)
            );

      campoPadraoOrdenacao =
        colunasOrdenacao[
          colunasOrdenacao.length - 2
        ] ||
        campoPadraoOrdenacao;


     // --------------------------------------------------------
      // XLSX
      // --------------------------------------------------------

      let arquivo =
        null;

      if (
        modoOperacao ===
        "consolidar"
      ) {

        relatoriosConsolidados.push({
          competencia: COMPETENCIA,
          indicador,
          tipos,
          variaveis,
          equipes:
            equipesFiltradas
        });

      } else {

        arquivo =
          await exportarExcel(
            indicador,
            tipos,
            variaveis,
            equipesFiltradas
          );

      }

      const segundos =
        (
          (Date.now() -
            inicioIndicador) /
          1000
        ).toFixed(1);

      resultados.push({

        ordem:
          i + 1,

        codigo:
          indicador.codigo,

        id:
          indicador.id,

        tipos:
          tipos.join(", "),

        equipes:
          equipesFiltradas.length,

        variaveis:
          variaveis.length,

        arquivo,

        tempo_s:
          Number(segundos),

        status:
          "OK"

      });

      log(
        `✅ ${indicador.codigo} FINALIZADO em ${segundos}s`
      );

      if (
        arquivo
      ) {

        log(
          `   📁 ${arquivo}`
        );

      }

      const concluidos =
        resultados.filter(
          x =>
            x.status ===
            "OK"
        ).length;

      info(
        `📈 PROGRESSO GERAL: ${concluidos}/${indicadoresSelecionados.length} indicadores concluídos`
      );

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            ESPERA_DOWNLOAD
          )
      );

    } catch (
      e
    ) {

      const segundos =
        (
          (Date.now() -
            inicioIndicador) /
          1000
        ).toFixed(1);

      erro(
        `❌ ${indicador.codigo} FALHOU após ${segundos}s`
      );

      erro(
        `   Motivo: ${e.message}`
      );

      resultados.push({

        ordem:
          i + 1,

        codigo:
          indicador.codigo,

        id:
          indicador.id,

        tipos:
          tipos.join(", "),

        status:
          "ERRO",

        erro:
          e.message,

        tempo_s:
          Number(segundos)

      });

      /*
       * IMPORTANTE:
       *
       * Um indicador com problema não interrompe
       * os outros 30.
       */

      aviso(
        `⚠️ Continuando para o próximo indicador...`
      );

    }

  }


  if (
    modoOperacao ===
    "consolidar"
  ) {

    const anteriores =
      Array.isArray(
        window.__SIAPS_TOOL_CONSOLIDACAO__
          ?.competencias
      )
        ? window.__SIAPS_TOOL_CONSOLIDACAO__
            .competencias
            .filter(
              item =>
                item.competencia !==
                COMPETENCIA
            )
        : [];

    const competenciasConsolidadas =
      [
        ...anteriores,
        {
          competencia: COMPETENCIA,
          relatorios:
            relatoriosConsolidados
        }
      ];

    const todosRelatorios =
      competenciasConsolidadas.flatMap(
        item =>
          item.relatorios
      );

    const registros =
      todosRelatorios.reduce(
        (total, relatorio) =>
          total + relatorio.equipes.length,
        0
      );

    window.__SIAPS_TOOL_CONSOLIDACAO__ = {
      competencia: COMPETENCIA,
      competencias:
        competenciasConsolidadas,
      indicadores: indicadoresSelecionados.map(indicador => indicador.codigo),
      relatorios: todosRelatorios
    };

    window.postMessage({
      source: "SIAPS_TOOL",
      type: "consolidation",
      resumo: {
       competencia: COMPETENCIA,
        competencias: competenciasConsolidadas.map(item => item.competencia),
        indicadores: todosRelatorios.length,
       indicadoresCodigos: indicadoresSelecionados.map(indicador => indicador.codigo),
        camposOrdenacao: camposOrdenacaoComuns || [...camposOrdenacao],
        camposOrdenacaoAnaliticos,
       campoPadraoOrdenacao,
        unidades: window.__SIAPS_TOOL_OPCOES__?.unidades.length || 0,
        equipes: window.__SIAPS_TOOL_OPCOES__?.equipes.length || 0,
        registros
      }
    }, "*");

    publicarProgresso(
      "✓ Consolidação concluída. Ajuste os filtros e baixe a planilha.",
      "success"
    );

  }

  // ============================================================
  // ETAPA 4 — CONFERÊNCIA FINAL
  // ============================================================

  etapaAtual =
    "Conferência final";

  separador();

  console.log(
    "%c📊 ETAPA 4/4 — CONFERÊNCIA FINAL",
    "font-size:18px;font-weight:bold;"
  );

  const sucesso =
    resultados.filter(
      x =>
        x.status ===
        "OK"
    );

  const falhas =
    resultados.filter(
      x =>
        x.status ===
        "ERRO"
    );

  console.log("");

  console.log(
    `%c📋 RESULTADO DOS ${indicadoresSelecionados.length} INDICADORES`,
    "font-size:16px;font-weight:bold;"
  );

  console.table(
    resultados
  );

  console.log("");

  console.log(
    `%c✅ SUCESSO: ${sucesso.length}/${indicadoresSelecionados.length}`,
    "font-size:16px;font-weight:bold;color:green;"
  );

  console.log(
    `%c❌ ERROS: ${falhas.length}/${indicadoresSelecionados.length}`,
    "font-size:16px;font-weight:bold;color:red;"
  );


  // ============================================================
  // LISTA DE SUCESSOS
  // ============================================================

  if (
    sucesso.length
  ) {

    console.log("");

    console.log(
      "%c📁 ARQUIVOS GERADOS:",
      "font-size:15px;font-weight:bold;"
    );

    for (
      const item
      of sucesso
    ) {

      console.log(
        `   ✅ ${item.codigo} → ${item.arquivo} (${item.equipes} equipes)`
      );

    }

  }


  // ============================================================
  // LISTA DE ERROS
  // ============================================================

  if (
    falhas.length
  ) {

    console.log("");

    console.error(
      "%c❌ INDICADORES COM ERRO:",
      "font-size:15px;font-weight:bold;"
    );

    for (
      const item
      of falhas
    ) {

      console.error(
        `   ❌ ${item.codigo} → ${item.erro}`
      );

    }

  }


  // ============================================================
  // TEMPO TOTAL
  // ============================================================

  const tempoTotal =
    (
      (Date.now() -
        inicioGeral) /
      1000
    ).toFixed(1);

  separador();

  console.log(
    `%c🏁 PROCESSO FINALIZADO`,
    "font-size:22px;font-weight:bold;"
  );

  console.log(
    `🕐 Tempo total: ${tempoTotal} segundos`
  );

  console.log(
    `📊 Indicadores concluídos: ${sucesso.length}/${indicadoresSelecionados.length}`
  );

  console.log(
    `📊 Indicadores com erro: ${falhas.length}/${indicadoresSelecionados.length}`
  );

  console.log(
    `📁 Arquivos gerados: ${sucesso.length}`
  );

  if (
    falhas.length === 0
  ) {

    console.log(
      "%c🎉 TODOS OS 31 RELATÓRIOS FORAM GERADOS COM SUCESSO!",
      "font-size:18px;font-weight:bold;color:green;"
    );

  } else {

    console.warn(
      `⚠️ Processo concluído, mas ${falhas.length} indicador(es) apresentaram erro.`
    );

  }

  publicarProgresso(
    falhas.length === 0
      ? modoOperacao === "consolidar"
        ? "✓ Consolidação concluída."
        : "✓ Relatório gerado com sucesso."
      : "✕ Relatório concluído com erros. Consulte os detalhes.",
    falhas.length === 0
      ? "success"
      : "error"
  );

  separador();

})().catch(
  erro => {

    console.error(
      "SIAPS-TOOL: erro inesperado no motor.",
      erro
    );

    window.postMessage(
      {
        source: "SIAPS_TOOL",
        type: "progress",
        mensagem: `Erro inesperado: ${erro.message}`,
        nivel: "error"
      },
      "*"
    );

  }
);

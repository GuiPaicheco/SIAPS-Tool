/* Catálogo de indicadores SIAPS da DAPS Betim. */
(function(root) {
  const indicadores = [

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
  root.SiapsCatalog = indicadores;
  if (typeof module === 'object') module.exports = indicadores;
})(globalThis);

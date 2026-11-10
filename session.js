/* Adaptador do fluxo público do SIAPS, conferido em 10/11/2026:
   main.bfe120fa7e38db34.js: auth/refresh-token, programa jKoa0KgJB.
   Esta função é autocontida para executeScript(MAIN). Nenhum token vai ao storage da extensão. */
async function lerSessaoSiaps(options = {}) {
  const authUrl = 'https://apiautenticacao-aps.saude.gov.br/auth/refresh-token';
  const ler = key => sessionStorage.getItem(key);
  const normalizar = value => String(value || '').trim().replace(/^Bearer\s+/i, '');
  const atual = () => normalizar(ler('access_token'));
  const result = (estado, mensagem, token = null) => ({ estado, mensagem, token });
  try {
    let token = atual();
    if (!token && !ler('refresh_token')) return result('ausente', 'Não encontramos uma sessão nesta aba. Entre no SIAPS e abra a Visão por Competência.');
    const vencimento = Number(ler('expires_in'));
    const pertoDeVencer = Number.isFinite(vencimento) && vencimento > 0 && vencimento - Date.now() < 60000;
    const renovar = async () => {
      // Outra requisição (inclusive do SIAPS) já pode ter atualizado o token.
      if (options.tokenAnterior && atual() && atual() !== options.tokenAnterior) return result('renovada', 'A sessão foi atualizada pelo SIAPS.', atual());
      if (globalThis.__SIAPS_TOOL_RENOVACAO__) return globalThis.__SIAPS_TOOL_RENOVACAO__;
      const refresh = ler('refresh_token');
      if (!refresh) return result('login_necessario', 'O SIAPS não disponibilizou uma renovação de sessão. Entre novamente pelo acesso oficial.');
      const anterior = atual();
      globalThis.__SIAPS_TOOL_RENOVACAO__ = (async () => {
        try {
          const response = await fetch(authUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...(anterior ? { Authorization: `Bearer ${anterior}` } : {}) },
            body: JSON.stringify({ 'refresh-token': refresh, programa: 'jKoa0KgJB' }), signal: AbortSignal.timeout(20000)
          });
          if (!response.ok) {
            if (atual() && atual() !== anterior) return result('renovada', 'A sessão foi atualizada pelo SIAPS.', atual());
            return [400, 401, 403].includes(response.status)
              ? result('login_necessario', 'O serviço de autenticação não aceitou a renovação. Entre novamente no SIAPS; recarregar a página pode manter a mesma sessão antiga.')
              : result('servico_indisponivel', `O serviço de autenticação respondeu HTTP ${response.status}. Tente verificar a conexão novamente em alguns instantes.`);
          }
          const data = await response.json();
          if (typeof data.access_token !== 'string' || !data.access_token.trim()) return result('resposta_invalida', 'O serviço de autenticação retornou uma resposta inesperada. Não alteramos a sessão.');
          // Não sobrescreve uma renovação simultânea já feita pelo próprio SIAPS.
          if (atual() && atual() !== anterior) return result('renovada', 'A sessão foi atualizada pelo SIAPS.', atual());
          if (ler('refresh_token') !== refresh || (anterior && !atual())) return result('login_necessario', 'A sessão foi alterada ou encerrada durante a verificação. Volte ao SIAPS antes de continuar.');
          sessionStorage.setItem('access_token', normalizar(data.access_token));
          if (typeof data.refresh_token === 'string' && data.refresh_token) sessionStorage.setItem('refresh_token', data.refresh_token);
          if (Number.isFinite(Number(data.expires_in)) && Number(data.expires_in) > 0) sessionStorage.setItem('expires_in', String(Date.now() + Number(data.expires_in) * 1000));
          if (Number.isFinite(Number(data.refresh_expires_in)) && Number(data.refresh_expires_in) > 0) sessionStorage.setItem('refresh_expires_in', String(Date.now() + Number(data.refresh_expires_in) * 1000));
          return result('renovada', 'Sessão renovada pelo serviço oficial do SIAPS.', atual());
        } catch { return result('servico_indisponivel', 'Não foi possível contactar a autenticação do SIAPS. Isso pode ser conexão ou indisponibilidade do serviço; não significa que você saiu do sistema.'); }
      })();
      try { return await globalThis.__SIAPS_TOOL_RENOVACAO__; } finally { delete globalThis.__SIAPS_TOOL_RENOVACAO__; }
    };
    let state = result('encontrada', 'Sessão encontrada nesta aba. A autorização será confirmada na consulta.', token);
    if (options.renovar && (!token || pertoDeVencer || options.forcar)) {
      state = await renovar();
      // Perto de vencer não é prova de expiração: o relógio local pode divergir.
      if (!state.token && token && atual() === token && !options.forcar) state = result('encontrada', 'Sessão encontrada. A renovação antecipada não foi confirmada; vamos verificar a autorização no SIAPS.', token);
      if (!state.token) return state;
      token = state.token;
    }
    if (!token) return result('login_necessario', 'Abra o SIAPS e entre pelo acesso oficial antes de consultar.');
    if (!options.verificar) return state;
    // A rota autenticada usada pelo próprio SIAPS valida a sessão; filtros públicos não comprovam login.
    // O corpo do perfil não é lido, exibido nem persistido: só interessa o status HTTP.
    const consultar = access => fetch('https://apisiaps.saude.gov.br/usuario/info', { headers: { Authorization: `Bearer ${access}`, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    let response = await consultar(token);
    if (response.status === 401 && options.renovar) {
      const renewed = await renovar();
      if (!renewed.token) return renewed;
      response = await consultar(renewed.token); token = renewed.token;
    }
    if (response.ok) return result('conectada', 'Conexão confirmada. O SIAPS aceitou sua sessão e respondeu à verificação.', token);
    if (response.status === 401) return result('login_necessario', 'O SIAPS recusou a sessão mesmo após a tentativa de renovação. Entre novamente pelo acesso oficial.');
    if (response.status === 403) return result('sem_permissao', 'Você está com uma sessão, mas o SIAPS não autorizou esta consulta. Confira seu perfil de acesso; entrar novamente pode não resolver.');
    return result('servico_indisponivel', `O SIAPS respondeu HTTP ${response.status} na verificação. Tente novamente em alguns instantes.`);
  } catch { return result('erro_leitura', 'A ferramenta não conseguiu verificar a sessão desta aba. Volte ao SIAPS e reabra a extensão. Não foi possível concluir que sua sessão expirou.'); }
}
if (typeof module === 'object') module.exports = { lerSessaoSiaps };

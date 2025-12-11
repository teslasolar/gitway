const Gateway = {
  config: null,
  repo: null,

  async init() {
    this.config = await fetch('konomi.json').then(r => r.json());
    this.repo = this.parseRepoFromURL();
    UI.render();
    TagSystem.init(this.config);
    AI.init(this.config.ai);
    this.startPolling();
  },

  parseRepoFromURL() {
    const params = new URLSearchParams(location.search);
    const repo = params.get('repo') || 'anthropics/claude-code';
    const [owner, name] = repo.split('/');
    return {owner, name, full: repo};
  },

  async fetchAPI(endpoint) {
    const url = `${this.config.providers[0].endpoint}/${endpoint}`;
    const headers = this.config.providers[0].headers;
    try {
      const res = await fetch(url, {headers});
      return res.ok ? await res.json() : null;
    } catch(e) {
      console.error('API Error:', e);
      return null;
    }
  },

  startPolling() {
    this.poll();
    setInterval(() => this.poll(), this.config.gateway.poll_rate);
  },

  async poll() {
    UI.updateStatus('POLLING');
    await TagSystem.updateAll();
    AI.analyze();
    UI.updateStatus('ONLINE');
  }
};

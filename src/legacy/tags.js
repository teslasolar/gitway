const TagSystem = {
  tags: {},
  history: {},

  init(config) {
    const device = config.devices[0];
    Object.keys(device.tags).forEach(path => {
      this.tags[path] = {
        path: `[${device.name}]/${path}`,
        endpoint: device.tags[path],
        value: null,
        quality: 'BAD',
        timestamp: null
      };
      this.history[path] = [];
    });
  },

  async updateAll() {
    for (const path in this.tags) {
      await this.update(path);
    }
  },

  async update(path) {
    const tag = this.tags[path];
    const endpoint = this.buildEndpoint(tag.endpoint);
    const data = await Gateway.fetchAPI(endpoint);

    if (data) {
      tag.value = this.extractValue(path, data);
      tag.quality = 'GOOD';
      tag.timestamp = Date.now();
      this.addHistory(path, tag.value);
    } else {
      tag.quality = 'BAD';
    }
  },

  buildEndpoint(template) {
    const {owner, name} = Gateway.repo;
    return `repos/${owner}/${name}/${template}`;
  },

  extractValue(path, data) {
    if (path.includes('CommitRate')) return this.calcCommitRate(data);
    return Array.isArray(data) ? data.length : data.size || 0;
  },

  calcCommitRate(commits) {
    if (!commits.length) return 0;
    const hours = (Date.now() - new Date(commits[commits.length-1].commit.author.date)) / 3600000;
    return (commits.length / hours).toFixed(2);
  },

  addHistory(path, value) {
    this.history[path].push({value, timestamp: Date.now()});
    if (this.history[path].length > 100) this.history[path].shift();
  },

  get(path) {
    return this.tags[path];
  },

  getHistory(path) {
    return this.history[path];
  }
};

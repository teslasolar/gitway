const AI = {
  config: null,
  alerts: [],

  init(config) {
    this.config = config;
  },

  analyze() {
    this.alerts = [];

    for (const path in TagSystem.tags) {
      const anomaly = this.detectAnomaly(path);
      if (anomaly) this.alerts.push(anomaly);
    }

    this.checkRules();
    UI.updateAlerts(this.alerts);
  },

  detectAnomaly(path) {
    const history = TagSystem.getHistory(path);
    if (history.length < 10) return null;

    const values = history.map(h => h.value);
    const mean = values.reduce((a,b) => a+b, 0) / values.length;
    const std = Math.sqrt(values.reduce((a,b) => a + Math.pow(b-mean, 2), 0) / values.length);

    const current = values[values.length - 1];
    const zscore = std > 0 ? Math.abs((current - mean) / std) : 0;

    if (zscore > this.config.threshold) {
      return {
        type: 'ANOMALY',
        tag: path,
        severity: 'WARN',
        message: `Unusual ${path}: ${current} (z=${zscore.toFixed(2)})`,
        timestamp: Date.now()
      };
    }
    return null;
  },

  checkRules() {
    const rules = Gateway.config.alerts;
    rules.forEach(rule => {
      const tag = TagSystem.get(rule.tag);
      if (!tag || tag.quality !== 'GOOD') return;

      const match = this.evalRule(tag.value, rule.op, rule.val);
      if (match) {
        this.alerts.push({
          type: 'RULE',
          tag: rule.tag,
          severity: rule.severity,
          message: rule.msg,
          timestamp: Date.now()
        });
      }
    });
  },

  evalRule(val, op, target) {
    switch(op) {
      case '<': return val < target;
      case '>': return val > target;
      case '=': return val === target;
      default: return false;
    }
  }
};

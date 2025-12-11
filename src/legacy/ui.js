const UI = {
  currentScreen: 'dashboard',

  render() {
    this.renderNav();
    this.renderSidebar();
    this.renderContent();
  },

  renderNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = `
      <div class="tabs">
        <div class="tab active" onclick="UI.switchScreen('dashboard')">Dashboard</div>
        <div class="tab" onclick="UI.switchScreen('tags')">Tag Browser</div>
        <div class="tab" onclick="UI.switchScreen('analytics')">Analytics</div>
      </div>
    `;
  },

  renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = `
      <div class="panel">
        <h3>REPO FACTORY</h3>
        <div class="info">${Gateway.repo?.full || 'Loading...'}</div>
      </div>
    `;
  },

  renderContent() {
    const content = document.getElementById('content');

    if (this.currentScreen === 'dashboard') {
      content.innerHTML = this.buildDashboard();
    } else if (this.currentScreen === 'tags') {
      content.innerHTML = this.buildTagBrowser();
    } else {
      content.innerHTML = this.buildAnalytics();
    }
  },

  buildDashboard() {
    let html = '<div class="widgets">';

    for (const path in TagSystem.tags) {
      const tag = TagSystem.tags[path];
      html += `
        <div class="widget ${tag.quality}">
          <div class="label">${path}</div>
          <div class="value">${tag.value ?? '---'}</div>
          <div class="status">${tag.quality}</div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  },

  buildTagBrowser() {
    let html = '<div class="tag-list">';

    for (const path in TagSystem.tags) {
      const tag = TagSystem.tags[path];
      html += `
        <div class="tag-row">
          <span class="tag-path">${tag.path}</span>
          <span class="tag-value">${tag.value ?? 'N/A'}</span>
          <span class="tag-quality ${tag.quality}">${tag.quality}</span>
        </div>
      `;
    }

    html += '</div>';
    return html;
  },

  buildAnalytics() {
    return '<div class="analytics"><h2>AI Analytics</h2><div id="alerts"></div></div>';
  },

  updateAlerts(alerts) {
    const alertDiv = document.getElementById('alerts');
    if (!alertDiv) return;

    alertDiv.innerHTML = alerts.map(a => `
      <div class="alert ${a.severity}">
        <span class="severity">${a.severity}</span>
        <span class="message">${a.message}</span>
      </div>
    `).join('');
  },

  updateStatus(status) {
    document.getElementById('status').innerHTML = `●${status}`;
  },

  switchScreen(screen) {
    this.currentScreen = screen;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    this.renderContent();
  }
};

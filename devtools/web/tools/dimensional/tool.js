let currentSettings = {};
let messageListener = null;

export const tool = {
  id: 'dimensional',
  label: 'Token Button',
  blurb: 'Interactive tuning environment for the Dimensional Projection token generation button mechanics.',
  
  mount(host) {
    this.root = document.createElement('div');
    this.root.className = 'dimensional-tool';
    this.root.style.width = '100%';
    this.root.style.height = '100%';
    this.root.style.display = 'flex';
    this.root.style.flexDirection = 'column';

    this.frame = document.createElement('iframe');
    this.frame.src = '/tools/dimensional/app/index.html?standalone=true';
    this.frame.style.width = '100%';
    this.frame.style.flex = '1';
    this.frame.style.border = 'none';
    
    this.root.appendChild(this.frame);
    host.appendChild(this.root);

    messageListener = (event) => {
      if (event.data && event.data.type === 'DIMENSIONAL_SETTINGS') {
        currentSettings = event.data.settings;
        // Trigger a fake change event to enable the apply button if the suite expects it
        const applyBtn = document.getElementById('apply');
        if (applyBtn) {
          applyBtn.disabled = false;
        }
      }
    };
    window.addEventListener('message', messageListener);
  },

  unmount() {
    if (this.frame) {
      this.frame.remove();
      this.frame = null;
    }
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    if (messageListener) {
      window.removeEventListener('message', messageListener);
      messageListener = null;
    }
  },

  getSettings() {
    return currentSettings;
  },
  
  settingsNote: 'Writes all current slider values from the tuner into dimensional-settings.js.'
};

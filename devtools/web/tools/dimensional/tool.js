export const tool = {
  id: 'dimensional',
  label: 'Token Button Tuner',
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
  },

  // No getSettings function means this tool doesn't export a configuration file to the project,
  // which is correct because the parameters are hardcoded props in the React integration.
};

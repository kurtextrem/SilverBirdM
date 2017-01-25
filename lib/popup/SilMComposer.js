class SilMComposer extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.innerHTML = `
      <style>
        :host {
          position: absolute;
          top: 0;
          left: 0;
          width: calc(100% - 2px);
          height: 226px;
          overflow: hidden;
          z-index: 15000;

          display: flex;
          flex-flow: column nowrap;
          justify-content: flex-end;

          background-color: var(--main-bg-color);
          transition-property: transform;
          transition-duration: 300ms;
          transition-timing-function: ease-out;
          transform: translateY(-200px);
        }
        :host([composed="true"]) {
          transition-property: transform;
          transition-duration: 300ms;
          transition-timing-function: ease-out;
          transform: translateY(0px);
        }
      </style>
      <slot></slot>
    `;
  }
  connectedCallback() {}
  disconnectedCallback() {}
  static get observedAttributes() {
    return ["composed"];
  }
  attributeChangedCallback(attrName, oldVal, newVal) {}
  adoptedCallback() {}
}
customElements.define("silm-composer", SilMComposer);

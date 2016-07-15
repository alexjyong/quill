import Keyboard from '../modules/keyboard';


class Tooltip {
  constructor(quill, boundsContainer) {
    this.quill = quill;
    this.boundsContainer = boundsContainer;
    this.root = quill.addContainer('ql-tooltip');
    this.root.innerHTML = this.constructor.TEMPLATE;
    let offset = parseInt(window.getComputedStyle(this.root).marginTop);
    this.quill.root.addEventListener('scroll', () => {
      this.root.style.marginTop = (-1*this.quill.root.scrollTop) + offset + 'px';
    });
    this.textbox = this.root.querySelector('input[type="text"]');
    this.listen();
    this.hide();
  }

  listen() {
    this.textbox.addEventListener('keydown', (event) => {
      if (Keyboard.match(event, 'enter')) {
        this.save();
        event.preventDefault();
      } else if (Keyboard.match(event, 'escape')) {
        this.cancel();
        event.preventDefault();
      }
    });
  }

  position(reference) {
    let left = reference.left + reference.width/2 - this.root.offsetWidth/2;
    let top = reference.bottom + this.quill.root.scrollTop;
    this.root.style.left = left + 'px';
    this.root.style.top = top + 'px';
    let containerBounds = this.boundsContainer.getBoundingClientRect();
    let rootBounds = this.root.getBoundingClientRect();
    let shift = 0;
    if (rootBounds.right > containerBounds.right) {
      shift = containerBounds.right - rootBounds.right;
      this.root.style.left = (left + shift) + 'px';
    }
    if (rootBounds.left < containerBounds.left) {
      shift = containerBounds.left - rootBounds.left;
      this.root.style.left = (left + shift) + 'px';
    }
    return shift;
  }

  edit() {
    this.root.classList.remove('ql-hidden');
    this.root.classList.add('ql-editing');
    this.textbox.focus();
  }

  save() {

  }

  cancel() {

  }

  show() {
    this.root.classList.remove('ql-editing');
    this.root.classList.remove('ql-hidden');
  }

  hide() {
    this.root.classList.add('ql-hidden');
  }
}


export default Tooltip;

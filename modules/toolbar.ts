import Delta from 'quill-delta';
import { EmbedBlot, Scope } from 'parchment';
import Quill from '../core/quill';
import logger from '../core/logger';
import Module from '../core/module';
import type { Range } from '../core/selection';

const debug = logger('quill:toolbar');

type Handler = (value: any) => void;

export type ToolbarConfig = Array<
  string[] | Array<string | Record<string, unknown>>
>;
export interface ToolbarProps {
  container?: HTMLElement | ToolbarConfig | null;
  handlers?: Record<string, Handler>;
  option?: number;
  module?: boolean;
  theme?: boolean;
}

class Toolbar extends Module<ToolbarProps> {
  static DEFAULTS: ToolbarProps;

  container?: HTMLElement | null;
  controls: [string, HTMLElement][];
  handlers: Record<string, Handler>;

  constructor(quill: Quill, options: Partial<ToolbarProps>) {
    super(quill, options);
    if (Array.isArray(this.options.container)) {
      const container = document.createElement('div');
      addControls(container, this.options.container);
      quill.container?.parentNode?.insertBefore(container, quill.container);
      this.container = container;
    } else if (typeof this.options.container === 'string') {
      this.container = document.querySelector(this.options.container);
    } else {
      this.container = this.options.container;
    }
    if (!(this.container instanceof HTMLElement)) {
      debug.error('Container required for toolbar', this.options);
      return;
    }
    this.container.classList.add('ql-toolbar');
    this.controls = [];
    this.handlers = {};
    if (this.options.handlers) {
      Object.keys(this.options.handlers).forEach((format) => {
        const handler = this.options.handlers?.[format];
        if (handler) {
          this.addHandler(format, handler);
        }
      });
    }
    Array.from(this.container.querySelectorAll('button, select')).forEach(
      (input) => {
        // @ts-expect-error Fix me later
        this.attach(input);
      },
    );
    // @ts-ignore
    this.quill.on(Quill.events.EDITOR_CHANGE, (type, range) => {
      if (type === Quill.events.SELECTION_CHANGE) {
        this.update(range as Range);
      }
    });
    this.quill.on(Quill.events.SCROLL_OPTIMIZE, () => {
      const [range] = this.quill.selection.getRange();
      this.update(range);
    });

    // Add the video handler
    this.addHandler('video', this.videoHandler);
  }

  videoHandler() {
    // Check if the dropdown already exists
    let dropdown = document.getElementById('videoDropdown');
    if (!dropdown) {
      // Create the dropdown menu
      dropdown = document.createElement('div');
      dropdown.id = 'videoDropdown';
      dropdown.style.position = 'absolute';
      dropdown.style.zIndex = '1000';
      dropdown.style.padding = '5px';
      dropdown.style.borderRadius = '3px';
      dropdown.style.boxShadow = '0px 2px 10px rgba(0, 0, 0, 0.1)';
      dropdown.style.backgroundColor = '#f9f9f9';
      dropdown.style.width = '150px'; // Reduced width
      dropdown.style.display = 'none'; // Initially hidden
      document.body.appendChild(dropdown);

      // Option to embed from URL
      const embedOption = document.createElement('div');
      embedOption.innerText = 'Embed from URL';
      embedOption.onclick = () => {
        const url = prompt('Enter video URL:');
        if (url) {
          const range = this.quill.getSelection(true);
          this.quill.insertEmbed(range.index, 'video', url);
        } // @ts-ignore
        dropdown.style.display = 'none'; // Hide dropdown after selection
      };
      dropdown.appendChild(embedOption);

      // Option to upload video
      const uploadOption = document.createElement('div');
      uploadOption.innerText = 'Upload Video';
      uploadOption.onclick = () => {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        // Extract video mime types from this.quill.uploader.options.mimetypes
        // @ts-ignore
        const videoMimeTypes = this.quill.uploader.options.mimetypes.filter(
          (mimetype) => mimetype.startsWith('video/'),
        );

        // Convert the mime types into a string format for the accept attribute
        const acceptValue = videoMimeTypes.join(',');

        // Set the accept attribute of the input element
        input.setAttribute('accept', acceptValue);
        input.click();

        input.onchange = () => {
          // @ts-ignore
          const file = input.files[0];
          if (file) {
            const range = this.quill.getSelection(true);
            this.quill.uploader.upload(range, [file]);
          }
        }; // @ts-ignore
        dropdown.style.display = 'none'; // Hide dropdown after selection
      };
      dropdown.appendChild(uploadOption);

      // Style the options
      // @ts-ignore
      // Style the options
      const styleOption = (option) => {
        option.style.padding = '5px 10px'; // Reduced padding
        option.style.cursor = 'pointer';
        option.style.fontSize = '14px'; // Smaller font size
        option.style.transition = 'background-color 0.2s';

        // Hover effect
        option.addEventListener('mouseover', () => {
          option.style.backgroundColor = '#e6e6e6';
        });
        option.addEventListener('mouseout', () => {
          option.style.backgroundColor = 'transparent';
        });
      };

      styleOption(embedOption);
      styleOption(uploadOption);

      // Insert an <hr> to divide the options
      const divider = document.createElement('hr');
      divider.style.margin = '10px 0';
      dropdown.insertBefore(divider, uploadOption);
    }

    // Toggle the visibility of the dropdown menu
    dropdown.style.display =
      dropdown.style.display === 'none' ? 'block' : 'none';

    // Position the dropdown below the video button
    const videoButton = document.querySelector('.ql-video'); // Adjust the selector if needed
    // @ts-ignore
    const rect = videoButton.getBoundingClientRect();
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.top = `${rect.bottom}px`;

    let videoButtonClicked = false; // Flag to track if the video button was clicked
    let showDropdown = false; // Flag to track the desired visibility state of the dropdown

    // @ts-ignore
    videoButton.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      videoButtonClicked = true; // Set the flag to true when the video button is clicked
      // @ts-ignore
      showDropdown = dropdown.style.display === 'none'; // Set the desired visibility state
    });

    document.addEventListener('mousedown', (e) => {
      if (
        e.target !== dropdown && // @ts-ignore
        !dropdown.contains(e.target) &&
        e.target !== videoButton
      ) {
        if (videoButtonClicked) {
          // @ts-ignore
          dropdown.style.display = showDropdown ? 'block' : 'none'; // Update dropdown visibility based on the flag
          videoButtonClicked = false; // Reset the flag
          return; // If the video button was clicked, do not hide the dropdown
        }
        // @ts-ignore
        dropdown.style.display = 'none';
      }
    });
  }

  addHandler(format: string, handler: Handler) {
    this.handlers[format] = handler;
  }

  attach(input: HTMLElement) {
    let format = Array.from(input.classList).find((className) => {
      return className.indexOf('ql-') === 0;
    });
    if (!format) return;
    format = format.slice('ql-'.length);
    if (input.tagName === 'BUTTON') {
      input.setAttribute('type', 'button');
    }
    if (
      this.handlers[format] == null &&
      this.quill.scroll.query(format) == null
    ) {
      debug.warn('ignoring attaching to nonexistent format', format, input);
      return;
    }
    const eventName = input.tagName === 'SELECT' ? 'change' : 'click';
    input.addEventListener(eventName, (e) => {
      let value;
      if (input.tagName === 'SELECT') {
        // @ts-expect-error
        if (input.selectedIndex < 0) return;
        // @ts-expect-error
        const selected = input.options[input.selectedIndex];
        if (selected.hasAttribute('selected')) {
          value = false;
        } else {
          value = selected.value || false;
        }
      } else {
        if (input.classList.contains('ql-active')) {
          value = false;
        } else {
          // @ts-expect-error
          value = input.value || !input.hasAttribute('value');
        }
        e.preventDefault();
      }
      this.quill.focus();
      const [range] = this.quill.selection.getRange();
      // @ts-expect-error Fix me later
      if (this.handlers[format] != null) {
        // @ts-expect-error Fix me later
        this.handlers[format].call(this, value);
      } else if (
        // @ts-expect-error
        this.quill.scroll.query(format).prototype instanceof EmbedBlot
      ) {
        value = prompt(`Enter ${format}`); // eslint-disable-line no-alert
        if (!value) return;
        this.quill.updateContents(
          new Delta()
            // @ts-expect-error Fix me later
            .retain(range.index)
            // @ts-expect-error Fix me later
            .delete(range.length)
            // @ts-expect-error Fix me later
            .insert({ [format]: value }),
          Quill.sources.USER,
        );
      } else {
        // @ts-expect-error Fix me later
        this.quill.format(format, value, Quill.sources.USER);
      }
      this.update(range);
    });
    this.controls.push([format, input]);
  }

  update(range: Range | null) {
    const formats = range == null ? {} : this.quill.getFormat(range);
    this.controls.forEach((pair) => {
      const [format, input] = pair;
      if (input.tagName === 'SELECT') {
        let option: HTMLOptionElement | null = null;
        if (range == null) {
          option = null;
        } else if (formats[format] == null) {
          option = input.querySelector('option[selected]');
        } else if (!Array.isArray(formats[format])) {
          let value = formats[format];
          if (typeof value === 'string') {
            value = value.replace(/"/g, '\\"');
          }
          option = input.querySelector(`option[value="${value}"]`);
        }
        if (option == null) {
          // @ts-expect-error TODO fix me later
          input.value = ''; // TODO make configurable?
          // @ts-expect-error TODO fix me later
          input.selectedIndex = -1;
        } else {
          option.selected = true;
        }
      } else if (range == null) {
        input.classList.remove('ql-active');
        input.setAttribute('aria-pressed', 'false');
      } else if (input.hasAttribute('value')) {
        // both being null should match (default values)
        // '1' should match with 1 (headers)
        const value = formats[format] as boolean | number | string | object;
        const isActive =
          value === input.getAttribute('value') ||
          (value != null && value.toString() === input.getAttribute('value')) ||
          (value == null && !input.getAttribute('value'));
        input.classList.toggle('ql-active', isActive);
        input.setAttribute('aria-pressed', isActive.toString());
      } else {
        const isActive = formats[format] != null;
        input.classList.toggle('ql-active', isActive);
        input.setAttribute('aria-pressed', isActive.toString());
      }
    });
  }
}
Toolbar.DEFAULTS = {};

function addButton(container: HTMLElement, format: string, value?: unknown) {
  const input = document.createElement('button');
  input.setAttribute('type', 'button');
  input.classList.add(`ql-${format}`);
  input.setAttribute('aria-pressed', 'false');
  if (value != null) {
    // @ts-expect-error
    input.value = value;
  }
  container.appendChild(input);
}

function addControls(
  container: HTMLElement,
  groups:
    | (string | Record<string, unknown>)[][]
    | (string | Record<string, unknown>)[],
) {
  if (!Array.isArray(groups[0])) {
    // @ts-expect-error
    groups = [groups];
  }
  groups.forEach((controls: any) => {
    const group = document.createElement('span');
    group.classList.add('ql-formats');
    controls.forEach((control: any) => {
      if (typeof control === 'string') {
        addButton(group, control);
      } else {
        const format = Object.keys(control)[0];
        const value = control[format];
        if (Array.isArray(value)) {
          addSelect(group, format, value);
        } else {
          addButton(group, format, value);
        }
      }
    });
    container.appendChild(group);
  });
}

function addSelect(
  container: HTMLElement,
  format: string,
  values: Array<string | boolean>,
) {
  const input = document.createElement('select');
  input.classList.add(`ql-${format}`);
  values.forEach((value) => {
    const option = document.createElement('option');
    if (value !== false) {
      option.setAttribute('value', String(value));
    } else {
      option.setAttribute('selected', 'selected');
    }
    input.appendChild(option);
  });
  container.appendChild(input);
}

Toolbar.DEFAULTS = {
  container: null,
  handlers: {
    clean() {
      const range = this.quill.getSelection();
      if (range == null) return;
      if (range.length === 0) {
        const formats = this.quill.getFormat();
        Object.keys(formats).forEach((name) => {
          // Clean functionality in existing apps only clean inline formats
          if (this.quill.scroll.query(name, Scope.INLINE) != null) {
            this.quill.format(name, false, Quill.sources.USER);
          }
        });
      } else {
        this.quill.removeFormat(range, Quill.sources.USER);
      }
    },
    direction(value) {
      const { align } = this.quill.getFormat();
      if (value === 'rtl' && align == null) {
        this.quill.format('align', 'right', Quill.sources.USER);
      } else if (!value && align === 'right') {
        this.quill.format('align', false, Quill.sources.USER);
      }
      this.quill.format('direction', value, Quill.sources.USER);
    },
    indent(value) {
      const range = this.quill.getSelection();
      const formats = this.quill.getFormat(range);
      const indent = parseInt(formats.indent || 0, 10);
      if (value === '+1' || value === '-1') {
        let modifier = value === '+1' ? 1 : -1;
        if (formats.direction === 'rtl') modifier *= -1;
        this.quill.format('indent', indent + modifier, Quill.sources.USER);
      }
    },
    link(value) {
      if (value === true) {
        value = prompt('Enter link URL:'); // eslint-disable-line no-alert
      }
      this.quill.format('link', value, Quill.sources.USER);
    },
    list(value) {
      const range = this.quill.getSelection();
      const formats = this.quill.getFormat(range);
      if (value === 'check') {
        if (formats.list === 'checked' || formats.list === 'unchecked') {
          this.quill.format('list', false, Quill.sources.USER);
        } else {
          this.quill.format('list', 'unchecked', Quill.sources.USER);
        }
      } else {
        this.quill.format('list', value, Quill.sources.USER);
      }
    },
    video(value: any) {
      this.videoHandler(value);
    },
  },
};

export { Toolbar as default, addControls };

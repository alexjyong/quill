import Delta from 'quill-delta';
import type Quill from '../core/quill';
import Emitter from '../core/emitter';
import Module from '../core/module';
import type { Range } from '../core/selection';

interface UploaderOptions {
  mimetypes: string[];
  handler: (this: { quill: Quill }, range: Range, files: File[]) => void;
}

class Uploader extends Module<UploaderOptions> {
  static DEFAULTS: UploaderOptions;

  constructor(quill: Quill, options: Partial<UploaderOptions>) {
    super(quill, options);
    quill.root.addEventListener('drop', (e) => {
      e.preventDefault();
      let native: ReturnType<typeof document.createRange> | null = null;
      if (document.caretRangeFromPoint) {
        native = document.caretRangeFromPoint(e.clientX, e.clientY);
        // @ts-expect-error
      } else if (document.caretPositionFromPoint) {
        // @ts-expect-error
        const position = document.caretPositionFromPoint(e.clientX, e.clientY);
        native = document.createRange();
        native.setStart(position.offsetNode, position.offset);
        native.setEnd(position.offsetNode, position.offset);
      }

      const normalized = native && quill.selection.normalizeNative(native);
      if (normalized) {
        const range = quill.selection.normalizedToRange(normalized);
        if (e.dataTransfer?.files) {
          this.upload(range, e.dataTransfer.files);
        }
      }
    });
  }

  upload(range: Range, files: FileList | File[]) {
    const uploads: File[] = [];
    Array.from(files).forEach((file) => {
      if (file && this.options.mimetypes?.includes(file.type)) {
        uploads.push(file);
      }
    });
    if (uploads.length > 0) {
      // @ts-expect-error Fix me later
      this.options.handler.call(this, range, uploads);
    }
  }
}

Uploader.DEFAULTS = {
  mimetypes: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime', // MOV
    'video/x-msvideo', // AVI
    'video/mpeg', // MPEG
    'video/x-matroska', // MKV
    'video/ogg', // OGV
    'video/x-flv', // FLV
    'video/x-ms-wmv', // WMV
    'video/3gpp', // 3GP
    'video/3gpp2', // 3G2
    'video/x-ms-asf', // ASF
  ],
  handler(range: Range, files: File[]) {
    const promises = files.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          // @ts-expect-error Fix me later
          resolve({ data: e.target.result, type: file.type });
        };
        reader.readAsDataURL(file);
      });
    });
    Promise.all(promises).then((results) => {
      const update = results.reduce((delta: Delta, result) => {
        // @ts-expect-error Fix me later
        if (result.type.startsWith('image/')) {
          // @ts-expect-error Fix me later
          return delta.insert({ image: result.data });
          // @ts-expect-error Fix me later
        } else if (result.type.startsWith('video/')) {
          // @ts-expect-error Fix me later
          return delta.insert({ video: result.data });
        }
        return delta;
      }, new Delta().retain(range.index).delete(range.length)) as Delta;
      this.quill.updateContents(update, Emitter.sources.USER);
      this.quill.setSelection(
        range.index + results.length,
        Emitter.sources.SILENT,
      );
    });
  },
};

export default Uploader;

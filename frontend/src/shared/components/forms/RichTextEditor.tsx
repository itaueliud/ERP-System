import { useRef, useCallback } from 'react';

export interface RichTextEditorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  minHeight?: number;
  disabled?: boolean;
  wrapperClassName?: string;
}

type FormatCommand = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList';

const TOOLBAR_BUTTONS: { command: FormatCommand; label: string; title: string }[] = [
  { command: 'bold', label: 'B', title: 'Bold' },
  { command: 'italic', label: 'I', title: 'Italic' },
  { command: 'underline', label: 'U', title: 'Underline' },
  { command: 'insertUnorderedList', label: '• List', title: 'Bullet list' },
  { command: 'insertOrderedList', label: '1. List', title: 'Numbered list' },
];

export function RichTextEditor({
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
  minHeight = 120,
  disabled,
  wrapperClassName = '',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorId = useRef(`rte-${Math.random().toString(36).slice(2, 9)}`).current;

  const execFormat = useCallback((command: FormatCommand) => {
    document.execCommand(command, false);
    editorRef.current?.focus();
  }, []);

  const handleInput = () => {
    onChange(editorRef.current?.innerHTML ?? '');
  };

  // Sync value when controlled externally (only if editor not focused)
  const handleBlur = () => {
    onChange(editorRef.current?.innerHTML ?? '');
  };

  return (
    <div className={`flex flex-col gap-1 ${wrapperClassName}`}>
      {label && (
        <label htmlFor={editorId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className={`border rounded-md overflow-hidden ${error ? 'border-red-400' : 'border-gray-300'} ${disabled ? 'opacity-50' : ''}`}>
        <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50" role="toolbar" aria-label="Text formatting">
          {TOOLBAR_BUTTONS.map((btn) => (
            <button
              key={btn.command}
              type="button"
              title={btn.title}
              aria-label={btn.title}
              disabled={disabled}
              onMouseDown={(e) => { e.preventDefault(); execFormat(btn.command); }}
              className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {btn.label}
            </button>
          ))}
        </div>
        <div
          id={editorId}
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={label ?? 'Rich text editor'}
          aria-invalid={error ? 'true' : undefined}
          data-placeholder={placeholder}
          onInput={handleInput}
          onBlur={handleBlur}
          dangerouslySetInnerHTML={{ __html: value }}
          style={{ minHeight }}
          className="p-3 text-sm text-gray-800 focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
        />
      </div>
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default RichTextEditor;

import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import MonacoEditor, { loader } from '@monaco-editor/react';
import type { editor, IDisposable } from 'monaco-editor';
import type { Monaco } from '@monaco-editor/react';
import type { ParseError } from '../parser/types';
import type { Theme } from '../store/useDocStore';
import { SHAPES } from '../parser/types';

const LANG_ID = 'diagrama';
const DIRECTIONS = ['TB', 'LR', 'BT', 'RL'];
const ATTR_KEYS = ['label', 'shape', 'style', 'color', 'icon'];
const STYLES = ['solid', 'dashed', 'dotted'];
const TYPES = ['flowchart', 'sequence', 'er'];
const TOP_KEYWORDS = ['type', 'title', 'direction', 'group', 'note', 'actor'];

let langConfigured = false;

export type EditorHandle = {
  revealLine: (line: number) => void;
};

function configureLanguage(monaco: Monaco): void {
  if (langConfigured) return;
  langConfigured = true;

  monaco.languages.register({ id: LANG_ID });

  monaco.languages.setMonarchTokensProvider(LANG_ID, {
    keywords: ['direction', 'group', 'type', 'title', 'note', 'over', 'actor'],
    typeKeywords: [...SHAPES, ...DIRECTIONS, ...STYLES, ...TYPES],
    attrKeywords: ATTR_KEYS,
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [
          /[a-zA-Z_][\w-]*/,
          {
            cases: {
              '@keywords': 'keyword',
              '@typeKeywords': 'type',
              '@attrKeywords': 'attribute.name',
              '@default': 'identifier',
            },
          },
        ],
        [/<>|--|>/, 'operator.arrow'],
        [/[:,.;]/, 'operator'],
        [/[[\]{}]/, '@brackets'],
        [/\s+/, 'white'],
      ],
    },
  });

  monaco.editor.defineTheme('diagrama-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8a8472', fontStyle: 'italic' },
      { token: 'keyword', foreground: '8a5cf6', fontStyle: 'bold' },
      { token: 'type', foreground: '3d7068' },
      { token: 'attribute.name', foreground: 'c08a3e' },
      { token: 'string', foreground: '5f7a4f' },
      { token: 'operator.arrow', foreground: 'be5d3e', fontStyle: 'bold' },
      { token: 'operator', foreground: '6b6657' },
      { token: 'identifier', foreground: '1a1915' },
    ],
    colors: {
      'editor.background': '#f5f4ee',
      'editor.foreground': '#1a1915',
      'editorLineNumber.foreground': '#b3ae9d',
      'editorLineNumber.activeForeground': '#75715f',
      'editor.selectionBackground': '#d9775733',
      'editor.lineHighlightBackground': '#00000008',
    },
  });

  monaco.editor.defineTheme('diagrama-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8a8472', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c4a3f5', fontStyle: 'bold' },
      { token: 'type', foreground: '5ba697' },
      { token: 'attribute.name', foreground: 'e0b057' },
      { token: 'string', foreground: 'a3c08a' },
      { token: 'operator.arrow', foreground: 'e8a589', fontStyle: 'bold' },
      { token: 'operator', foreground: 'c9c5b8' },
      { token: 'identifier', foreground: 'ece9e0' },
    ],
    colors: {
      'editor.background': '#1a1917',
      'editor.foreground': '#ece9e0',
      'editorLineNumber.foreground': '#57544a',
      'editorLineNumber.activeForeground': '#a8a294',
      'editor.selectionBackground': '#d9775744',
      'editor.lineHighlightBackground': '#ffffff08',
    },
  });

  monaco.languages.registerCompletionItemProvider(LANG_ID, {
    triggerCharacters: ['[', ' ', ':', ','],
    provideCompletionItems(
      model: editor.ITextModel,
      position: import('monaco-editor').Position,
    ) {
      const lineContent = model.getLineContent(position.lineNumber);
      const before = lineContent.slice(0, position.column - 1);
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const Kind = monaco.languages.CompletionItemKind;
      const items: import('monaco-editor').languages.CompletionItem[] = [];

      const insideOpenBracket =
        before.lastIndexOf('[') > before.lastIndexOf(']');

      if (/\btype\s*:\s*\w*$/.test(before)) {
        for (const t of TYPES) {
          items.push({ label: t, kind: Kind.EnumMember, insertText: t, range });
        }
      } else if (/\bdirection\s+\w*$/.test(before)) {
        for (const d of DIRECTIONS) {
          items.push({ label: d, kind: Kind.EnumMember, insertText: d, range });
        }
      } else if (/\bshape\s*:\s*\w*$/.test(before)) {
        for (const s of SHAPES) {
          items.push({ label: s, kind: Kind.EnumMember, insertText: s, range });
        }
      } else if (/\bstyle\s*:\s*\w*$/.test(before)) {
        for (const s of STYLES) {
          items.push({ label: s, kind: Kind.EnumMember, insertText: s, range });
        }
      } else if (insideOpenBracket && /[[,]\s*\w*$/.test(before)) {
        for (const k of ATTR_KEYS) {
          items.push({
            label: k,
            kind: Kind.Property,
            insertText: `${k}: `,
            range,
          });
        }
      } else if (/^\s*\w*$/.test(before)) {
        for (const k of TOP_KEYWORDS) {
          items.push({ label: k, kind: Kind.Keyword, insertText: k, range });
        }
        items.push({
          label: 'group',
          kind: Kind.Snippet,
          insertText: 'group "$1" {\n\t$0\n}',
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRules.InsertAsSnippet,
          range,
        });
      }

      return { suggestions: items };
    },
  });
}

type EditorProps = {
  value: string;
  onChange: (v: string) => void;
  errors: ParseError[];
  theme: Theme;
  onCursorLineChange?: (line: number) => void;
};

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { value, onChange, errors, theme, onCursorLineChange },
  ref,
) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const cursorDisposableRef = useRef<IDisposable | null>(null);

  useImperativeHandle(ref, () => ({
    revealLine: (line: number) => {
      const ed = editorRef.current;
      if (!ed) return;
      ed.revealLineInCenter(line);
      ed.setPosition({ lineNumber: line, column: 1 });
      // Intentionally do NOT call ed.focus(); the canvas keeps focus so
      // Ctrl+C/V/D fire the canvas handlers instead of Monaco's.
    },
  }));

  useEffect(() => {
    loader.init().then((m) => configureLanguage(m as unknown as Monaco));
  }, []);

  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    const model = ed.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(
      model,
      'parser',
      errors.map((err) => ({
        severity: monaco.MarkerSeverity.Error,
        startLineNumber: err.line,
        startColumn: 1,
        endLineNumber: err.line,
        endColumn: model.getLineMaxColumn(err.line),
        message: err.message,
      })),
    );
  }, [errors]);

  const handleMount = (
    ed: editor.IStandaloneCodeEditor,
    monaco: Monaco,
  ) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    configureLanguage(monaco);
    cursorDisposableRef.current?.dispose();
    cursorDisposableRef.current = ed.onDidChangeCursorPosition((e) => {
      onCursorLineChange?.(e.position.lineNumber);
    });
  };

  useEffect(
    () => () => {
      cursorDisposableRef.current?.dispose();
    },
    [],
  );

  return (
    <MonacoEditor
      height="100%"
      defaultLanguage={LANG_ID}
      language={LANG_ID}
      theme={theme === 'dark' ? 'diagrama-dark' : 'diagrama-light'}
      value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        renderWhitespace: 'none',
        tabSize: 2,
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        quickSuggestions: { other: true, comments: false, strings: false },
        suggestOnTriggerCharacters: true,
      }}
    />
  );
});

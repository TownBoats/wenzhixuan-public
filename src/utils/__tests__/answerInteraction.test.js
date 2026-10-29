import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { readAnswerPreferences, getAnswerWaitSeconds } from '../answerPreferences.js';

// Exercise real component handlers, replacing only layout/Markdown/i18n dependencies.
const require = createRequire(import.meta.url);
const { buildSync } = createRequire(require.resolve('vite/package.json'))('esbuild');
const { act, create } = ReactTestRenderer;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const compile = (file) => {
  const fs = require('node:fs');
  let source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  source = source.replace(/^import .*from ['"](?:react-draggable|react-resizable|react-i18next|.*MarkdownRenderer.*|.*useMediaQuery.*|@\/components\/ui)['"];?$/gm, '');
  source = source.replace(/^import ['"].*\.css['"];?$/gm, '');
  source = source.replace(/^import SettingsSection .*$/gm, '');
  source = source.replace(/^import .*answerPreferences['"];?$/gm, '');
  const code = buildSync({
    stdin: { contents: source, loader: 'jsx' },
    format: 'cjs', jsx: 'automatic', write: false,
  }).outputFiles[0].text;
  const result = { exports: {} };
  // eslint-disable-next-line react/prop-types -- Presentation-only test stub.
  const Button = ({ children, ...props }) => React.createElement('button', props, children);
  const stub = () => null;
  const layout = ({ children }) => React.createElement('section', null, children);
  const t = (key, params) => params?.level ? `${key}:${params.level}` : key;
  new Function('require', 'module', 'exports', 'useTranslation', 'useMediaQuery', 'BREAKPOINTS',
    'Button', 'Icon', 'BrandLogo', 'LevelIcon', 'cn', 'MarkdownRenderer', 'Draggable', 'Resizable',
    'SettingsSection', 'readAnswerPreferences', 'getAnswerWaitSeconds', code)(
    require, result, result.exports, () => ({ t }), () => false, { md: 768 },
    Button, stub, stub, stub, (...items) => items.filter(Boolean).join(' '),
    ({ content }) => React.createElement('p', null, content), layout, layout, layout,
    readAnswerPreferences, getAnswerWaitSeconds,
  );
  return result.exports.default;
};
const AnswerCard = compile('../../components/AnswerCard/AnswerCard.jsx');
const AnswerWaitSettings = compile('../../components/SettingsPanel/AnswerWaitSettings.jsx');

const question = { id: 'q1', question: 'Question?', answer: {
  none: [{ content: 'First answer' }], basic: [{ content: 'Second answer' }],
} };
const event = (extra = {}) => ({ target: { closest: () => null }, ...extra });
function setup(values = { enableWaitTime: 'false' }) {
  const saved = new Map(Object.entries(values));
  globalThis.localStorage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  globalThis.window = { innerWidth: 390, innerHeight: 844 };
  return saved;
}
function mount(props = {}) {
  const calls = [];
  let renderer;
  act(() => { renderer = create(React.createElement(AnswerCard, { question, onLevelSelect: (...args) => calls.push(args), ...props })); });
  return {
    renderer, calls,
    options: () => renderer.root.findAll((node) => node.type === 'div' && node.props.role === 'button'),
    confirm: () => renderer.root.findAllByType('button').find((node) => String(node.props.children).startsWith('AnswerCard.confirm')),
    close: () => act(() => renderer.unmount()),
  };
}

test('single tap previews/selects; switching and confirming sends the selected answer only once', () => {
  setup();
  const view = mount();
  assert.equal(view.confirm().props.disabled, true);
  act(() => view.options()[0].props.onClick(event()));
  assert.equal(view.options()[0].props['aria-pressed'], true);
  assert.equal(view.calls.length, 0);
  act(() => view.options()[1].props.onClick(event()));
  assert.equal(view.options()[0].props['aria-pressed'], false);
  act(() => { view.confirm().props.onClick(); view.confirm().props.onClick(); });
  assert.deepEqual(view.calls, [['basic', 'Second answer']]);
  view.close();
});

test('mouse double-click confirms; links inside Markdown do not select or submit', () => {
  setup();
  const view = mount();
  const linkEvent = event({ target: { closest: () => ({ tagName: 'A' }) } });
  act(() => { view.options()[0].props.onClick(linkEvent); view.options()[0].props.onDoubleClick(linkEvent); });
  assert.equal(view.confirm().props.disabled, true);
  act(() => view.options()[1].props.onDoubleClick(event()));
  assert.deepEqual(view.calls, [['basic', 'Second answer']]);
  view.close();
});

test('keyboard can preselect; a different question clears preview, selection and custom input', () => {
  setup();
  const view = mount();
  let prevented = false;
  act(() => {
    const option = view.options()[0];
    option.props.onKeyDown({ key: ' ', target: option, currentTarget: option, preventDefault: () => { prevented = true; } });
  });
  assert.equal(prevented, true);
  assert.equal(view.options()[0].props['aria-pressed'], true);
  assert.equal(view.calls.length, 0);
  act(() => view.renderer.root.findByType('textarea').props.onChange({ target: { value: 'My answer' } }));
  assert.equal(view.confirm().props.disabled, true);
  act(() => view.renderer.update(React.createElement(AnswerCard, { question: { ...question, id: 'q2' } })));
  assert.equal(view.options()[0].props['aria-pressed'], false);
  assert.equal(view.renderer.root.findByType('textarea').props.value, '');
  assert.equal(view.renderer.root.findAll((node) => node.props['aria-hidden'] === true).length, 2);
  view.close();
});

test('touch double-tap confirms once, while scrolling/cancelled gestures do not', () => {
  setup();
  const view = mount();
  const touch = (time, y = 10) => event({ pointerType: 'touch', clientX: 10, clientY: y, timeStamp: time });
  act(() => {
    view.options()[0].props.onPointerDown(touch(0));
    view.options()[0].props.onPointerMove(touch(30, 50));
    view.options()[0].props.onPointerUp(touch(60, 50));
    view.options()[0].props.onPointerDown(touch(90));
    view.options()[0].props.onPointerCancel();
    view.options()[0].props.onPointerUp(touch(100));
  });
  assert.equal(view.calls.length, 0);
  act(() => {
    for (const time of [300, 480]) {
      view.options()[0].props.onPointerDown(touch(time));
      view.options()[0].props.onPointerUp(touch(time + 30));
    }
    view.options()[0].props.onDoubleClick(event());
  });
  assert.deepEqual(view.calls, [['none', 'First answer']]);
  view.close();
});

test('waiting blocks preview/confirmation and does not restart for a new answer object', () => {
  setup({ waitTime: '2' });
  const originalInterval = globalThis.setInterval;
  const originalClear = globalThis.clearInterval;
  let tick;
  let timers = 0;
  globalThis.setInterval = (callback) => { tick = callback; return ++timers; };
  globalThis.clearInterval = () => {};
  try {
    const view = mount();
    act(() => { view.options()[0].props.onClick(event()); view.options()[0].props.onDoubleClick(event()); });
    assert.equal(view.calls.length, 0);
    assert.equal(view.options()[0].props['aria-pressed'], false);
    act(() => view.renderer.update(React.createElement(AnswerCard, { question: { ...question, answer: { ...question.answer } } })));
    assert.equal(timers, 1);
    act(() => { tick(); tick(); });
    assert.equal(view.options()[0].props['aria-disabled'], false);
    view.close();
  } finally {
    globalThis.setInterval = originalInterval;
    globalThis.clearInterval = originalClear;
  }
});

test('settings persist legacy keys; defaults, disabled, zero and invalid values are handled', () => {
  setup({});
  assert.equal(getAnswerWaitSeconds(), 5);
  let renderer;
  act(() => { renderer = create(React.createElement(AnswerWaitSettings)); });
  const input = () => renderer.root.findAllByType('input');
  act(() => input()[1].props.onChange({ target: { valueAsNumber: 12 } }));
  assert.equal(getAnswerWaitSeconds(), 12);
  act(() => input()[0].props.onChange({ target: { checked: false } }));
  assert.equal(getAnswerWaitSeconds(), 0);
  assert.equal(input()[1].props.disabled, true);
  act(() => renderer.unmount());
  for (const invalid of ['NaN', '-1', '31', '1.5']) {
    localStorage.setItem('enableWaitTime', 'true');
    localStorage.setItem('waitTime', invalid);
    assert.equal(getAnswerWaitSeconds(), 5);
  }
  localStorage.setItem('waitTime', '0');
  assert.equal(getAnswerWaitSeconds(), 0);
});

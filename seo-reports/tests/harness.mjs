// محاكي مصغّر لبيئة نود الكود في n8n — بيشغّل الكود المولّد نفسه
// (من dist/) مش نسخة تانية منه، عشان الاختبار يقيس اللي هيترفع فعلاً.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, '..', 'dist');

const cache = new Map();
export function loadWorkflow(name) {
  if (!cache.has(name)) {
    cache.set(name, JSON.parse(fs.readFileSync(path.join(DIST, `${name}.json`), 'utf8')));
  }
  return cache.get(name);
}

export function nodeCode(workflowName, nodeName) {
  const wf = loadWorkflow(workflowName);
  const n = wf.nodes.find((x) => x.name === nodeName);
  if (!n) throw new Error(`نود مش موجود: ${nodeName}`);
  if (!n.parameters?.jsCode) throw new Error(`${nodeName} مش نود كود`);
  return n.parameters.jsCode;
}

// items: أي حاجة تتحط في مخرجات نود — إما [{json,...}] أو [plainObject]
const wrap = (items) => (items || []).map((it) => (it && it.json !== undefined ? it : { json: it }));

/**
 * runNode({ workflow, node, nodes, input })
 *   nodes: { 'Config': [ {...} ], 'GSC Query': [ {json, pairedItem} ] }
 *   input: مصفوفة عناصر المدخل (لو مش متحطة بتتاخد من nodes[<المدخل>])
 */
export function runNode({ workflow, node, nodes = {}, input = [] }) {
  const store = {};
  for (const [k, v] of Object.entries(nodes)) store[k] = wrap(v);
  const inItems = wrap(input);

  const proxy = (name) => {
    if (!(name in store)) {
      throw new Error(`Referenced node is unexecuted: ${name}`);
    }
    const items = store[name];
    return {
      all: () => items,
      first: () => items[0],
      last: () => items[items.length - 1],
      item: items[0],
    };
  };

  const $input = {
    all: () => inItems,
    first: () => inItems[0],
    last: () => inItems[inItems.length - 1],
    item: inItems[0],
  };

  const js = nodeCode(workflow, node);
  // eslint-disable-next-line no-new-func
  const fn = new Function('$', '$input', '$json', `${js}\n`);
  const out = fn(proxy, $input, inItems[0] ? inItems[0].json : {});
  return wrap(out);
}

// ---------------------------------------------------------------- أدوات فحص
let passed = 0;
const failures = [];

export function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push({ name, error: e });
    console.error(`  ✗ ${name}\n      ${e.message}`);
  }
}

export function group(name, fn) {
  console.log(`\n${name}`);
  fn();
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'التوقّع مااتحققش');
}

export function equal(actual, expected, msg) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg || 'قيمة مختلفة'}\n      المتوقع: ${b}\n      الفعلي : ${a}`);
}

export function summary() {
  console.log(`\n${failures.length ? '✗' : '✓'} نجح ${passed} اختبار، فشل ${failures.length}`);
  return failures.length;
}

// ---------------------------------------------------------------- فيكستشرز
export const gscRow = (page, position, impressions, clicks = 0) =>
  ({ keys: [page], position, impressions, clicks, ctr: 0 });

export const okResponse = (rows, pairedItem) => ({ json: { rows }, pairedItem });
export const emptyResponse = (pairedItem) => ({ json: {}, pairedItem });
export const errResponse = (msg, pairedItem) => ({ json: { error: msg }, pairedItem });

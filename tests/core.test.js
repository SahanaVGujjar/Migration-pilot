'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { topologicalSort, calculateDepths, buildGraph } = require('../dist/graph/dependency-graph');
const { SymbolRegistry } = require('../dist/graph/symbol-registry');
const { assembleDependencyStubs, estimateTokens } = require('../dist/token/budget');
const { buildPrompt, getSystemPrompt } = require('../dist/llm/prompt-builder');
const { jsToTsProfile } = require('../dist/profiles/js-to-ts');

describe('topologicalSort', () => {
  test('orders dependencies before dependents', () => {
    const files = ['index.js', 'utils/math.js', 'services/api.js'];
    const graph = buildGraph(files, '/project', (file) => {
      if (file === 'index.js') return ['services/api.js'];
      if (file === 'services/api.js') return ['utils/math.js'];
      return [];
    });

    const order = graph.migrationOrder;
    assert.ok(order.indexOf('utils/math.js') < order.indexOf('services/api.js'));
    assert.ok(order.indexOf('services/api.js') < order.indexOf('index.js'));
  });
});

describe('SymbolRegistry', () => {
  test('stores and retrieves export stubs', () => {
    const registry = new SymbolRegistry();
    registry.register('utils/math.js', 'utils/math.ts', [
      { name: 'add', kind: 'function', signature: 'add(a: number, b: number): number' },
    ]);

    const stubs = registry.getStubsForImports(['utils/math.js']);
    assert.equal(stubs.length, 1);
    assert.equal(stubs[0].exports[0].name, 'add');
  });

  test('hash changes when exports change', () => {
    const registry = new SymbolRegistry();
    registry.register('a.js', 'a.ts', [{ name: 'x', kind: 'const', signature: 'const x' }]);
    const h1 = registry.hash();
    registry.register('b.js', 'b.ts', [{ name: 'y', kind: 'const', signature: 'const y' }]);
    const h2 = registry.hash();
    assert.notEqual(h1, h2);
  });
});

describe('token budget', () => {
  test('estimateTokens uses char heuristic', () => {
    assert.equal(estimateTokens('hello'), 2);
    assert.equal(estimateTokens('a'.repeat(400)), 100);
  });

  test('assembleDependencyStubs respects max tokens', () => {
    const stubs = [
      {
        modulePath: 'utils/math.ts',
        exports: [
          { name: 'add', kind: 'function', signature: 'add(a: number, b: number): number' },
          { name: 'subtract', kind: 'function', signature: 'subtract(a: number, b: number): number' },
        ],
      },
    ];

    const result = assembleDependencyStubs(stubs, 50);
    assert.ok(result.stubTokens <= 50);
    assert.ok(result.stubs.length <= 1);
  });
});

describe('prompt builder', () => {
  test('builds prompt with stubs not full files', () => {
    const prompt = buildPrompt(jsToTsProfile, {
      sourceLanguage: 'JavaScript',
      targetLanguage: 'TypeScript',
      migrationRules: jsToTsProfile.rules,
      dependencyStubs: [
        {
          modulePath: 'utils/math.ts',
          exports: [{ name: 'add', kind: 'function', signature: 'add(a, b): number' }],
        },
      ],
      sourceCode: 'export function main() { return add(1, 2); }',
      sourcePath: 'index.js',
    });

    assert.match(prompt, /utils\/math\.ts/);
    assert.match(prompt, /add\(a, b\): number/);
    assert.doesNotMatch(prompt, /export function add/);
    assert.equal(getSystemPrompt().includes('JSON'), true);
  });
});

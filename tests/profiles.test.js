'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { RuleEngine } = require('../dist/transform/rule-engine');
const { getProfile } = require('../dist/profiles/registry');

describe('migration profiles', () => {
  const engine = new RuleEngine();

  test('js-to-ts converts require and module.exports', () => {
    const profile = getProfile('js-to-ts');
    const source = `
const x = require('./foo');
module.exports = { bar: 1 };
`;
    const result = engine.apply(profile, 'test.js', source);
    assert.match(result.code, /import x from/);
    assert.match(result.code, /export default/);
    assert.equal(result.targetPath, 'test.ts');
  });

  test('ts-to-js strips type annotations', () => {
    const profile = getProfile('ts-to-js');
    const source = `
export function greet(name: string): string {
  return name;
}
export interface User { id: number; }
`;
    const result = engine.apply(profile, 'test.ts', source);
    assert.doesNotMatch(result.code, /: string/);
    assert.doesNotMatch(result.code, /interface User/);
    assert.equal(result.targetPath, 'test.js');
  });

  test('class-to-hooks flags class components for LLM', () => {
    const profile = getProfile('class-to-hooks');
    const source = `
import React from 'react';
class MyComponent extends React.Component {
  render() { return <div>{this.props.name}</div>; }
}
`;
    const result = engine.apply(profile, 'MyComponent.jsx', source);
    assert.equal(result.needsLLM, true);
  });
});

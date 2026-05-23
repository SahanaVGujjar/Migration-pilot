'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { CodeParser } = require('../dist/graph/parser');
const { buildGraph } = require('../dist/graph/dependency-graph');
const { getProfile } = require('../dist/profiles/registry');

describe('Python/Java polyglot parser', () => {
  const parser = new CodeParser();

  test('extracts Python imports', () => {
    const files = new Set(['utils/math_utils.py', 'services/api_client.py', 'main.py']);
    const imports = parser.extractImports(
      'from utils.math_utils import add\nfrom services.api_client import ApiClient',
      'main.py',
      files
    );
    assert.ok(imports.includes('utils/math_utils.py'));
    assert.ok(imports.includes('services/api_client.py'));
  });

  test('builds dependency order for Python project', () => {
    const files = [
      'utils/math_utils.py',
      'utils/validators.py',
      'services/api_client.py',
      'services/user_service.py',
      'main.py',
    ];
    const fileSet = new Set(files);
    const graph = buildGraph(files, '/project', (file) => {
      const fs = require('fs');
      const path = require('path');
      const full = path.join(__dirname, '../test/fixtures/sample-python-project/src', file);
      if (!fs.existsSync(full)) return [];
      const content = fs.readFileSync(full, 'utf-8');
      return parser.extractImports(content, file, fileSet);
    });
    assert.ok(graph.migrationOrder.indexOf('utils/math_utils.py') < graph.migrationOrder.indexOf('main.py'));
  });

  test('python-to-java and java-to-python profiles exist', () => {
    assert.equal(getProfile('python-to-java').id, 'python-to-java');
    assert.equal(getProfile('java-to-python').id, 'java-to-python');
    assert.equal(getProfile('python-to-java').requiresLLM, true);
  });
});

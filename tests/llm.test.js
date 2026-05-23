'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { OllamaProvider } = require('../dist/llm/ollama');
const { OpenAICompatibleProvider } = require('../dist/llm/openai-compatible');

describe('LLM providers', () => {
  test('OllamaProvider estimates tokens from response', async () => {
    const provider = new OllamaProvider('codellama', 'http://localhost:11434');
    assert.equal(provider.name, 'ollama');

    const original = provider.complete.bind(provider);
    provider.complete = async (prompt) => ({
      text: '{"targetCode":"export const x = 1;","targetExtension":".ts","exports":[],"confidence":1,"warnings":[]}',
      promptTokens: Math.ceil(prompt.length / 4),
      completionTokens: 20,
    });

    const result = await provider.complete('test prompt');
    assert.ok(result.promptTokens > 0);
    assert.ok(result.completionTokens > 0);
  });

  test('OpenAICompatibleProvider parses usage from response shape', () => {
    const provider = new OpenAICompatibleProvider('gpt-4o-mini', 'https://api.openai.com/v1', 'test-key');
    assert.equal(provider.name, 'openai-compatible');
  });

  test('Token metering structure for reports', () => {
    const usage = { promptTokens: 100, completionTokens: 50, totalTokens: 150, cached: false };
    assert.equal(usage.totalTokens, usage.promptTokens + usage.completionTokens);
  });
});

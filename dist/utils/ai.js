"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIAssistant = void 0;
const http = __importStar(require("http"));
class AIAssistant {
    constructor(model = 'codellama', baseUrl = 'http://localhost:11434') {
        this.available = false;
        this.model = model;
        this.baseUrl = baseUrl;
    }
    async checkAvailability() {
        try {
            const response = await this.httpGet(`${this.baseUrl}/api/tags`);
            this.available = response.includes(this.model);
            return this.available;
        }
        catch {
            this.available = false;
            return false;
        }
    }
    isAvailable() {
        return this.available;
    }
    async inferTypes(code, functionName) {
        if (!this.available)
            return [];
        const prompt = `Analyze this JavaScript function and infer TypeScript types for all parameters and return values. 
Return ONLY a JSON array with objects containing: variableName, inferredType, confidence (0-1), reasoning.
Do not include any other text, just the JSON array.

Function:
\`\`\`javascript
${code}
\`\`\``;
        try {
            const response = await this.generate(prompt);
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        catch {
            // AI inference failed, fall back to basic types
        }
        return [];
    }
    async inferInterfaceFromUsage(objectAccesses, variableName) {
        if (!this.available)
            return null;
        const prompt = `Given these property accesses on a variable named "${variableName}":
${objectAccesses.map((a) => `- ${a}`).join('\n')}

Generate a TypeScript interface for this variable. Return ONLY the interface definition, no explanation.`;
        try {
            const response = await this.generate(prompt);
            const interfaceMatch = response.match(/interface[\s\S]*?\}/);
            if (interfaceMatch) {
                return interfaceMatch[0];
            }
        }
        catch {
            // AI inference failed
        }
        return null;
    }
    async suggestTypeForValue(value, context) {
        if (!this.available)
            return 'any';
        const prompt = `What TypeScript type best describes this value: ${value}
Context: ${context}
Return ONLY the type (e.g., "string", "number", "string[]", etc.), nothing else.`;
        try {
            const response = await this.generate(prompt);
            const cleaned = response.trim().replace(/[`"']/g, '');
            if (cleaned.length < 100)
                return cleaned;
        }
        catch {
            // fallback
        }
        return 'any';
    }
    async generate(prompt) {
        const payload = JSON.stringify({
            model: this.model,
            prompt,
            stream: false,
            options: {
                temperature: 0.1,
                num_predict: 500,
            },
        });
        return new Promise((resolve, reject) => {
            const url = new URL(`${this.baseUrl}/api/generate`);
            const req = http.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                },
                timeout: 30000,
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed.response || '');
                    }
                    catch {
                        reject(new Error('Failed to parse AI response'));
                    }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('AI request timed out'));
            });
            req.write(payload);
            req.end();
        });
    }
    httpGet(url) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            http
                .get({
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname,
                timeout: 5000,
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => resolve(data));
            })
                .on('error', reject);
        });
    }
}
exports.AIAssistant = AIAssistant;
//# sourceMappingURL=ai.js.map
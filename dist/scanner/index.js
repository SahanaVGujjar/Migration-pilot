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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodebaseScanner = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const IGNORE_DIRS = [
    'node_modules', 'dist', 'build', '.git', 'coverage',
    '.next', '.nuxt', '__pycache__', '.migration-pilot',
];
const EXTENSION_MAP = {
    'js-to-ts': ['.js', '.jsx'],
    'class-to-hooks': ['.jsx', '.tsx', '.js', '.ts'],
};
class CodebaseScanner {
    constructor(targetDir, migrationType) {
        this.targetDir = path.resolve(targetDir);
        this.migrationType = migrationType;
    }
    async scan() {
        const spinner = (0, ora_1.default)('Scanning codebase...').start();
        const extensions = EXTENSION_MAP[this.migrationType];
        const patterns = extensions.map((ext) => `**/*${ext}`);
        let files = [];
        for (const pattern of patterns) {
            const matches = await (0, glob_1.glob)(pattern, {
                cwd: this.targetDir,
                ignore: IGNORE_DIRS.map((d) => `${d}/**`),
                absolute: false,
            });
            files.push(...matches);
        }
        // Deduplicate
        files = [...new Set(files)];
        spinner.text = `Found ${files.length} files. Building dependency graph...`;
        const graph = this.buildDependencyGraph(files);
        spinner.succeed(`Scanned ${chalk_1.default.cyan(files.length.toString())} files, found ${chalk_1.default.cyan(graph.roots.length.toString())} root files`);
        return graph;
    }
    buildDependencyGraph(files) {
        const nodes = new Map();
        // Create nodes for all files
        for (const file of files) {
            const fullPath = path.join(this.targetDir, file);
            nodes.set(file, {
                filePath: fullPath,
                relativePath: file,
                imports: [],
                importedBy: [],
                depth: 0,
                status: 'pending',
            });
        }
        // Parse imports for each file
        for (const file of files) {
            const fullPath = path.join(this.targetDir, file);
            try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const imports = this.extractImports(content, file);
                const node = nodes.get(file);
                node.imports = imports.filter((imp) => nodes.has(imp));
                for (const imp of node.imports) {
                    const importedNode = nodes.get(imp);
                    if (importedNode) {
                        importedNode.importedBy.push(file);
                    }
                }
            }
            catch {
                // skip unreadable files
            }
        }
        // Calculate depth (distance from leaves)
        this.calculateDepths(nodes);
        // Find root files (not imported by anything)
        const roots = files.filter((f) => {
            const node = nodes.get(f);
            return node.importedBy.length === 0;
        });
        // Topological sort for migration order (leaves first)
        const migrationOrder = this.topologicalSort(nodes, files);
        return { nodes, roots, migrationOrder };
    }
    extractImports(content, fromFile) {
        const imports = [];
        const dir = path.dirname(fromFile);
        // ES module imports: import X from './path'
        const esImportRegex = /import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
        let match;
        while ((match = esImportRegex.exec(content)) !== null) {
            const resolved = this.resolveImportPath(match[1], dir);
            if (resolved)
                imports.push(resolved);
        }
        // CommonJS require: const X = require('./path')
        const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = requireRegex.exec(content)) !== null) {
            const resolved = this.resolveImportPath(match[1], dir);
            if (resolved)
                imports.push(resolved);
        }
        // Dynamic imports: import('./path')
        const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = dynamicImportRegex.exec(content)) !== null) {
            const resolved = this.resolveImportPath(match[1], dir);
            if (resolved)
                imports.push(resolved);
        }
        return [...new Set(imports)];
    }
    resolveImportPath(importPath, fromDir) {
        // Skip node_modules / package imports
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
            return null;
        }
        const resolved = path.normalize(path.join(fromDir, importPath));
        const extensions = ['.js', '.jsx', '.ts', '.tsx', ''];
        for (const ext of extensions) {
            const candidate = resolved + ext;
            const fullPath = path.join(this.targetDir, candidate);
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                return candidate;
            }
        }
        // Try index files
        for (const ext of extensions) {
            const candidate = path.join(resolved, `index${ext}`);
            const fullPath = path.join(this.targetDir, candidate);
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                return candidate;
            }
        }
        return null;
    }
    calculateDepths(nodes) {
        const visited = new Set();
        const calcDepth = (file) => {
            if (visited.has(file))
                return nodes.get(file).depth;
            visited.add(file);
            const node = nodes.get(file);
            if (node.imports.length === 0) {
                node.depth = 0;
                return 0;
            }
            let maxDepth = 0;
            for (const imp of node.imports) {
                if (nodes.has(imp)) {
                    maxDepth = Math.max(maxDepth, calcDepth(imp) + 1);
                }
            }
            node.depth = maxDepth;
            return maxDepth;
        };
        for (const file of nodes.keys()) {
            calcDepth(file);
        }
    }
    topologicalSort(nodes, files) {
        const visited = new Set();
        const order = [];
        const inProgress = new Set();
        const visit = (file) => {
            if (visited.has(file) || inProgress.has(file))
                return;
            inProgress.add(file);
            const node = nodes.get(file);
            for (const imp of node.imports) {
                if (nodes.has(imp)) {
                    visit(imp);
                }
            }
            inProgress.delete(file);
            visited.add(file);
            order.push(file);
        };
        for (const file of files) {
            visit(file);
        }
        return order;
    }
}
exports.CodebaseScanner = CodebaseScanner;
//# sourceMappingURL=index.js.map
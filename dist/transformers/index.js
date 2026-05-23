"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransformer = createTransformer;
const js_to_ts_1 = require("./js-to-ts");
const class_to_hooks_1 = require("./class-to-hooks");
function createTransformer(type, ai) {
    switch (type) {
        case 'js-to-ts':
            return new js_to_ts_1.JsToTsTransformer(ai);
        case 'class-to-hooks':
            return new class_to_hooks_1.ClassToHooksTransformer();
        default:
            throw new Error(`Unknown migration type: ${type}`);
    }
}
//# sourceMappingURL=index.js.map
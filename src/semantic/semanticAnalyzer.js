import { Diagnostic } from "../core/diagnostic.js";

export default class SemanticAnalyzer {
    constructor(source, externals = {}, externalSignatures = {}) {
        this.source = source
        this.scopes = [];
        this.externals = externals; // { AI: fn }
        this.externalSignatures = externalSignatures;
        this.currentReturnType = null;
    }

    analyze(ast) {
        this.enterScope();
        this.visit(ast);
        this.exitScope();
    }


    // Scope Handling
    enterScope() {
        this.scopes.push(new Map());
    }
    exitScope() {
        this.scopes.pop();
    }



    declare(name, type) {
        const currentScope = this.scopes[this.scopes.length - 1];

        if (currentScope.has(name)) {
            throw new Error(`Variable "${name}" already declared in this scope`);
        }

        currentScope.set(name, type);
    }

    resolve(name) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) {
                return this.scopes[i].get(name);
            }
        }

        if (this.externals[name]) {
            return "external";
        }

        throw new Error(`Undeclared variable "${name}"`);
    }


    // Visitor
    visit(node) {
        switch (node.type) {

            case "Program":
                node.body.forEach(stmt => this.visit(stmt));
                break;

            case "VariableDeclaration": {
                this.declare(node.id.name, "unknown");  // pre-declare
                const initType = this.visit(node.init);
                this.scopes[this.scopes.length - 1].set(node.id.name, initType);
                break;
            }

            case "Identifier":
                return this.resolve(node.name);

            case "Literal":
                return typeof node.value;

            case "BinaryExpression": {
                const leftType = this.visit(node.left);
                const rightType = this.visit(node.right);
                const op = node.operator;

                // Arithmetic
                if (["+", "-", "*", "/"].includes(op)) {
                    if (leftType !== "number" || rightType !== "number") {
                        this.error(`Arithmetic operators require numbers`, node);
                    }
                    return "number";
                }

                // Comparison
                if ([">", "<", ">=", "<="].includes(op)) {
                    if (leftType !== "number" || rightType !== "number") {
                        this.error(`Comparison operators require numbers`, node);
                    }
                    return "boolean";
                }

                // Equality
                if (["==", "!="].includes(op)) {
                    if (leftType !== rightType) {
                        this.error(`Equality operands must be same type`, node);
                    }
                    return "boolean";
                }

                // Logical
                if (["&&", "||"].includes(op)) {
                    if (leftType !== "boolean" || rightType !== "boolean") {
                        this.error(`Logical operators require booleans`, node);
                    }
                    return "boolean";
                }

                this.error(`Unknown operator ${op}`, node);
            }

            case "UnaryExpression": {
                const argType = this.visit(node.argument);
                if (node.operator === "-" && argType !== "number")
                    this.error("Unary '-' requires a number", node);
                if (node.operator === "!" && argType !== "boolean")
                    this.error("Unary '!' requires a boolean", node);
                return argType;
            }

            case "IfStatement": {
                const testType = this.visit(node.test);

                if (testType !== "boolean") {
                    this.error("If condition must be boolean", node);
                }

                const consequentReturn = this.analyzeBranch(node.consequent);
                let alternateReturn = null;

                if (node.alternate) {
                    alternateReturn = this.analyzeBranch(node.alternate);
                }

                if (consequentReturn && alternateReturn) {
                    if (consequentReturn !== alternateReturn) {
                        this.error(
                            `Mismatched return types in branches: ${consequentReturn} vs ${alternateReturn}`, node
                        );
                    }
                    return consequentReturn;
                }

                return null;
            }
            case "HttpStatement":
                break; // or  URL validation later

            case "BlockStatement":
                this.enterScope();
                node.body.forEach(stmt => this.visit(stmt));
                this.exitScope();
                break;

            case "ReturnStatement": {
                const returnType = this.visit(node.argument);
                this.currentReturnType = returnType;
                return returnType;
            }

            case "CallExpression": {
                if (node.callee.type !== "Identifier") {
                    this.error("Invalid function call", node);
                }

                const fnName = node.callee.name;

                if (!this.externals[fnName]) {
                    this.error(`Unknown function "${fnName}"`);
                }

                const signature = this.externalSignatures[fnName];

                if (signature) {
                    if (node.arguments.length !== signature.params.length) {
                        this.error(`Invalid argument count for ${fnName}`, node);
                    }

                    node.arguments.forEach((arg, i) => {
                        const argType = this.visit(arg);
                        const expectedType = signature.params[i];

                        if (expectedType !== "any" && argType !== expectedType) {
                            this.error(
                                `Argument ${i + 1} of ${fnName} must be ${expectedType}, got ${argType}`, node
                            );
                        }
                    });

                    return signature.returns;
                }

                return "unknown";
            }

            default:
                break;
        }
    }
    analyzeBranch(node) {
        if (!node) return null;

        // Case 1: BlockStatement
        if (node.type === "BlockStatement") {
            let returnType = null;

            this.enterScope();

            for (const stmt of node.body) {
                if (stmt.type === "ReturnStatement") {
                    const type = this.visit(stmt);

                    if (!returnType) {
                        returnType = type;
                    } else if (returnType !== type) {
                        this.error(
                            `Inconsistent return types inside branch: ${returnType} vs ${type}`, node
                        );
                    }
                } else {
                    this.visit(stmt);
                }
            }

            this.exitScope();
            return returnType;
        }

        // Case 2: else-if (nested IfStatement)
        if (node.type === "IfStatement") {
            return this.visit(node);
        }

        // Case 3: single statement (defensive)
        return this.visit(node);
    }



    // error helper

    error(message, node) {
        throw new Diagnostic(message, node, this.source)
    };
}
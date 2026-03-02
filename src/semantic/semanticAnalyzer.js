export default class SemanticAnalyzer {
    constructor(externals = {}, externalSignatures = {}) {
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
                const initType = this.visit(node.init);
                this.declare(node.id.name, initType);
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
                        throw new Error(`Arithmetic operators require numbers`);
                    }
                    return "number";
                }

                // Comparison
                if ([">", "<", ">=", "<="].includes(op)) {
                    if (leftType !== "number" || rightType !== "number") {
                        throw new Error(`Comparison operators require numbers`);
                    }
                    return "boolean";
                }

                // Equality
                if (["==", "!="].includes(op)) {
                    if (leftType !== rightType) {
                        throw new Error(`Equality operands must be same type`);
                    }
                    return "boolean";
                }

                // Logical
                if (["&&", "||"].includes(op)) {
                    if (leftType !== "boolean" || rightType !== "boolean") {
                        throw new Error(`Logical operators require booleans`);
                    }
                    return "boolean";
                }

                throw new Error(`Unknown operator ${op}`);
            }

            case "UnaryExpression":
                return this.visit(node.argument);

            case "IfStatement": {
                const testType = this.visit(node.test);

                if (testType !== "boolean") {
                    throw new Error("If condition must be boolean");
                }

                const consequentReturn = this.analyzeBranch(node.consequent);
                let alternateReturn = null;

                if (node.alternate) {
                    alternateReturn = this.analyzeBranch(node.alternate);
                }

                if (consequentReturn && alternateReturn) {
                    if (consequentReturn !== alternateReturn) {
                        throw new Error(
                            `Mismatched return types in branches: ${consequentReturn} vs ${alternateReturn}`
                        );
                    }
                    return consequentReturn;
                }

                return null;
            }

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
                    throw new Error("Invalid function call");
                }

                const fnName = node.callee.name;

                if (!this.externals[fnName]) {
                    throw new Error(`Unknown function "${fnName}"`);
                }

                const signature = this.externalSignatures[fnName];

                if (signature) {
                    if (node.arguments.length !== signature.params.length) {
                        throw new Error(`Invalid argument count for ${fnName}`);
                    }

                    node.arguments.forEach((arg, i) => {
                        const argType = this.visit(arg);
                        const expectedType = signature.params[i];

                        if (expectedType !== "any" && argType !== expectedType) {
                            throw new Error(
                                `Argument ${i + 1} of ${fnName} must be ${expectedType}, got ${argType}`
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
                    throw new Error(
                        `Inconsistent return types inside branch: ${returnType} vs ${type}`
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
}
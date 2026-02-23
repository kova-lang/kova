export default class Interpreter {
    constructor(externals = {}) {
        this.scopes = [];
        this.output = [];
        this.externals = externals; // deterministic external calls
        this.returnValue = undefined;
        this.shouldReturn = false;
    }

    interpret(ast) {
        this.enterScope(); // global scope
        this.visit(ast);
        this.exitScope();
        return {
            returnValue: this.returnValue,
            output: this.output
        };
    }

    // Scope Management ####
    enterScope() {
        this.scopes.push(new Map());
    }

    exitScope() {
        this.scopes.pop();
    }

    declare(name, value) {
        const current = this.scopes[this.scopes.length - 1];
        current.set(name, value);
    }

    resolve(name) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) {
                return this.scopes[i].get(name);
            }
        }
        throw new Error(`Undefined variable ${name}`);
    }

    // Visitor Execution ####
    visit(node) {
        if (this.shouldReturn) return;

        switch (node.type) {

            case "Program":
                for (const stmt of node.body) {
                    this.visit(stmt);
                    if (this.shouldReturn) break;
                }
                break;

            case "VariableDeclaration":
                const value = this.visit(node.init);
                this.declare(node.id.name, value);
                break;

            case "Identifier":
                return this.resolve(node.name);

            case "Literal":
                return node.value;

            case "BinaryExpression":
                return this.evaluateBinary(node);

            case "UnaryExpression":
                return this.evaluateUnary(node);

            case "BlockStatement":
                this.enterScope();
                for (const stmt of node.body) {
                    this.visit(stmt);
                    if (this.shouldReturn) break;
                }
                this.exitScope();
                break;

            case "IfStatement":
                const condition = this.visit(node.test);
                if (condition) {
                    this.visit(node.consequent);
                } else if (node.alternate) {
                    this.visit(node.alternate);
                }
                break;

            case "ReturnStatement":
                this.returnValue = this.visit(node.argument);
                this.shouldReturn = true;
                break;

            case "ExpressionStatement":
                return this.visit(node.expression);

            case "HttpStatement":
                this.output.push(`[HTTP MOCK] ${node.method} → ${node.url}`);
                break;

            case "CallExpression":
                return this.executeExternal(node);

            default:
                throw new Error(`Unknown node type: ${node.type}`);
        }
    }

    // Evaluation Helpers ####    
    evaluateBinary(node) {
        const left = this.visit(node.left);
        const right = this.visit(node.right);

        switch (node.operator) {
            case "+": return left + right;
            case "-": return left - right;
            case "*": return left * right;
            case "/": return left / right;
            case "==": return left === right;
            case "!=": return left !== right;
            case ">": return left > right;
            case "<": return left < right;
            case ">=": return left >= right;
            case "<=": return left <= right;
            case "&&": return left && right;
            case "||": return left || right;
            default:
                throw new Error(`Unknown operator ${node.operator}`);
        }
    }

    evaluateUnary(node) {
        const value = this.visit(node.argument);
        switch (node.operator) {
            case "-": return -value;
            case "!": return !value;
            default:
                throw new Error(`Unknown unary operator ${node.operator}`);
        }
    }

    executeExternal(node) {
        const fnName = node.callee.name;
        const args = node.arguments.map(arg => this.visit(arg));

        if (!this.externals[fnName]) {
            throw new Error(`Unknown external function ${fnName}`);
        }

        return this.externals[fnName](...args);
    }
}
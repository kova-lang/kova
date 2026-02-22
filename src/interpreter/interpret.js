export default class Interpreter {
    constructor() {
        this.scopes = [];
    }

    interpret(ast) {
        this.enterScope(); // global scope
        this.visit(ast);
        this.exitScope();
    }

  
    // Scope Management
  

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

  
    // Visitor Execution
  

    visit(node) {
        switch (node.type) {

            case "Program":
                node.body.forEach(stmt => this.visit(stmt));
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
                node.body.forEach(stmt => this.visit(stmt));
                this.exitScope();
                break;

            case "IfStatement":
                const condition = this.visit(node.test);
                if (condition) {
                    this.visit(node.consequent);
                }
                break;

            case "ExpressionStatement":
                return this.visit(node.expression);

            case "HttpStatement":
                return this.mockHttp(node);

            default:
                throw new Error(`Unknown node type: ${node.type}`);
        }
    }

  
    // Evaluation Helpers
  

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

    mockHttp(node) {
        console.log(`[HTTP MOCK] ${node.method} → ${node.url}`);
        return null;
    }
}
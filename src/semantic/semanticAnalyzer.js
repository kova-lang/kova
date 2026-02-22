export default class SemanticAnalyzer {
    constructor() {
        this.scopes = [];
    }

    // main analyzer ####
    analyze(ast) {
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

    declare(name) {
        const currentScope = this.scopes[this.scopes.length - 1];

        if (currentScope.has(name)) {
            throw new Error(`Variable "${name}" already declared in this scope`);
        }

        currentScope.set(name, true);
    }

    resolve(name) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) {
                return true;
            }
        }

        throw new Error(`Undeclared variable "${name}"`);
    }

    // Visitor


    visit(node) {
        switch (node.type) {

            case "Program":
                node.body.forEach(stmt => this.visit(stmt));
                break;

            case "VariableDeclaration":
                this.visit(node.init);
                this.declare(node.id.name);
                break;

            case "Identifier":
                this.resolve(node.name);
                break;

            case "BlockStatement":
                this.enterScope();
                node.body.forEach(stmt => this.visit(stmt));
                this.exitScope();
                break;

            case "IfStatement":
                this.visit(node.test);
                this.visit(node.consequent);
                break;

            case "ExpressionStatement":
                this.visit(node.expression);
                break;

            case "BinaryExpression":
                this.visit(node.left);
                this.visit(node.right);
                break;

            case "UnaryExpression":
                this.visit(node.argument);
                break;

            case "Literal":
                break;

            case "HttpStatement":
                break;

            default:
                throw new Error(`Unknown node type: ${node.type}`);
        }
    }
}
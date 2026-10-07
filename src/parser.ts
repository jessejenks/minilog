import type { Clause, Constant, Directive, Functor, Program, Query, Term } from "./ast";
import * as ast from "./ast";
import { Token, Tokenizer, TokenKind, tokenKindToString } from "./tokenizer";

const ARG_RBP = 4;

const INFIX_BP = {
	[TokenKind.Semi]: [2, 1],
	[TokenKind.Comma]: [4, 3],
	[TokenKind.Equal]: [5, 5],
} as const;

export class Parser {
	protected freshID: number = 0;
	protected stream: Tokenizer = new Tokenizer();

	parse(input: string): Program {
		this.stream.setInput(input);
		const prog: Program = [];
		while (!this.stream.eof()) {
			const tok: Token = this.stream.peek();
			switch (tok.kind) {
				case TokenKind.Comment:
					this.stream.next();
					prog.push(ast.comment(tok.line));
					break;
				case TokenKind.QuestionDash:
					prog.push(this.query());
					break;
				case TokenKind.ColonDash:
					prog.push(this.directive());
					break;
				default:
					prog.push(this.clause());
					break;
			}
		}
		return prog;
	}

	protected query(): Query {
		this.expect(TokenKind.QuestionDash);
		const term = this.term();
		this.expect(TokenKind.Period);
		return ast.query(term);
	}

	protected directive(): Directive {
		this.expect(TokenKind.ColonDash);
		const term = this.term();
		this.expect(TokenKind.Period);
		return ast.directive(term);
	}

	protected clause(): Clause {
		const head = this.constantOrFunctor();
		let body: Term | null = null;
		if (this.stream.peek().kind === TokenKind.ColonDash) {
			this.stream.next();
			body = this.term();
		}
		this.expect(TokenKind.Period);
		return ast.clause(head, body);
	}

	protected term(): Term {
		return this.termBp(0);
	}

	protected termBp(minBp: number): Term {
		let left: Term;
		switch (this.stream.peek().kind) {
			case TokenKind.LParen:
				this.stream.next();
				left = this.termBp(0);
				this.expect(TokenKind.RParen);
				break;
			default:
				left = this.primary();
				break;
		}

		while (true) {
			const tok = this.stream.peek();
			switch (tok.kind) {
				case TokenKind.Comma:
				case TokenKind.Semi:
				case TokenKind.Equal:
					break;
				default:
					return left;
			}

			const [lbp, rbp] = INFIX_BP[tok.kind];
			if (lbp <= minBp) {
				break;
			}
			this.stream.next();
			const right = this.termBp(rbp);
			switch (tok.kind) {
				case TokenKind.Comma:
					left = ast.conjunction(left, right);
					break;
				case TokenKind.Semi:
					left = ast.disjunction(left, right);
					break;
				case TokenKind.Equal:
					left = ast.equality(left, right);
					if (this.stream.peek().kind === TokenKind.Equal) {
						throw new Error("Parse error, = is non-associative");
					}
					break;
			}
		}
		return left;
	}

	protected primary(): Term {
		const tok = this.stream.peek();
		if (tok.kind === TokenKind.Constant) {
			return this.constantOrFunctor();
		}
		if (tok.kind === TokenKind.Variable) {
			this.stream.next();
			if (tok.name === "_") {
				return ast.variable(this.fresh());
			}
			return ast.variable(tok.name);
		}
		throw new Error(`Expected constant or variable, got ${tokenKindToString(tok.kind)}`);
	}

	protected fresh(): string {
		return `_${this.freshID++}`;
	}

	protected constantOrFunctor(): Constant | Functor {
		const c = this.expect(TokenKind.Constant);
		if (this.stream.peek().kind === TokenKind.LParen) {
			this.stream.next();
			const args: Term[] = [this.termBp(ARG_RBP)];
			while (this.stream.peek().kind === TokenKind.Comma) {
				this.stream.next();
				args.push(this.termBp(ARG_RBP));
			}
			this.expect(TokenKind.RParen);
			return ast.functor(c.name, ...args);
		}
		return ast.constant(c.name);
	}

	protected expect<T extends TokenKind>(kind: T): Token & { kind: T } {
		const tok = this.stream.next();
		if (tok.kind !== kind) {
			throw new Error(`Parse error, expected ${tokenKindToString(kind)} but got ${tokenKindToString(tok.kind)}`);
		}
		return tok as Token & { kind: T };
	}
}

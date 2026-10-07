export const enum TokenKind {
	EOF,
	Variable,
	Constant,
	LParen,
	RParen,
	Comma,
	Period,
	Equal,
	Semi,
	ColonDash,
	QuestionDash,
}

export function tokenKindToString(kind: TokenKind) {
	switch (kind) {
		case TokenKind.EOF:
			return "<eof>";
		case TokenKind.Variable:
			return "variable";
		case TokenKind.Constant:
			return "constant";
		case TokenKind.LParen:
			return "(";
		case TokenKind.RParen:
			return ")";
		case TokenKind.Comma:
			return ",";
		case TokenKind.Period:
			return ".";
		case TokenKind.Equal:
			return "=";
		case TokenKind.Semi:
			return ";";
		case TokenKind.ColonDash:
			return ":-";
		case TokenKind.QuestionDash:
			return "?-";
	}
}

export type Position = { index: number; row: number; col: number };
export type Span = [Position, Position];
export type Token =
	| { kind: TokenKind.EOF }
	| ({ kind: TokenKind.Variable | TokenKind.Constant; name: string } & { span: Span })
	| ({ kind: Exclude<TokenKind, TokenKind.Variable | TokenKind.Constant> } & { span: Span });

export class Tokenizer {
	protected index: number = 0;
	protected row: number = 1;
	protected col: number = 1;
	protected currToken: Token | null = null;
	protected input: string = "";

	setInput(input: string) {
		this.index = 0;
		this.row = 1;
		this.col = 1;
		this.currToken = null;
		this.input = input;
	}

	eof(): boolean {
		if (this.currToken !== null) {
			return this.currToken.kind === TokenKind.EOF;
		}
		this.skipTrivia();
		return this.index >= this.input.length;
	}

	peek(): Token {
		if (this.currToken === null) {
			this.currToken = this.getNextToken();
		}
		return this.currToken;
	}

	next(): Token {
		if (this.currToken === null) {
			return this.getNextToken();
		}
		const node = this.currToken;
		this.currToken = null;
		return node;
	}

	protected getNextToken(): Token {
		if (this.eof()) {
			return { kind: TokenKind.EOF };
		}

		const start = this.pos();
		switch (this.char()) {
			case "(":
				this.advance();
				return { kind: TokenKind.LParen, span: [start, this.pos()] };
			case ")":
				this.advance();
				return { kind: TokenKind.RParen, span: [start, this.pos()] };
			case ",":
				this.advance();
				return { kind: TokenKind.Comma, span: [start, this.pos()] };
			case ".":
				this.advance();
				return { kind: TokenKind.Period, span: [start, this.pos()] };
			case ";":
				this.advance();
				return { kind: TokenKind.Semi, span: [start, this.pos()] };
			case "=":
				this.advance();
				return { kind: TokenKind.Equal, span: [start, this.pos()] };
			case ":":
				if (this.charPeek() === "-") {
					this.advance();
					this.advance();
					return { kind: TokenKind.ColonDash, span: [start, this.pos()] };
				}
				break;
			case "?":
				if (this.charPeek() === "-") {
					this.advance();
					this.advance();
					return { kind: TokenKind.QuestionDash, span: [start, this.pos()] };
				}
				break;
		}
		return this.identifier();
	}

	protected pos(): Position {
		return { index: this.index, row: this.row, col: this.col };
	}

	protected identifier(): Token {
		const start = this.pos();
		let c = this.char();
		if (("A" <= c && c <= "Z") || c === "_") {
			this.advance();
			c = this.char();
			while (("A" <= c && c <= "Z") || ("a" <= c && c <= "z") || c === "_") {
				this.advance();
				c = this.char();
			}
			return { kind: TokenKind.Variable, name: this.input.slice(start.index, this.index), span: [start, this.pos()] };
		}

		if ("a" <= c && c <= "z") {
			this.advance();
			c = this.char();
			while (("A" <= c && c <= "Z") || ("a" <= c && c <= "z") || c === "_") {
				this.advance();
				c = this.char();
			}
			return { kind: TokenKind.Constant, name: this.input.slice(start.index, this.index), span: [start, this.pos()] };
		}

		throw new Error(`Tokenizer error @ (${start.row}, ${start.col})`);
	}

	protected skipTrivia() {
		while (true) {
			this.skipWhiteSpace();
			if (this.char() === "%") {
				this.advance();
				while (this.index < this.input.length && this.char() !== "\n") {
					this.advance();
				}
				continue;
			}
			break;
		}
	}

	protected skipWhiteSpace() {
		while (this.index < this.input.length) {
			switch (this.char()) {
				case " ":
				case "\t":
				case "\r":
					this.advance();
					break;
				case "\n":
					this.advanceLine();
					break;
				default:
					return;
			}
		}
	}

	protected char(): string {
		return this.input[this.index];
	}

	protected charPeek(): string {
		return this.input[this.index + 1];
	}

	protected advance() {
		this.index++;
		this.col++;
	}

	protected advanceLine() {
		this.index++;
		this.row++;
		this.col = 1;
	}
}

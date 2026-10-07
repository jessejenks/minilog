export const enum TokenKind {
	EOF,
	Comment,
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
		case TokenKind.Comment:
			return "<comment>";
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

export type Token =
	| { kind: TokenKind.Comment; line: string }
	| { kind: TokenKind.Variable | TokenKind.Constant; name: string }
	| { kind: Exclude<TokenKind, TokenKind.Comment | TokenKind.Variable | TokenKind.Constant> };

export class Tokenizer {
	protected index: number = 0;
	protected row: number = 1;
	protected col: number = 1;
	protected currToken: Token | null = null;
	protected input: string = "";

	setInput(input: string) {
		this.index = 0;
		this.currToken = null;
		this.input = input;
	}

	eof(): boolean {
		if (this.currToken !== null) {
			return this.currToken.kind === TokenKind.EOF;
		}
		this.skipWhiteSpace();
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

		switch (this.char()) {
			case 40:
				this.advance();
				return { kind: TokenKind.LParen };
			case 41:
				this.advance();
				return { kind: TokenKind.RParen };
			case 44:
				this.advance();
				return { kind: TokenKind.Comma };
			case 46:
				this.advance();
				return { kind: TokenKind.Period };
			case 59:
				this.advance();
				return { kind: TokenKind.Semi };
			case 61:
				this.advance();
				return { kind: TokenKind.Equal };
			case 58:
				if (this.charPeek() === 45) {
					this.advance();
					this.advance();
					return { kind: TokenKind.ColonDash };
				}
				break;
			case 63:
				if (this.charPeek() === 45) {
					this.advance();
					this.advance();
					return { kind: TokenKind.QuestionDash };
				}
				break;
			case 37:
				return this.comment();
		}
		return this.identifier();
	}

	protected comment(): Token {
		const start = this.index;
		while (this.index < this.input.length && this.char() !== 10) {
			this.advance();
		}
		return { kind: TokenKind.Comment, line: this.input.slice(start, this.index) };
	}

	protected identifier(): Token {
		const start = this.index;
		let c = this.char();
		if ((65 <= c && c <= 90) || c === 95) {
			this.advance();
			c = this.char();
			while ((65 <= c && c <= 90) || (97 <= c && c <= 122) || c === 95) {
				this.advance();
				c = this.char();
			}
			return { kind: TokenKind.Variable, name: this.input.slice(start, this.index) };
		}

		if (97 <= c && c <= 122) {
			this.advance();
			c = this.char();
			while ((65 <= c && c <= 90) || (97 <= c && c <= 122) || c === 95) {
				this.advance();
				c = this.char();
			}
			return { kind: TokenKind.Constant, name: this.input.slice(start, this.index) };
		}
		throw new Error(`Tokenizer error @ (${this.row}, ${this.col})`);
	}

	protected skipWhiteSpace() {
		while (this.index < this.input.length) {
			switch (this.char()) {
				case 9:
				case 13:
				case 32:
					this.advance();
					break;
				case 10:
					this.advanceLine();
					break;
				default:
					return;
			}
		}
	}

	protected char(): number {
		return this.input.charCodeAt(this.index);
	}

	protected charPeek(): number {
		return this.input.charCodeAt(this.index + 1);
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

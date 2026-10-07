export const enum TermKind {
	Variable,
	Constant,
	Functor,
	Equality,
	Conjunction,
	Disjunction,
	Clause,
	Query,
	Directive,
	Comment,
}

export type Variable = { kind: TermKind.Variable; name: string };

export type Constant = { kind: TermKind.Constant; name: string };

export type Functor = {
	kind: TermKind.Functor;
	name: string;
	args: Term[];
};

export type Equality = {
	kind: TermKind.Equality;
	left: Term;
	right: Term;
};

export type Conjunction = {
	kind: TermKind.Conjunction;
	left: Term;
	right: Term;
};

export type Disjunction = {
	kind: TermKind.Disjunction;
	left: Term;
	right: Term;
};

export function variable(name: string): Variable {
	return { kind: TermKind.Variable, name };
}

export function constant(name: string): Constant {
	return { kind: TermKind.Constant, name };
}

export function functor(name: string, ...args: Term[]): Functor {
	return { kind: TermKind.Functor, name, args };
}

export function equality(left: Term, right: Term): Equality {
	return {
		kind: TermKind.Equality,
		left,
		right,
	};
}

export function conjunction(left: Term, right: Term): Conjunction {
	return {
		kind: TermKind.Conjunction,
		left,
		right,
	};
}

export function disjunction(left: Term, right: Term): Disjunction {
	return {
		kind: TermKind.Disjunction,
		left,
		right,
	};
}

export type Term = Variable | Constant | Functor | Equality | Conjunction | Disjunction;

export type Clause = {
	kind: TermKind.Clause;
	head: Constant | Functor;
	body: Term | null;
};

export type Query = {
	kind: TermKind.Query;
	term: Term;
};

export type Directive = {
	kind: TermKind.Directive;
	term: Term;
};

export type Comment = { kind: TermKind.Comment; line: string };

export function clause(head: Constant | Functor, body: Term | null = null): Clause {
	return { kind: TermKind.Clause, head, body };
}

export function query(term: Term): Query {
	return { kind: TermKind.Query, term };
}

export function directive(term: Term): Directive {
	return { kind: TermKind.Directive, term };
}

export function comment(line: string): Comment {
	return { kind: TermKind.Comment, line };
}

export type Statement = Query | Clause | Directive | Comment;

export type Program = Statement[];

export function isClause(line: Statement): line is Clause {
	return line.kind === TermKind.Clause;
}

export function isQuery(line: Statement): line is Query {
	return line.kind === TermKind.Query;
}

export function isDirective(line: Statement): line is Directive {
	return line.kind === TermKind.Directive;
}

export function isComment(line: Statement): line is Comment {
	return line.kind === TermKind.Comment;
}

export function termToString(term: Term): string {
	switch (term.kind) {
		case TermKind.Variable:
		case TermKind.Constant:
			return term.name;
		case TermKind.Functor:
			return `${term.name}(${term.args.map(termToString).join(", ")})`;
		case TermKind.Equality:
			return `(${termToString(term.left)} = ${termToString(term.right)})`;
		case TermKind.Conjunction:
			return `(${termToString(term.left)}, ${termToString(term.right)})`;
		case TermKind.Disjunction:
			return `(${termToString(term.left)}; ${termToString(term.right)})`;
	}
}

export function clauseToString(clause: Clause): string {
	if (clause.body) {
		return `${termToString(clause.head)} :- ${termToString(clause.body)}.`;
	}
	return `${termToString(clause.head)}.`;
}

export function queryToString(query: Query): string {
	return `?- ${termToString(query.term)}.`;
}

export function directiveToString(directive: Directive): string {
	return `:- ${termToString(directive.term)}.`;
}

export function programToString(program: Program): string {
	return program
		.map((c) => {
			switch (c.kind) {
				case TermKind.Clause:
					return clauseToString(c);
				case TermKind.Query:
					return queryToString(c);
				case TermKind.Directive:
					return directiveToString(c);
				case TermKind.Comment:
					return c.line;
			}
		})
		.join("\n");
}

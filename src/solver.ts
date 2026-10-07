import * as ast from "./ast";
import { LIBRARIES } from "./library";
import { Parser } from "./parser";
import { Result } from "./result";
import * as unification from "./unification";

export function termToUnificationTerm(term: ast.Term): unification.Term {
	switch (term.kind) {
		case ast.TermKind.Variable:
			return unification.variable(term.name);
		case ast.TermKind.Constant:
			return unification.operation(term.name, []);
		case ast.TermKind.Functor:
			return unification.operation(term.name, term.args.map(termToUnificationTerm));
		case ast.TermKind.Equality:
			return unification.operation("=", [termToUnificationTerm(term.left), termToUnificationTerm(term.right)]);
		case ast.TermKind.Conjunction:
			return unification.operation(",", [termToUnificationTerm(term.left), termToUnificationTerm(term.right)]);
		case ast.TermKind.Disjunction:
			return unification.operation(";", [termToUnificationTerm(term.left), termToUnificationTerm(term.right)]);
	}
}

const CONTROL = new Set(["true/0", "false/0", ",/2", ";/2", "=/2", "not/1", "write/1", "nl/0"]);

export class Solver {
	protected freshID: number;
	protected database: Map<string, [unification.Term, unification.Term | null][]>;
	protected loaded: Set<string>;

	constructor(protected output: (text: string) => void) {
		this.freshID = 0;
		this.database = new Map();
		this.loaded = new Set();
	}

	directive(directive: ast.Directive): boolean {
		const { term } = directive;
		if (term.kind === ast.TermKind.Functor && term.name === "use_module") {
			const [arg] = term.args;
			if (
				term.args.length !== 1 ||
				arg.kind !== ast.TermKind.Functor ||
				arg.name !== "library" ||
				arg.args.length !== 1 ||
				arg.args[0].kind !== ast.TermKind.Constant
			) {
				throw new Error(`Expected use_module(library(name)), got ${ast.termToString(term)}`);
			}
			this.useLibrary(arg.args[0].name);
			return true;
		}
		return !this.prove([termToUnificationTerm(term)], new Map()).next().done;
	}

	protected useLibrary(name: string) {
		if (this.loaded.has(name)) {
			return;
		}
		const source = LIBRARIES.get(name);
		if (source === undefined) {
			throw new Error(`Unknown library ${name}`);
		}
		this.loaded.add(name);
		for (const statement of new Parser().parse(source)) {
			if (ast.isClause(statement)) {
				this.insert(statement);
			}
		}
	}

	insert(clause: ast.Clause) {
		const key = `${clause.head.name}/${clause.head.kind === ast.TermKind.Constant ? 0 : clause.head.args.length}`;
		if (CONTROL.has(key)) {
			throw new Error(`${key} is reserved!`);
		}
		const goals = this.database.get(key) ?? [];
		goals.push([termToUnificationTerm(clause.head), clause.body === null ? null : termToUnificationTerm(clause.body)]);
		this.database.set(key, goals);
	}

	protected query(term: unification.Operation): [unification.Term, unification.Term | null][] {
		const key = `${term.name}/${term.args.length}`;
		return this.database.get(key) ?? [];
	}

	protected freshenTerm(term: unification.Term, renaming: Map<string, string>): unification.Term {
		switch (term.kind) {
			case unification.TermKind.Variable:
				if (!renaming.has(term.name)) {
					renaming.set(term.name, `${term.name}_${this.freshID++}`);
				}
				return unification.variable(renaming.get(term.name)!);
			case unification.TermKind.Operation:
				return unification.operation(
					term.name,
					term.args.map((arg) => this.freshenTerm(arg, renaming)),
				);
		}
	}

	protected freshenClause([head, body]: [unification.Term, unification.Term | null]): [
		unification.Term,
		body: unification.Term | null,
	] {
		const renaming = new Map();
		return [this.freshenTerm(head, renaming), body ? this.freshenTerm(body, renaming) : null];
	}

	protected static compose(old: unification.Substitution, fresh: unification.Substitution): unification.Substitution {
		const result = new Map<string, unification.Term>();
		for (const [x, t] of old) {
			result.set(x, unification.apply(fresh, t));
		}
		for (const [x, t] of fresh) {
			if (!result.has(x)) result.set(x, t);
		}
		return result;
	}

	protected *prove(
		goals: unification.Term[],
		substitution: unification.Substitution,
	): Generator<unification.Substitution> {
		if (goals.length === 0) {
			yield substitution;
			return;
		}

		const [goal, ...remainingGoals] = goals;
		let term = goal;
		if (term.kind === unification.TermKind.Variable) {
			const originalName = term.name;
			term = unification.apply(substitution, term);
			if (term.kind === unification.TermKind.Variable) {
				throw new Error(`Could not resolve ${originalName}`);
			}
		}
		switch (`${term.name}/${term.args.length}`) {
			case "true/0":
				yield* this.prove(remainingGoals, substitution);
				return;
			case "false/0":
				return;
			case ",/2":
				yield* this.prove([term.args[0], term.args[1], ...remainingGoals], substitution);
				return;
			case ";/2":
				yield* this.prove([term.args[0], ...remainingGoals], substitution);
				yield* this.prove([term.args[1], ...remainingGoals], substitution);
				return;
			case "=/2": {
				const unificationResult = unification.unify([
					[unification.apply(substitution, term.args[0]), unification.apply(substitution, term.args[1])],
				]);
				if (Result.isErr(unificationResult)) {
					return;
				}
				yield* this.prove(remainingGoals, Solver.compose(substitution, unificationResult.value));
				return;
			}
			case "not/1":
				if (this.prove(term.args, substitution).next().done) {
					yield* this.prove(remainingGoals, substitution);
				}
				return;
			case "write/1":
				this.output(unification.termToString(unification.apply(substitution, term.args[0])));
				yield* this.prove(remainingGoals, substitution);
				return;
			case "nl/0":
				this.output("\n");
				yield* this.prove(remainingGoals, substitution);
				return;
			default: {
				const clauses = this.query(term);
				for (let i = 0; i < clauses.length; i++) {
					const [head, body] = this.freshenClause(clauses[i]);
					const unificationResult = unification.unify([
						[unification.apply(substitution, term), unification.apply(substitution, head)],
					]);
					if (Result.isErr(unificationResult)) {
						continue;
					}
					yield* this.prove(
						body ? [body, ...remainingGoals] : remainingGoals,
						Solver.compose(substitution, unificationResult.value),
					);
				}
				return;
			}
		}
	}

	*solve(query: ast.Query) {
		yield* this.prove([termToUnificationTerm(query.term)], new Map());
	}
}

function findQueryVariables(term: ast.Term, seen: Set<string>) {
	switch (term.kind) {
		case ast.TermKind.Variable:
			if (!term.name.startsWith("_")) {
				seen.add(term.name);
			}
			break;
		case ast.TermKind.Constant:
			break;
		case ast.TermKind.Functor:
			for (let i = 0; i < term.args.length; i++) {
				findQueryVariables(term.args[i], seen);
			}
			break;
		case ast.TermKind.Equality:
		case ast.TermKind.Conjunction:
		case ast.TermKind.Disjunction:
			findQueryVariables(term.left, seen);
			findQueryVariables(term.right, seen);
			break;
	}
}

export function formatSolution(term: ast.Term, substitution: unification.Substitution): string {
	const found = new Set<string>();
	findQueryVariables(term, found);

	const valueOf = (name: string) => substitution.get(name) ?? unification.variable(name);

	const names = Array.from(found);
	const aliases = new Map<string, string[]>();
	for (const name of names) {
		const value = valueOf(name);
		if (value.kind !== unification.TermKind.Variable) {
			continue;
		}
		const group = aliases.get(value.name) ?? [];
		group.push(name);
		aliases.set(value.name, group);
	}

	const canonical = new Map<string, string>();
	for (const [variable, group] of aliases) {
		canonical.set(variable, group[group.length - 1]);
	}

	let nextID = 0;
	function rename(t: unification.Term): unification.Term {
		switch (t.kind) {
			case unification.TermKind.Variable:
				if (!canonical.has(t.name)) {
					canonical.set(t.name, `_G${nextID++}`);
				}
				return unification.variable(canonical.get(t.name)!);
			case unification.TermKind.Operation:
				return unification.operation(t.name, t.args.map(rename));
		}
	}

	const bindings: string[] = [];
	for (const name of names) {
		const value = valueOf(name);
		if (value.kind === unification.TermKind.Variable) {
			const group = aliases.get(value.name)!;
			const i = group.indexOf(name);
			if (i < group.length - 1) {
				bindings.push(`${name} = ${group[i + 1]}`);
			}
			continue;
		}
		bindings.push(`${name} = ${unification.termToString(rename(value))}`);
	}
	return bindings.length > 0 ? bindings.join(", ") : "true";
}

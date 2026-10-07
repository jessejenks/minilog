import { deepStrictEqual } from "node:assert";
import test, { suite } from "node:test";
import { ast, parser as parse, solver as solve } from "../src";

const cases: [string, string[], string][] = [
	["?- true.", ["true"], ""],
	["?- false.", [], ""],
	["?- X = Y.", ["X = Y"], ""],
	["?- X = f(X) ; true.", ["true"], ""],
	[
		`mortal(X) :- man(X).
        man(socrates).
        ?- mortal(socrates).`,
		["true"],
		"",
	],
	[
		`% example from Wikipedia
        mother_child(trude, sally).
        father_child(tom, sally).
        father_child(tom, erica).
        father_child(mike, tom).
        parent_child(X, Y) :- father_child(X, Y).
        parent_child(X, Y) :- mother_child(X, Y).
        sibling(X, Y) :- parent_child(Z, X), parent_child(Z, Y), not(X = Y).
        ?- sibling(erica, X).`,
		["X = sally"],
		"",
	],
	[
		`p(X, X).
        ?- p(a, Y),
        p(b, Z).`,
		["Y = a, Z = b"],
		"",
	],
	[
		`p(X, Y) :- Y = b.
        ?- p(a, X).`,
		["X = b"],
		"",
	],
	["?- not(not(X = a)).", ["true"], ""],
	["p(a). p(b). p(c). ?- p(X), X = c.", ["X = c"], ""],
	["p(a). p(b). p(c). ?- p(X), write(X), nl, false.", [], "a\nb\nc\n"],
	[
		`:- use_module(library(lists)).
        % run backwards: every way to split a list
        ?- append(X, Y, cons(a, cons(b, nil))).`,
		["X = nil, Y = cons(a, cons(b, nil))", "X = cons(a, nil), Y = cons(b, nil)", "X = cons(a, cons(b, nil)), Y = nil"],
		"",
	],
];

suite("Solver", () => {
	for (const [input, expected, expectedOutput] of cases) {
		const [firstLine] = input.split("\n", 1);
		const isTruncated = firstLine.length > 20 || firstLine.length < input.length;
		test(`Solves '${firstLine.slice(0, 20)}${isTruncated ? "..." : ""}'`, () => {
			const parser = new parse.Parser();
			const program = parser.parse(input);
			const output: string[] = [];
			const solver = new solve.Solver((x) => output.push(x));
			for (const statement of program) {
				if (ast.isComment(statement)) continue;
				if (ast.isDirective(statement)) {
					solver.directive(statement);
					continue;
				}
				if (ast.isClause(statement)) {
					solver.insert(statement);
					continue;
				}
				// only expect 1 query per test
				const solutions = Array.from(solver.solve(statement)).map((solution) =>
					solve.formatSolution(statement.term, solution),
				);
				deepStrictEqual(solutions, expected);
			}
			deepStrictEqual(output.join(""), expectedOutput);
		});
	}
});

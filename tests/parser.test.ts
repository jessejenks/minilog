import { deepStrictEqual, throws } from "node:assert";
import test, { suite } from "node:test";
import type { Program } from "../src/ast";
import {
	clause,
	comment,
	conjunction,
	constant,
	directive,
	disjunction,
	equality,
	functor,
	query,
	variable,
} from "../src/ast";
import { Parser } from "../src/parser";

const cases: [string, Program][] = [
	["?- true.", [query(constant("true"))]],
	["?- false.", [query(constant("false"))]],
	["?- X = Y.", [query(equality(variable("X"), variable("Y")))]],
	["?- X = f(X); true.", [query(disjunction(equality(variable("X"), functor("f", variable("X"))), constant("true")))]],
	[
		"?- X = (f(X); true).",
		[query(equality(variable("X"), disjunction(functor("f", variable("X")), constant("true"))))],
	],
	[":- true.", [directive(constant("true"))]],
	[
		"sibling(X,Y) :- parent_child(Z,X), parent_child(Z,Y), not(X = Y).",
		[
			clause(
				functor("sibling", variable("X"), variable("Y")),
				conjunction(
					functor("parent_child", variable("Z"), variable("X")),
					conjunction(
						functor("parent_child", variable("Z"), variable("Y")),
						functor("not", equality(variable("X"), variable("Y"))),
					),
				),
			),
		],
	],

	// in Prolog, operators are right associating
	["?- a, b, c.", [query(conjunction(constant("a"), conjunction(constant("b"), constant("c"))))]],
	["?- a; b; c.", [query(disjunction(constant("a"), disjunction(constant("b"), constant("c"))))]],
	["?- a, b; c.", [query(disjunction(conjunction(constant("a"), constant("b")), constant("c")))]],
	["?- a; b, c.", [query(disjunction(constant("a"), conjunction(constant("b"), constant("c"))))]],
	[
		"?- X = a, Y = b.",
		[query(conjunction(equality(variable("X"), constant("a")), equality(variable("Y"), constant("b"))))],
	],

	// parentheses
	["?- (a; b), c.", [query(conjunction(disjunction(constant("a"), constant("b")), constant("c")))]],
	["?- ((a)).", [query(constant("a"))]],
	["?- (X = Y) = Z.", [query(equality(equality(variable("X"), variable("Y")), variable("Z")))]],

	// arguments
	["?- f(a, b).", [query(functor("f", constant("a"), constant("b")))]],
	["?- f((a, b)).", [query(functor("f", conjunction(constant("a"), constant("b"))))]],
	["?- f(X = Y).", [query(functor("f", equality(variable("X"), variable("Y"))))]],
	[
		"?- f(g(X), h(a, Y)).",
		[query(functor("f", functor("g", variable("X")), functor("h", constant("a"), variable("Y"))))],
	],

	// identifiers
	// completely anonymous variables always freshened
	["?- f(_, _).", [query(functor("f", variable("_0"), variable("_1")))]],
	["?- f(_A, _A).", [query(functor("f", variable("_A"), variable("_A")))]],
	["snake_case(X_y).", [clause(functor("snake_case", variable("X_y")))]],

	// comments
	["% hi\nfoo.", [comment("% hi"), clause(constant("foo"))]],
	["foo. % hi\nbar.", [clause(constant("foo")), comment("% hi"), clause(constant("bar"))]],
	["foo.\n% no trailing newline", [clause(constant("foo")), comment("% no trailing newline")]],

	[
		"foo :- true.\nbar(X) :-\n\tbaz(X),\n\tqux.\n?- bar(Y).",
		[
			clause(constant("foo"), constant("true")),
			clause(functor("bar", variable("X")), conjunction(functor("baz", variable("X")), constant("qux"))),
			query(functor("bar", variable("Y"))),
		],
	],
];

suite("Parser", () => {
	for (const [input, expected] of cases) {
		const [firstLine] = input.split("\n", 1);
		const isTruncated = firstLine.length > 20 || firstLine.length < input.length;
		test(`Parses '${firstLine.slice(0, 20)}${isTruncated ? "..." : ""}'`, () => {
			const p = new Parser();
			const parsed = p.parse(input);
			deepStrictEqual(parsed, expected);
		});
	}
});

const errors: string[] = [
	"?- X = Y = Z.",
	"foo",
	"foo().",
	"foo(a.",
	"?- .",
	"?- f(a; b).", // needs parentheses: f((a; b))
	"?- #.",
	"X :- foo.",
];

suite("Parser errors", () => {
	for (const input of errors) {
		test(`Rejects '${input}'`, () => {
			const p = new Parser();
			throws(() => p.parse(input));
		});
	}
});

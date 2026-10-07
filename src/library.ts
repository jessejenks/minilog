export const LIBRARIES = new Map<string, string>([
	[
		"lists",
		`
append(nil, L, L).
append(cons(H, T), L, cons(H, R)) :- append(T, L, R).

member(X, cons(X, _)).
member(X, cons(_, T)) :- member(X, T).

reverse(L, R) :- reverse_acc(L, nil, R).
reverse_acc(nil, Acc, Acc).
reverse_acc(cons(H, T), Acc, R) :- reverse_acc(T, cons(H, Acc), R).
`,
	],
]);

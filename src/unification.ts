import { Result } from "./result";
import { UnionFind } from "./union-find";

export const enum TermKind {
	Variable,
	Operation,
}
export type Variable = { kind: TermKind.Variable; name: string };

export type Operation = {
	kind: TermKind.Operation;
	name: string;
	args: Term[];
};

export const variable = (name: string): Variable => ({ kind: TermKind.Variable, name });

export const operation = (name: string, args: Term[]): Operation => ({
	kind: TermKind.Operation,
	name,
	args,
});

export type Term = Variable | Operation;

export function termToString(term: Term): string {
	switch (term.kind) {
		case TermKind.Variable:
			return term.name;
		case TermKind.Operation:
			if (term.args.length === 0) {
				return term.name;
			}
			return `${term.name}(${term.args.map(termToString).join(", ")})`;
	}
}

export type Substitution = Map<string, Term>;

export function apply(substitution: Substitution, term: Term): Term {
	switch (term.kind) {
		case TermKind.Variable:
			return substitution.get(term.name) ?? term;
		case TermKind.Operation:
			return {
				kind: TermKind.Operation,
				name: term.name,
				args: term.args.map((arg) => apply(substitution, arg)),
			};
	}
}

export type Equation = [Term, Term];

export type IDTerm =
	| { kind: TermKind.Variable; name: string; id: number }
	| {
			kind: TermKind.Operation;
			name: string;
			id: number;
			argIDs: number[];
	  };

function reconstruct(id: number, m: Map<number, IDTerm>, uf: UnionFind, seen: Set<number>): Term {
	const repID = uf.find(id);
	if (seen.has(repID)) {
		throw new Error("occurs check");
	}
	const rep = m.get(repID)!;
	switch (rep.kind) {
		case TermKind.Variable:
			return { kind: TermKind.Variable, name: rep.name };
		case TermKind.Operation:
			seen.add(repID);
			const args = rep.argIDs.map((argID) => reconstruct(argID, m, uf, seen));
			seen.delete(repID);
			return {
				kind: TermKind.Operation,
				name: rep.name,
				args: args,
			};
	}
}

export function unify(equations: Equation[]): Result<Substitution, string> {
	const variableByName = new Map<string, number>();
	let nextID = 0;
	const termByID = new Map<number, IDTerm>();
	function convertTerm(term: Term): IDTerm {
		switch (term.kind) {
			case TermKind.Variable: {
				if (variableByName.has(term.name)) {
					return termByID.get(variableByName.get(term.name)!)!;
				}
				const id = nextID++;
				variableByName.set(term.name, id);
				const v: IDTerm = {
					kind: TermKind.Variable,
					name: term.name,
					id,
				};
				termByID.set(id, v);
				return v;
			}
			case TermKind.Operation: {
				const id = nextID++;
				const op: IDTerm = {
					kind: TermKind.Operation,
					name: term.name,
					argIDs: term.args.map((arg) => convertTerm(arg).id),
					id,
				};
				termByID.set(id, op);
				return op;
			}
		}
	}

	const eqs: [number, number][] = new Array(equations.length);
	for (let i = 0; i < equations.length; i++) {
		const [left, right] = equations[i];
		const leftConverted = convertTerm(left);
		const rightConverted = convertTerm(right);
		eqs[i] = [leftConverted.id, rightConverted.id];
	}

	const disjointSets = new UnionFind(nextID);

	while (eqs.length > 0) {
		const [leftID, rightID] = eqs.pop()!;
		const leftRepresentativeID = disjointSets.find(leftID);
		const rightRepresentativeID = disjointSets.find(rightID);
		if (leftRepresentativeID === rightRepresentativeID) {
			// delete
			continue;
		}
		const left = termByID.get(leftRepresentativeID)!;
		const right = termByID.get(rightRepresentativeID)!;
		if (left.kind === TermKind.Variable) {
			// occurs check
			// happens during term reconstruction
			// eliminate
			disjointSets.union(leftRepresentativeID, rightRepresentativeID);
			const newRep = disjointSets.get(leftRepresentativeID);
			termByID.set(newRep, right.kind === TermKind.Operation ? right : left);
		} else if (right.kind === TermKind.Variable) {
			// swap
			eqs.push([rightRepresentativeID, leftRepresentativeID]);
		} else {
			// conflict
			if (left.name !== right.name || left.argIDs.length !== right.argIDs.length) {
				return Result.Err(`Not Unifiable (conflict) ${left.name} ${right.name}`);
			}
			disjointSets.union(leftRepresentativeID, rightRepresentativeID);
			const newRep = disjointSets.get(leftRepresentativeID);
			termByID.set(newRep, right);
			// decompose
			eqs.push(...left.argIDs.map((argID, i) => [argID, right.argIDs[i]] as [number, number]));
		}
	}

	const results = new Map<string, Term>();
	for (const [x, id] of variableByName) {
		try {
			const term = reconstruct(id, termByID, disjointSets, new Set());
			results.set(x, term);
		} catch {
			return Result.Err("Occurs check failed");
		}
	}

	return Result.Ok(results);
}

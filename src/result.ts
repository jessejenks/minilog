export type Result<T, E> = Result.Ok<T> | Result.Err<E>;

export namespace Result {
	export const enum Kind {
		Ok,
		Err,
	}
	export type Ok<T> = { kind: Kind.Ok; value: T };
	export type Err<E> = { kind: Kind.Err; error: E };

	export function Ok<T>(value: T): Ok<T> {
		return { kind: Kind.Ok, value };
	}
	export function Err<E>(error: E): Err<E> {
		return { kind: Kind.Err, error };
	}

	export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
		return r.kind === Kind.Ok;
	}

	export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
		return r.kind === Kind.Err;
	}
}

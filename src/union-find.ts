export class UnionFind {
	protected parent: number[];
	protected ranks: number[];

	constructor(capacity: number) {
		this.parent = Array.from({ length: capacity }).map((_, i) => i);
		this.ranks = Array.from({ length: capacity }).map(() => 0);
	}

	get(x: number): number {
		return this.parent[x];
	}

	find(x: number): number {
		if (this.parent[x] != x) {
			this.parent[x] = this.find(this.parent[x]);
		}
		return this.parent[x];
	}

	union(x: number, y: number) {
		const px = this.find(x);
		const py = this.find(y);
		if (px === py) {
			return;
		}
		if (this.ranks[px] < this.ranks[py]) {
			this.parent[px] = py;
		} else if (this.ranks[px] > this.ranks[py]) {
			this.parent[py] = px;
		} else {
			this.parent[py] = px;
			this.ranks[px]++;
		}
	}
}

// ============================================================================
//  MinHeap — Estructura de datos para obtener los TOP K resultados más rápidos
//  Mantiene solo los mejores K scores sin ordenar toda la lista.
//  Complejidad: O(n log k)  → Ideal para autocompletar y búsquedas grandes.
// ============================================================================

export class MinHeap {
    constructor(limit) {
        this.data = [];
        this.limit = limit;
    }

    push(item) {
        if (this.data.length < this.limit) {
            this.data.push(item);
            this._bubbleUp(this.data.length - 1);
            return;
        }

        // Si el nuevo score es mejor que el más bajo del heap
        if (item.score > this.data[0].score) {
            this.data[0] = item;
            this._bubbleDown(0);
        }
    }

    _bubbleUp(i) {
        while (i > 0) {
            let parent = Math.floor((i - 1) / 2);
            if (this.data[i].score >= this.data[parent].score) break;
            [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
            i = parent;
        }
    }

    _bubbleDown(i) {
        const n = this.data.length;

        while (true) {
            const left = 2 * i + 1;
            const right = 2 * i + 2;
            let smallest = i;

            if (left < n && this.data[left].score < this.data[smallest].score) smallest = left;
            if (right < n && this.data[right].score < this.data[smallest].score) smallest = right;

            if (smallest === i) break;

            [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
            i = smallest;
        }
    }

    // Regresa resultados ordenados de mayor a menor
    getSorted() {
        return this.data.sort((a, b) => b.score - a.score);
    }
}

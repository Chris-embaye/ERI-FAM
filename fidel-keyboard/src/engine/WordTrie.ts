interface TrieNode {
  children: Map<string, TrieNode>;
  word: string | null;
}

function makeNode(): TrieNode {
  return { children: new Map(), word: null };
}

export class WordTrie {
  private root = makeNode();

  insert(word: string): void {
    let node = this.root;
    for (const ch of word) {
      let child = node.children.get(ch);
      if (!child) {
        child = makeNode();
        node.children.set(ch, child);
      }
      node = child;
    }
    node.word = word;
  }

  /**
   * Returns up to `limit` words that start with `prefix`.
   * O(|prefix|) traversal + bounded DFS collection.
   */
  search(prefix: string, limit = 5): string[] {
    let node = this.root;
    for (const ch of prefix) {
      const child = node.children.get(ch);
      if (!child) return [];
      node = child;
    }

    const results: string[] = [];
    this.collect(node, results, limit);
    return results;
  }

  private collect(node: TrieNode, out: string[], limit: number): void {
    if (out.length >= limit) return;
    if (node.word !== null) out.push(node.word);
    for (const child of node.children.values()) {
      if (out.length >= limit) return;
      this.collect(child, out, limit);
    }
  }
}

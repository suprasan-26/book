class TrieNode {
    constructor() {
        this.children = {};
        this.isEndOfWord = false;
        this.placeIds = []; // Stores IDs of places matching this prefix
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode();
    }

    insert(word, placeId) {
        let node = this.root;
        for (let char of word.toLowerCase()) {
            if (!node.children[char]) {
                node.children[char] = new TrieNode();
            }
            node = node.children[char];
            node.placeIds.push(placeId); // Store place ID at each node
        }
        node.isEndOfWord = true;
    }

    search(prefix) {
        let node = this.root;
        for (let char of prefix.toLowerCase()) {
            if (!node.children[char]) return []; // No matches
            node = node.children[char];
        }
        return node.placeIds; // Return all place IDs that match the prefix
    }

    delete(word, placeId){
        this.deleteHelper(this.root, word, placeId, 0);
    }

    deleteHelper(node, word, placeId, i) {
        if (!node) return false;

        if (i == word.length) {
            node.placeIds = node.placeIds.filter(id => id != placeId);
            return node.placeIds.length === 0;
        }
        
        node.placeIds = node.placeIds.filter(id => id != placeId);

        let removeChild = this.deleteHelper(node.children[word[i]], word, placeId, i + 1);
        if (removeChild) {
            delete node.children[word[i]];
        }

        return node.placeIds.length === 0;
    }
}

export default Trie;
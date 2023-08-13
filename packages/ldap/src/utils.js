/* eslint-disable */

class TreeNode {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.children = [];
  }

  addChild(childNode) {
    this.children.push(childNode);
  }

  findNodeByKey(key) {
    if (this.key === key) {
      return this;
    }

    for (const child of this.children) {
      const foundNode = child.findNodeByKey(key);
      if (foundNode) {
        return foundNode;
      }
    }

    return null;
  }
}

function parseStringToTree(inputString) {
  const parts = inputString.split(',').reverse();
  const root = new TreeNode('Root');
  let currentNode = root;

  for (const part of parts) {
    const [key, value] = part.split('=');
    const keyTrimmed = key.trim();
    const valueTrimmed = value.trim();

    const Node = new TreeNode(keyTrimmed, valueTrimmed);

    currentNode.addChild(Node);

    currentNode = Node;
  }

  return root;
}

function printTree(node, depth = 0) {
  const indent = '  '.repeat(depth);
  console.log(`${indent}${node.key}=${node.value}`);

  for (const child of node.children) {
    printTree(child, depth + 1);
  }
}

export { parseStringToTree, printTree };

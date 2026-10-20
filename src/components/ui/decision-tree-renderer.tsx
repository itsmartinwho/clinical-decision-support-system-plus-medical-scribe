import React, { useEffect, useRef } from 'react';
import { DecisionTreeNode } from '@/lib/types';

interface DecisionTreeRendererProps {
  tree: DecisionTreeNode | any; // Allow both formats
  editable?: boolean;
  onNodeClick?: (nodeId: string) => void;
}

export const DecisionTreeRenderer: React.FC<DecisionTreeRendererProps> = ({
  tree,
  editable = false,
  onNodeClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !tree) {
      console.log('DecisionTreeRenderer: Missing container or tree data');
      return;
    }

    // Convert graph format to tree format if needed
    const treeData = convertToTreeFormat(tree);
    console.log('DecisionTreeRenderer: Converted tree data:', treeData);
    
    if (!treeData) {
      console.log('DecisionTreeRenderer: Failed to convert tree data');
      return;
    }

    // Render the tree structure
    renderSimpleTree(containerRef.current, treeData, onNodeClick);
  }, [tree, onNodeClick]);

  return (
    <div className="decision-tree-container bg-card border border-border rounded-lg p-2 sm:p-4">
      <div className="mb-2 text-sm font-medium text-ink">
        {tree?.title || 'Treatment Decision Tree'}
      </div>
      <div ref={containerRef} className="decision-tree overflow-auto max-h-96 sm:max-h-none" />
    </div>
  );
};

// Convert nodes+connections format to tree format
function convertToTreeFormat(data: any): DecisionTreeNode | null {
  // If already in tree format (has children), return as-is
  if (data.id && data.label && data.children !== undefined) {
    return data as DecisionTreeNode;
  }

  // If in graph format (has nodes and connections), convert it
  if (data.nodes && data.connections) {
    const nodes = data.nodes;
    const connections = data.connections;

    // Find the root node (usually 'start' type or first node)
    let rootNode = nodes.find((n: any) => n.type === 'start') || nodes[0];
    if (!rootNode) return null;

    // Build children for each node based on connections
    const buildChildren = (nodeId: string): DecisionTreeNode[] => {
      const outgoingConnections = connections.filter((conn: any) => conn.from === nodeId);
      return outgoingConnections.map((conn: any) => {
        const childNode = nodes.find((n: any) => n.id === conn.to);
        if (!childNode) return null;

        const convertedChild: DecisionTreeNode = {
          id: childNode.id,
          label: childNode.label,
          type: mapNodeType(childNode.type),
          condition: childNode.condition,
          action: childNode.action,
          guidelines_reference: childNode.guidelines_reference,
          children: buildChildren(childNode.id)
        };

        return convertedChild;
      }).filter(Boolean) as DecisionTreeNode[];
    };

    const rootTreeNode: DecisionTreeNode = {
      id: rootNode.id,
      label: rootNode.label,
      type: mapNodeType(rootNode.type),
      condition: rootNode.condition,
      action: rootNode.action,
      guidelines_reference: rootNode.guidelines_reference,
      children: buildChildren(rootNode.id)
    };

    return rootTreeNode;
  }

  return null;
}

// Map node types to expected types
function mapNodeType(type: string): 'condition' | 'action' | 'outcome' {
  switch (type) {
    case 'start':
    case 'action':
      return 'action';
    case 'decision':
      return 'condition';
    case 'end':
    case 'outcome':
      return 'outcome';
    default:
      return 'action';
  }
}

// Simple tree renderer (could be replaced with more sophisticated visualization)
function renderSimpleTree(
  container: HTMLElement, 
  node: DecisionTreeNode, 
  onNodeClick?: (nodeId: string) => void,
  level: number = 0
) {
  container.innerHTML = ''; // Clear previous content
  
  const treeElement = document.createElement('div');
  treeElement.className = 'tree-structure';
  
  renderNode(treeElement, node, onNodeClick, level);
  container.appendChild(treeElement);
}

function renderNode(
  container: HTMLElement,
  node: DecisionTreeNode,
  onNodeClick?: (nodeId: string) => void,
  level: number = 0
) {
  const nodeElement = document.createElement('div');
  nodeElement.className = `tree-node level-${level}`;
  // Responsive margin: smaller on mobile, larger on desktop
  const marginSize = window.innerWidth < 640 ? Math.min(level * 12, 32) : level * 20;
  nodeElement.style.marginLeft = `${marginSize}px`;
  
  // Node content
  const nodeContent = document.createElement('div');
  nodeContent.className = getNodeClassName(node.type);
  nodeContent.innerHTML = `
    <div class="node-label">${node.label}</div>
    ${node.action ? `<div class="node-action">Action: ${node.action}</div>` : ''}
    ${node.condition ? `<div class="node-condition">Condition: ${node.condition}</div>` : ''}
    ${node.guidelines_reference ? `<div class="node-reference">📋 ${node.guidelines_reference}</div>` : ''}
  `;
  
  if (onNodeClick) {
    nodeContent.style.cursor = 'pointer';
    nodeContent.addEventListener('click', () => onNodeClick(node.id));
  }
  
  nodeElement.appendChild(nodeContent);
  
  // Render children
  if (node.children && node.children.length > 0) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    
    node.children.forEach(child => {
      renderNode(childrenContainer, child, onNodeClick, level + 1);
    });
    
    nodeElement.appendChild(childrenContainer);
  }
  
  container.appendChild(nodeElement);
}

function getNodeClassName(type: 'condition' | 'action' | 'outcome'): string {
  const baseClass = 'tree-node-content p-3 mb-2 rounded-md border-l-4';
  
  switch (type) {
    case 'condition':
      return `${baseClass} border-l-yellow-500 bg-flag-soft text-flag`;
    case 'action':
      return `${baseClass} border-l-blue-500 bg-info-soft text-info`;
    case 'outcome':
      return `${baseClass} border-l-green-500 bg-ok-soft text-ok`;
    default:
      return `${baseClass} border-l-gray-500 bg-well/50 text-ink`;
  }
}

// Add CSS styles with mobile responsiveness
const treeStyles = `
  .tree-structure {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  }
  
  .tree-node {
    position: relative;
  }
  
  .tree-node-content {
    position: relative;
    transition: all 0.2s ease;
    touch-action: manipulation;
  }
  
  .tree-node-content:hover {
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transform: translateY(-1px);
  }
  
  .tree-node-content:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  }
  
  .node-label {
    font-weight: 600;
    margin-bottom: 4px;
    font-size: 0.9rem;
  }
  
  .node-action, .node-condition {
    font-size: 0.8rem;
    margin-bottom: 2px;
    line-height: 1.4;
  }
  
  .node-reference {
    font-size: 0.75rem;
    opacity: 0.8;
    margin-top: 4px;
  }
  
  .tree-children {
    margin-left: 12px;
    border-left: 2px dashed #e5e7eb;
    padding-left: 12px;
  }
  
  .tree-node::before {
    content: '';
    position: absolute;
    left: -8px;
    top: 20px;
    width: 8px;
    height: 2px;
    background: #e5e7eb;
  }
  
  /* Mobile optimizations */
  @media (max-width: 640px) {
    .tree-node-content {
      padding: 8px 12px !important;
      margin-bottom: 8px !important;
    }
    
    .node-label {
      font-size: 0.85rem;
    }
    
    .node-action, .node-condition {
      font-size: 0.75rem;
    }
    
    .node-reference {
      font-size: 0.7rem;
    }
    
    .tree-children {
      margin-left: 8px;
      padding-left: 8px;
    }
    
    .tree-node::before {
      left: -6px;
      width: 6px;
    }
  }
  
  /* Touch devices */
  @media (hover: none) and (pointer: coarse) {
    .tree-node-content {
      min-height: 44px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
  }
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('decision-tree-styles')) {
  const styleElement = document.createElement('style');
  styleElement.id = 'decision-tree-styles';
  styleElement.textContent = treeStyles;
  document.head.appendChild(styleElement);
}

export default DecisionTreeRenderer; 
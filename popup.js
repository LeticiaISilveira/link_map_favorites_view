function getDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch (e) {
    return 'outros';
  }
}

chrome.bookmarks.getTree((bookmarkTreeNodes) => {
  let allNodes = [];
  let allEdges = [];
  let domains = {};
  let nodeId = 1;

  // 1. Central Node (Brain)
  allNodes.push({ 
    id: 0, 
    label: 'Brain', 
    color: '#ff007f', 
    size: 36, 
    font: { color: '#ffffff', size: 14 },
    type: 'brain'
  });

  function traverse(node, parentId = 0) {
    if (node.children) {
      let folderId = parentId;
      
      if (node.title && node.id !== "0" && node.id !== "1" && node.id !== "2") {
        folderId = nodeId++;
        allNodes.push({
          id: folderId,
          label: node.title,
          title: `Pasta: ${node.title}`,
          color: '#e678aff2',
          size: 20,
          font: { color: '#f472b6', size: 11 },
          type: 'folder'
        });
        allEdges.push({ 
          from: parentId, 
          to: folderId, 
          color: { color: '#e648ec', opacity: 0.4 },
          type: 'folder-edge'
        });
      }

      node.children.forEach(child => traverse(child, folderId));

    } else if (node.url) {
      // Classifica inteligentemente usando o classificador global do classifier.js
      const categoriaInteligente = classifier.classify(`${node.title} ${node.url}`);
      const domain = getDomain(node.url);
      const folderKey = `${parentId}_${domain}`;

      if (!domains[folderKey]) {
        domains[folderKey] = nodeId++;
        allNodes.push({
          id: domains[folderKey],
          label: `${domain} [${categoriaInteligente}]`,
          title: `Categoria: ${categoriaInteligente} - https://${domain}`,
          url: `https://${domain}`,
          color: '#3b82f6',
          size: 14,
          font: { color: '#60a5fa', size: 9 },
          type: 'domain',
          parentId: parentId
        });
        allEdges.push({ 
          from: parentId, 
          to: domains[folderKey], 
          color: { color: '#3b82f6', opacity: 0.25 },
          type: 'domain-edge'
        });
      }

      const currentLinkId = nodeId++;
      allNodes.push({
        id: currentLinkId,
        label: node.title.length > 20 ? node.title.substring(0, 18) + '...' : node.title,
        title: `${node.url} [${categoriaInteligente}]`,
        url: node.url,
        color: '#10b981',
        size: 7,
        font: { color: '#9ca3af', size: 8 },
        type: 'url',
        parentId: domains[folderKey]
      });
      allEdges.push({ 
        from: domains[folderKey], 
        to: currentLinkId, 
        color: { color: '#10b981', opacity: 0.15 },
        type: 'url-edge'
      });
    }
  }

  bookmarkTreeNodes.forEach(root => traverse(root, 0));

  const container = document.getElementById('network');
  let nodesDataSet = new vis.DataSet([]);
  let edgesDataSet = new vis.DataSet([]);

  const data = { nodes: nodesDataSet, edges: edgesDataSet };
  const options = {
    nodes: { shape: 'dot' },
    physics: {
      solver: 'forceAtlas2Based',
      forceAtlas2Based: { 
        gravitationalConstant: -50, 
        centralGravity: 0.01, 
        springLength: 50, 
        springConstant: 0.08 
      },
      stabilization: {
        enabled: true,
        iterations: 150
      }
    },
    interaction: { hover: true, zoomView: true }
  };

  const network = new vis.Network(container, data, options);

  function filtrarRede(tipo) {
    let filteredNodes = [];
    let filteredEdges = [];

    if (tipo === 'all') {
      filteredNodes = allNodes;
      filteredEdges = allEdges;
    } else if (tipo === 'folders') {
      filteredNodes = allNodes.filter(n => n.type === 'brain' || n.type === 'folder');
      filteredEdges = allEdges.filter(e => e.type === 'folder-edge');
    } else if (tipo === 'domains') {
      filteredNodes = allNodes.filter(n => n.type === 'brain' || n.type === 'folder' || n.type === 'domain');
      filteredEdges = allEdges.filter(e => e.type === 'folder-edge' || e.type === 'domain-edge');
    }

    nodesDataSet.clear();
    edgesDataSet.clear();
    nodesDataSet.add(filteredNodes);
    edgesDataSet.add(filteredEdges);

    document.getElementById('count').innerText = `${filteredNodes.length - 1} visible nodes`;

    setTimeout(() => {
      network.fit({
        animation: {
          duration: 700,
          easingFunction: 'easeInOutQuad'
        },
        scale: 0.38
      });
    }, 50);
  }

  filtrarRede('all');

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const filtro = e.target.getAttribute('data-filter');
      filtrarRede(filtro);
    });
  });

  network.on("hoverNode", function (params) {
    container.style.cursor = "pointer";
    const nodeId = params.node;
    nodesDataSet.update({ id: nodeId, fixed: { x: true, y: true } });
  });

  network.on("blurNode", function (params) {
    container.style.cursor = "default";
    const nodeId = params.node;
    nodesDataSet.update({ id: nodeId, fixed: { x: false, y: false } });
  });

  network.on("doubleClick", function (params) {
    if (params.nodes.length > 0) {
      const clickedNode = nodesDataSet.get(params.nodes[0]);
      if (clickedNode && clickedNode.url) {
        chrome.tabs.create({ url: clickedNode.url });
      }
    }
  });

  network.on("oncontext", function (params) {
    params.event.preventDefault();
    if (params.nodes.length > 0) {
      const clickedId = params.nodes[0];
      if (clickedId === 0) return;
      const clickedNode = nodesDataSet.get(clickedId);
      if (clickedNode && clickedNode.url) {
        if (confirm(`Are you sure you want to delete the bookmark: "${clickedNode.label}"?`)) {
          chrome.bookmarks.search({ url: clickedNode.url }, (results) => {
            if (results.length > 0) {
              chrome.bookmarks.remove(results[0].id, () => {
                allNodes = allNodes.filter(n => n.id !== clickedId);
                nodesDataSet.remove(clickedId);
                document.getElementById('count').innerText = `${nodesDataSet.length - 1} visible nodes`;
              });
            }
          });
        }
      }
    }
  });
});
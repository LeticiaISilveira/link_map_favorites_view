function getDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch (e) {
    return 'outros';
  }
}

function extractPageSignals(html, fallbackText, pageUrl) {
  if (!html) {
    return [{ text: fallbackText, weight: 1 }];
  }

  const page = new DOMParser().parseFromString(html, 'text/html');
  const strongSignals = [];
  const supportingSignals = [page.title, fallbackText];
  const metadata = page.querySelectorAll(
    'meta[property="article:tag"], meta[property="article:section"], meta[name="keywords"], meta[name="description"], meta[property="og:title"], meta[property="og:description"]'
  );

  metadata.forEach(meta => {
    const content = meta.getAttribute('content');
    if (!content) return;

    const name = (meta.getAttribute('property') || meta.getAttribute('name') || '').toLowerCase();
    if (name === 'article:tag' || name === 'article:section' || name === 'keywords') {
      strongSignals.push(content);
    } else {
      supportingSignals.push(content);
    }
  });

  page.querySelectorAll('h1, h2').forEach((heading, index) => {
    if (index < 5) supportingSignals.push(heading.textContent);
  });

  const tagPath = /\/(?:tag|tags|category|categories|topic|topics|label|labels|keyword|keywords)\/([^/]+)/i;
  const baseUrl = page.querySelector('base[href]')?.href || pageUrl;
  const hrefTags = new Set();
  page.querySelectorAll('a[href]').forEach(link => {
    let pathname;
    try {
      pathname = new URL(link.getAttribute('href'), baseUrl).pathname;
    } catch {
      return;
    }
    const match = pathname.match(tagPath);
    if (match) {
      try {
        hrefTags.add(decodeURIComponent(match[1]).replace(/[-_]/g, ' '));
      } catch (error) {
        console.warn('Could not decode a page tag URL.', link.href, error);
      }
    }
  });

  if (hrefTags.size > 0 && hrefTags.size <= 3) {
    strongSignals.push(...hrefTags);
  }

  return [
    ...strongSignals.filter(Boolean).map(text => ({ text, weight: 3 })),
    ...supportingSignals.filter(Boolean).map(text => ({ text, weight: 1 }))
  ];
}

function loadPageHtml(url, cache, activeControllers) {
  if (cache.has(url)) {
    return cache.get(url);
  }

  const request = (async () => {
    if (!/^https?:\/\//i.test(url)) {
      return null;
    }

    const controller = new AbortController();
    activeControllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType && !contentType.includes('text/html')) {
        return null;
      }

      const contentLength = Number(response.headers.get('content-length'));
      if (contentLength > 2_000_000) {
        console.warn('Skipping bookmark HTML larger than 2 MB.', url);
        return null;
      }

      const html = await response.text();
      if (html.length > 2_000_000) {
        console.warn('Skipping bookmark HTML larger than 2 MB.', url);
        return null;
      }
      return html;
    } catch (error) {
      console.warn('Could not fetch bookmark HTML; using its title and URL.', url, error);
      return null;
    } finally {
      clearTimeout(timeout);
      activeControllers.delete(controller);
    }
  })();

  cache.set(url, request);
  return request;
}

async function classifyBookmarks(bookmarks) {
  const results = new Map(bookmarks.map(bookmark => [
    bookmark.id,
    classifier.classify(`${bookmark.title || ''} ${bookmark.url}`)
  ]));
  const htmlCache = new Map();
  const activeControllers = new Set();
  let nextIndex = 0;
  let stop = false;
  const workerCount = Math.min(12, bookmarks.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (!stop && nextIndex < bookmarks.length) {
      const bookmark = bookmarks[nextIndex++];
      const html = await loadPageHtml(bookmark.url, htmlCache, activeControllers);
      if (stop) return;

      const context = `${bookmark.title || ''} ${bookmark.url}`;
      const signals = extractPageSignals(html, context, bookmark.url);
      results.set(bookmark.id, classifier.classify(signals));
    }
  });

  let timedOut = false;
  let timeoutId;
  await Promise.race([
    Promise.all(workers),
    new Promise(resolve => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        resolve();
      }, 5000);
    })
  ]);
  clearTimeout(timeoutId);

  if (timedOut) {
    stop = true;
    activeControllers.forEach(controller => controller.abort());
    console.warn('Page metadata scan timed out; showing the map with available classifications.');
    await Promise.all(workers);
  }

  return results;
}

document.getElementById('count').innerText = 'Loading bookmarks...';
chrome.bookmarks.getTree((bookmarkTreeNodes) => {
  void (async () => {
  const bookmarks = [];
  function collectBookmarks(node) {
    if (node.children) {
      node.children.forEach(child => collectBookmarks(child));
    } else if (node.url) {
      bookmarks.push(node);
    }
  }
  bookmarkTreeNodes.forEach(root => collectBookmarks(root));

  const bookmarkCategories = await classifyBookmarks(bookmarks);
  let allNodes = [];
  let allEdges = [];
  let domains = {};
  let categoryGroups = {};
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
      const category = bookmarkCategories.get(node.id) || 'General';
      const domain = getDomain(node.url);
      const categoryKey = `${parentId}_${category}`;

      if (!categoryGroups[categoryKey]) {
        categoryGroups[categoryKey] = nodeId++;
        allNodes.push({
          id: categoryGroups[categoryKey],
          label: '',
          size: 1,
          color: { background: 'rgba(0, 0, 0, 0)', border: 'rgba(0, 0, 0, 0)' },
          type: 'category',
          parentId: parentId
        });
        allEdges.push({
          from: parentId,
          to: categoryGroups[categoryKey],
          color: { color: '#a78bfa', opacity: 0.08 },
          type: 'category-edge'
        });
      }

      const domainKey = `${categoryKey}_${domain}`;

      if (!domains[domainKey]) {
        domains[domainKey] = nodeId++;
        allNodes.push({
          id: domains[domainKey],
          label: domain,
          title: `https://${domain}`,
          url: `https://${domain}`,
          color: '#3b82f6',
          size: 14,
          font: { color: '#60a5fa', size: 9 },
          type: 'domain',
          parentId: categoryGroups[categoryKey]
        });
        allEdges.push({ 
          from: categoryGroups[categoryKey], 
          to: domains[domainKey], 
          color: { color: '#3b82f6', opacity: 0.25 },
          type: 'domain-edge'
        });
      }

      const currentLinkId = nodeId++;
      allNodes.push({
        id: currentLinkId,
        label: node.title.length > 20 ? node.title.substring(0, 18) + '...' : node.title,
        title: node.url,
        url: node.url,
        color: '#10b981',
        size: 7,
        font: { color: '#9ca3af', size: 8 },
        type: 'url',
        parentId: domains[domainKey]
      });
      allEdges.push({ 
        from: domains[domainKey], 
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
      filteredNodes = allNodes.filter(n => n.type === 'brain' || n.type === 'folder' || n.type === 'category' || n.type === 'domain');
      filteredEdges = allEdges.filter(e => e.type === 'folder-edge' || e.type === 'category-edge' || e.type === 'domain-edge');
    }

    nodesDataSet.clear();
    edgesDataSet.clear();
    nodesDataSet.add(filteredNodes);
    edgesDataSet.add(filteredEdges);

    const visibleNodeCount = filteredNodes.filter(n => n.type !== 'brain' && n.type !== 'category').length;
    document.getElementById('count').innerText = `${visibleNodeCount} visible nodes`;

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
  })().catch(error => {
    console.error('Could not initialize the bookmark map.', error);
    document.getElementById('count').innerText = 'Could not load bookmarks. See console for details.';
  });
});
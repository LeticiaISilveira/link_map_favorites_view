# LinkMap

LinkMap is a Chrome extension that turns your bookmarks into an interactive visual map. It helps you explore saved links by folder, topic, and website instead of relying only on a traditional bookmark list.

## Demo

[![Watch the LinkMap demo](https://img.youtube.com/vi/chgpjEgQ4JI/hqdefault.jpg)](https://www.youtube.com/watch?v=chgpjEgQ4JI)

*Click the preview to watch the demo on YouTube.*

## Features

- Visualizes Chrome bookmarks as a network of connected nodes.
- Preserves bookmark folders and groups links into topic clusters.
- Uses website metadata, such as article tags, keywords, descriptions, and headings to inform topic classification.
- Groups links by website within each topic cluster.
- Falls back to bookmark titles and URLs when page metadata is unavailable.
- Lets you switch between all nodes, folders only, and websites only.
- Opens a bookmark in a new tab when its node is double-clicked.
- Allows a bookmark to be deleted from the map using the context menu.

Topic labels are used internally to organize the map; they are not displayed on bookmark nodes.

## How it works

LinkMap reads the bookmarks stored in Chrome and creates a graph with this hierarchy:

```text
Brain
└── Bookmark folder
    └── Topic cluster
        └── Website
            └── Bookmark
```

For each HTTP or HTTPS bookmark, the extension attempts to fetch the page HTML and extract relevant metadata and headings. A lightweight, locally implemented keyword classifier compares those signals with its built-in topic vocabulary. If a page cannot be fetched or does not expose useful metadata, the classifier uses the bookmark title and URL instead.

Page content is processed locally by the extension; LinkMap does not send bookmark data to an external classification service. Websites may still receive the normal requests made when their pages are fetched.

## Install for local development

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Select **Load unpacked** and choose the project directory.
5. Select the LinkMap extension to open the bookmark map.

The project uses plain JavaScript and locally bundled files; no build step or hosted backend is required for local development.

## Permissions

- **Bookmarks** — reads and removes bookmarks when requested through the map.
- **Access to all websites** — attempts to retrieve HTML metadata from bookmarked pages to improve topic grouping. Some sites may block these requests or require authentication; in those cases LinkMap falls back to bookmark titles and URLs.

## Project files

- `manifest.json` — Chrome extension configuration and permissions.
- `background.js` — opens the LinkMap dashboard when the extension is selected.
- `popup.html` — dashboard layout and styles.
- `popup.js` — bookmark loading, metadata extraction, grouping, and map interactions.
- `classifier.js` — keyword-based topic classifier and its built-in training vocabulary.
- `vis-network.min.js` — bundled network visualization library.

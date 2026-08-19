# cisco-cheater-extension

Browser extension half of [cisco-cheater](https://github.com/reeenatamc/cisco-cheater).

Select text on a page and it sends the selection to the local Django server,
then shows whatever comes back in a small floating popup — no tab switching, no
copy and paste.

## Install

1. Open `chrome://extensions/` (or `edge://extensions/`)
2. Turn on developer mode
3. Load unpacked, and pick this folder

The backend has to be running locally for the popup to have anything to show.

## Contents

- `manifest.json` — permissions and the domains the content script runs on
- `script.js` — watches the selection, queries the server, renders the popup

## Responsibility

Built to practise browser extension messaging against a local service. How
anyone uses it is their own responsibility — see the
[NOTICE](https://github.com/reeenatamc/cisco-cheater/blob/main/NOTICE) in the
backend repository.

## Licence
MIT

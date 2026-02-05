// Background script para captura de pantalla

// Escuchar atajo de teclado (Alt+.)
chrome.commands.onCommand.addListener((command) => {
    if (command === 'capture_screen') {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (imageData) => {
            if (chrome.runtime.lastError) {
                console.error('Error capturando:', chrome.runtime.lastError);
                return;
            }
            
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'showCaptureOverlay',
                        imageData: imageData
                    });
                }
            });
        });
    }
});

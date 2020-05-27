(() => {
  document.addEventListener(
    'click',
    (event) => {
      chrome.tabs.query(
        {
          active: true,
          lastFocusedWindow: true,
        },
        (tabs) => {
          let currentTab = tabs[0];

          // URL encoded in Base64.
          let encodedUrl = currentTab.url.split('?')[1];
          let currentURL = window.atob(encodedUrl);

          if (event.target.matches('#enforce_proxy')) {
            chrome.tabs.create(
              {
                url: currentURL,
              },
              (_tab) => {
                chrome.tabs.remove(currentTab.id);
              }
            );
          }
        }
      );

      event.preventDefault();
    },
    false
  );
})();

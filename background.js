init = (tab) => {
  const {id, url} = tab;

  // Bexio
  if (url === "https://office.bexio.com/index.php/monitoring/edit") {
      chrome.scripting.executeScript(
        {
          target: {tabId: id, allFrames: false},
          files: ['bexioAddTime.js']
        }
      )
      console.log(`Loading: ${url}`);
  } else {
    console.error(`Not on the right bexio site`);
  }
}

// On tab click we add the script/buttons
// TODO: maybe we could check the browser URL or similar when changing to automatically add 
chrome.action.onClicked.addListener(tab => { 
  init(tab)
});

// chrome.action.setBadgeBackgroundColor({color: "blue"});
// chrome.action.setBadgeText({text: "Soulcode Browser Utils"});
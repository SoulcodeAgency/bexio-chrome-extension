import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import soulcodeLogo from "./assets/soulcode-logo.png";
import * as packageInfo from "../../package.json";
// eslint-disable-next-line react-refresh/only-export-components
const VERSION = packageInfo.version;
const copyrightSymbol = "\u00A9";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <img className="soulcode-logo" src={soulcodeLogo} alt="Soulcode logo" />
    <App />
    <a href="https://soulcode.ch" target="_blank">
      {copyrightSymbol} Soulcode AG - {VERSION}
    </a>
  </React.StrictMode>
);

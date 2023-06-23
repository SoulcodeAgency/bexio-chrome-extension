import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import soulcodeLogo from "./assets/SoulCode_Logo_OC_Complete.svg";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <a href="https://soulcode.ch" target="_blank">
      <img className="soulcode-logo" src={soulcodeLogo} alt="Soulcode logo" />
    </a>
    <App />
  </React.StrictMode>
);

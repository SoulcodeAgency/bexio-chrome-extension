import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.scss";
import soulcodeLogo from "./assets/soulcode-logo.png";
import * as packageInfo from "../../package.json";
import { ConfigProvider } from "antd";
const copyrightSymbol = "\u00A9";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div style={{ position: "relative" }}>
      <img className="soulcode-logo" src={soulcodeLogo} alt="Soulcode logo" />
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#3176b4",
          },
        }}
      >
        <App />
      </ConfigProvider>
      <a href="https://soulcode.ch" target="_blank">
        {copyrightSymbol}
        Soulcode AG{" - "}
        v.{packageInfo.version}
        {" - "}
        {packageInfo.date}
      </a>
    </div>
  </React.StrictMode>
);

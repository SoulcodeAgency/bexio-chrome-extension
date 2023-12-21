import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.scss";
import soulcodeLogo from "./assets/soulcode-logo.png";
import * as packageInfo from "../../../package.json";
import { ConfigProvider } from "antd";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div style={{ position: "relative" }}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#3176b4",
          },
        }}
      >
        <App />
      </ConfigProvider>
      <div style={{ marginTop: "1rem" }}>
        <a href="https://soulcode.ch" target="_blank">
          <img
            className="soulcode-logo"
            src={soulcodeLogo}
            alt="Soulcode logo"
          />{" "}
        </a>
        <a
          href="https://chromewebstore.google.com/u/2/detail/nbmjdligmcfaeebdihmgbdpahdfddlhm"
          target="_blank"
        >
          Version {packageInfo.version}
          {" - "}
          {packageInfo.date}
        </a>
      </div>
    </div>
  </React.StrictMode>
);

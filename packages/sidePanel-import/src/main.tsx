import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.scss";
import * as packageInfo from "../../../package.json";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import MessageApiBridge from "./components/MessageApiBridge";
const copyrightSymbol = "\u00A9";
const currentYear = new Date().getFullYear();

const prefersDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div style={{ position: "relative" }}>
      <ConfigProvider
        theme={{
          algorithm: prefersDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: "#3176b4",
          },
        }}
      >
        {/* antd's `App` provides the message/notification/modal instances that can see this
            ConfigProvider's theme; the bridge hands the message one to non-component callers. */}
        <AntdApp>
          <MessageApiBridge />
          <App />
        </AntdApp>
      </ConfigProvider>
      <div>
        {copyrightSymbol} {currentYear} {" - "}
        <a href="https://www.soulcode.agency" target="_blank">
          Soulcode AG
        </a>
        {" - "}
        <a href="https://chromewebstore.google.com/u/2/detail/nbmjdligmcfaeebdihmgbdpahdfddlhm" target="_blank">
          Version {packageInfo.version} - {packageInfo.date}
        </a>
      </div>
    </div>
  </React.StrictMode>,
);

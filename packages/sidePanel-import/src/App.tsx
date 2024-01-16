import "./App.css";
import { Tabs } from "antd";
import type { TabsProps } from "antd";
import TemplateProvider from "./TemplateProvider";
import TemplateEntries from "./components/TemplateEntries/TemplateEntries";
import ImportEntries from "./components/ImportEntries/ImportEntries";
import { useEffect, useState } from "react";
import {
  loadActiveTabId,
  saveActiveTabId,
} from "@bexio-chrome-extension/shared/chromeStorageSettings";

function App() {
  const [activeTabId, setActiveTabId] = useState("templates");
  const items: TabsProps["items"] = [
    {
      key: "templates",
      label: `Templates`,
      children: <TemplateEntries />,
    },
    {
      key: "import",
      label: `Import`,
      children: <ImportEntries />,
    },
  ];

  // Save active tab id when tabs change
  const onTabChangeHandler = (activeKey: string) => {
    setActiveTabId(activeKey);
    saveActiveTabId(activeKey);
  };

  // Load active tab id on mount to keep the users last tab selection
  useEffect(() => {
    loadActiveTabId().then((data) => {
      setActiveTabId(data ?? "templates");
    });
  }, []);

  return (
    <TemplateProvider>
      <h2 style={{ margin: "0", textAlign: "left" }}>
        bexio Time Tracking Templates
      </h2>
      <div style={{ textAlign: "left" }}>
        <Tabs
          defaultActiveKey={activeTabId}
          activeKey={activeTabId}
          items={items}
          onChange={onTabChangeHandler}
        />
      </div>
    </TemplateProvider>
  );
}

export default App;

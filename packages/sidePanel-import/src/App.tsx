import "./App.css";
import { Tabs } from "antd";
import type { TabsProps } from "antd";
import TemplateProvider from "./TemplateProvider";
import TemplateEntries from "./components/TemplateEntries/TemplateEntries";
import ImportEntries from "./components/ImportEntries/ImportEntries";

function App() {
  const items: TabsProps["items"] = [
    {
      key: "1",
      label: `Import`,
      children: <ImportEntries />,
    },
    {
      key: "2",
      label: `Templates`,
      children: <TemplateEntries />,
    },
  ];

  return (
    <TemplateProvider>
      <h2 style={{ margin: "0", textAlign: "left" }}>
        Bexio Timetracking Templates
      </h2>
      <div style={{ textAlign: "left" }}>
        <Tabs defaultActiveKey="1" items={items} />
      </div>
    </TemplateProvider>
  );
}

export default App;

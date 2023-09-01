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
      label: `Bexio import`,
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
      <div style={{ textAlign: "left" }}>
        <Tabs defaultActiveKey="1" items={items} />
      </div>
    </TemplateProvider>
  );
}

export default App;

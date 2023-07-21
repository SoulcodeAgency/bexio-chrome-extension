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
      label: `Templates`,
      children: <TemplateEntries />,
    },
    {
      key: "2",
      label: `Bexio import`,
      children: <ImportEntries />,
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

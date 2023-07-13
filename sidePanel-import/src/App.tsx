import "./App.css";
import TemplateEntries from "./components/TemplateEntries/TemplateEntries";
import ImportEntries from "./components/ImportEntries/ImportEntries";

function App() {
  return (
    <>
      <div style={{ textAlign: "left" }}>
        <TemplateEntries />
        <ImportEntries />
      </div>
    </>
  );
}

export default App;

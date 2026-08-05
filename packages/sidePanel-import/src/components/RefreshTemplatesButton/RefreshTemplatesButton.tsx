import { useContext, useState } from "react";
import { Button, Tooltip, message } from "antd";
import { TemplateContext, TemplateContextType } from "~/TemplateContext";
import { REFRESH_TEMPLATES_LABEL, REFRESH_TEMPLATES_TOOLTIP } from "./labels";

/**
 * Manual refresh for the template list.
 *
 * `TemplateProvider` already picks up storage writes on its own, so this is the fallback for the
 * case where that did not happen (the panel was open before the extension was reloaded, for
 * example). It has to be its own component because `App` renders the provider and could therefore
 * only read the context default, not its value.
 */
function RefreshTemplatesButton() {
  const { reloadData } = useContext<TemplateContextType>(TemplateContext);
  const [reloading, setReloading] = useState(false);

  async function onClick() {
    setReloading(true);
    try {
      await reloadData();
      // Without this the click looks like a no-op whenever the list did not actually change.
      message.success("Templates reloaded");
    } catch (error) {
      console.warn("RefreshTemplatesButton: reload failed:", error);
      message.error("Could not reload the templates.");
    } finally {
      setReloading(false);
    }
  }

  return (
    <Tooltip title={REFRESH_TEMPLATES_TOOLTIP}>
      <Button shape="circle" loading={reloading} onClick={onClick} aria-label={REFRESH_TEMPLATES_LABEL}>
        🔄
      </Button>
    </Tooltip>
  );
}

export default RefreshTemplatesButton;

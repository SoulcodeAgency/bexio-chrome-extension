/**
 * Filter behaviour for the template panel. Matching runs against each chip's
 * `data-filter` (lowercased name + keywords, set at render time), so this
 * module never touches template strings itself.
 */
export function setupTemplateFilter(panel: HTMLElement): void {
  const input = panel.querySelector<HTMLInputElement>("#templateFilter");
  const reset = panel.querySelector<HTMLButtonElement>("#templateFilterReset");
  const emptyState = panel.querySelector<HTMLElement>("#templateFilterEmpty");
  if (!input || !reset || !emptyState) return;

  const chips = () => Array.from(panel.querySelectorAll<HTMLElement>(".template-chip"));

  const applyFilter = (): HTMLElement[] => {
    const query = input.value.trim().toLowerCase();
    const visible: HTMLElement[] = [];
    for (const chip of chips()) {
      const match = (chip.dataset.filter ?? "").includes(query);
      chip.hidden = !match;
      if (match) visible.push(chip);
    }
    emptyState.textContent = `No templates match "${input.value.trim()}"`;
    emptyState.hidden = visible.length > 0;
    reset.hidden = query === "";
    return visible;
  };

  input.addEventListener("input", applyFilter);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      applyFilter();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const visible = applyFilter();
      if (visible.length === 1) visible[0].querySelector<HTMLButtonElement>("button.template-button")?.click();
    }
  });
  reset.addEventListener("click", (e) => {
    e.preventDefault();
    input.value = "";
    applyFilter();
    input.focus();
  });

  applyFilter(); // initial state: clear button hidden, empty state correct for zero templates
}

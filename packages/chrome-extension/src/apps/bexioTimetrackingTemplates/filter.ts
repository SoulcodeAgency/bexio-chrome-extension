import { PanelElements } from "./panelElements";

/**
 * Filter behaviour for the template panel. Matching runs against each chip's
 * `data-filter` (lowercased name + keywords, set at render time), so this
 * module never touches template strings itself.
 *
 * Returns a `refresh` function: anything that adds or removes chips without a
 * full re-render (manage-mode delete) must call it, or the empty state keeps
 * describing the chip list as it was.
 */
export function setupTemplateFilter(elements: PanelElements): () => void {
  const { entriesContainer, emptyState, filterInput: input, filterReset: reset } = elements;

  const applyFilter = (): HTMLElement[] => {
    const rawQuery = input.value.trim();
    const query = rawQuery.toLowerCase();
    const visible: HTMLElement[] = [];
    for (const chip of entriesContainer.querySelectorAll<HTMLElement>(".template-chip")) {
      const match = (chip.dataset.filter ?? "").includes(query);
      chip.hidden = !match;
      if (match) visible.push(chip);
    }

    // "Nothing matches your search" and "you have no templates yet" are different
    // states. Without the query check a fresh install — zero chips, empty box —
    // would be greeted with `No templates match ""`.
    if (visible.length === 0 && rawQuery !== "") {
      emptyState.textContent = `No templates match "${rawQuery}"`;
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
    }

    reset.hidden = rawQuery === "";
    return visible;
  };

  input.addEventListener("input", applyFilter);
  input.addEventListener("keydown", (e) => {
    // Both keys mean something to bexio too (Escape closes the contact
    // autocomplete, Enter submits the time entry): handle them here and stop.
    if (e.key === "Escape") {
      e.stopPropagation();
      input.value = "";
      applyFilter();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const visible = applyFilter();
      // Only an actual search may auto-apply. With an empty box "the single
      // visible chip" just means "the only template you have", and Enter would
      // overwrite a form the user filled in by hand.
      if (input.value.trim() !== "" && visible.length === 1) {
        visible[0].querySelector<HTMLButtonElement>("button.template-button")?.click();
      }
    }
  });
  reset.addEventListener("click", (e) => {
    e.preventDefault();
    input.value = "";
    applyFilter();
    input.focus();
  });

  applyFilter(); // initial state: clear button hidden, no empty state until something is searched
  return () => void applyFilter();
}

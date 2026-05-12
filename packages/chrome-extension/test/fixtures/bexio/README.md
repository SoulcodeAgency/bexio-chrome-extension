# bexio DOM fixtures

Captured HTML from real bexio pages, used by the jsdom-based tests for the
tooltip-replacement (topic 4) and form-manipulation (topic 5) code.

- **Cleaned fixtures** live directly in this folder (`*.html`), are committed, and
  must be anonymised (no real client / contact / project names).
- **Raw captures** go in `_raw/` (git-ignored). Drop unedited captures there; they
  get cleaned into the committed fixtures.
- Each cleaned fixture has a sibling `<name>.md` recording: source URL, capture
  date, what was trimmed, and confirmation that data was scrubbed.

## How to capture (you need to be logged into bexio)

For each page below: open it in Chrome, wait until it's fully rendered, open
DevTools (F12) → Console, run the snippet (it copies the HTML to your clipboard),
then paste into the given file under `_raw/`.

| Fixture | Page | Console snippet |
| --- | --- | --- |
| `monitoring-edit.html` *(top priority)* | `https://office.bexio.com/index.php/monitoring/edit` (new time entry form) | `copy(document.getElementById('MonitoringForm').outerHTML)` |
| `monitoring-edit.tinymce-iframe.html` *(optional, for the description-field path)* | same page | `copy(document.querySelector('#monitoring_text_ifr').contentWindow.document.documentElement.outerHTML)` |
| `monitoring-edit-filled.html` *(optional, for `readFormData` tests)* | open an existing entry: `…/monitoring/edit/id/<id>` | `copy(document.getElementById('MonitoringForm').outerHTML)` |
| `monitoring-list.html` | `https://office.bexio.com/index.php/monitoring/list` (have ≥1 row with a description, i.e. a tooltip icon) | `copy(document.getElementById('monitoring_content').outerHTML)` |
| `pr_project-listMonitoring.html` | a project → "Times" tab | `copy(document.getElementsByClassName('listBlock')[0].outerHTML)` |
| `pr_project-showPackage.html` | a work package → time-tracking tab | `copy(document.getElementById('ui-id-5')?.outerHTML ?? document.querySelector('.content').outerHTML)` |
| `kb_invoice-show-jqdialog.html` | an invoice → "More items" → "Tracked time" (modal open) | `copy(document.getElementById('jqDialog').outerHTML)` |

Notes:
- For the tooltip fixtures (`monitoring-list`, `pr_project-*`, `kb_invoice-*`), make
  sure at least one `<i rel="popover" data-content="…">` icon is present in the
  captured markup — that's what the tooltip-replacement code targets.
- If a snippet returns `null` / nothing, the page probably wasn't fully loaded, or
  bexio changed the container id — grab a parent element instead and note it.
- Don't worry about scrubbing the raw captures; that happens during cleanup. Just
  be aware the raw files contain real data, hence `_raw/` is git-ignored.

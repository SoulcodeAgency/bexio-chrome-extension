# Fixture: kb_invoice-show

- **Source URL:** https://office.bexio.com/index.php/kb_invoice/show/id/<id> (with the 'Zeiten importieren' modal opened via Positionen → Weitere Positionen → Zeit/Leistung)
- **Captured:** 2026-05-13
- **Captured via:** `copy(document.body.outerHTML) — full body, modal open`
- **Trimmed:** inline <script> blocks removed; modal placeholders + chat widgets + iframes pruned; the modal's <tbody> reduced to 12 rows + footer (anchored after #jqDialog so the invoice's own line-items table is untouched); one popover's data-content given an '&amp;' for entity-decoding; pre-injected #PopoverTextSwitcher dropped.
- **Anonymised:** yes — personal names → Doe/Roe/Smith/Klein/Weber/… placeholders; client/project/package/template names → Acme/Globex/Initech/Project Falcon/AC… placeholders; CSRF token → `TEST_CSRF_TOKEN`; extension id → `EXTENSION_ID_PLACEHOLDER`.
- **Notable elements for tests:** Full body — incl. .globalsearch (nav) and the open #jqDialog modal containing a .block.list wrapper with the time-entry table; ~12 <i rel='popover' data-content='...'> tooltip icons in the modal table. The invoice's own positions table is also present (untouched) earlier in the body.
- **Size:** 116889 bytes; 14 `i[rel='popover']` icons

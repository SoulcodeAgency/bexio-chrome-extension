# Fixture: monitoring-edit.tinymce-iframe

- **Source URL:** https://office.bexio.com/index.php/monitoring/edit (the #monitoring_text_ifr iframe document)
- **Captured:** 2026-05-13
- **Captured via:** `copy(document.querySelector('#monitoring_text_ifr').contentWindow.document.documentElement.outerHTML)`
- **Trimmed:** none (already minimal).
- **Anonymised:** yes — personal names → Doe/Roe/Smith/Klein/Weber/… placeholders; client/project/package/template names → Acme/Globex/Initech/Project Falcon/AC… placeholders; CSRF token → `TEST_CSRF_TOKEN`; extension id → `EXTENSION_ID_PLACEHOLDER`.
- **Notable elements for tests:** <body id='tinymce' class='mceContentBody' contenteditable='true'> — the empty rich-text body that getDescriptionField() navigates into.
- **Size:** 756 bytes

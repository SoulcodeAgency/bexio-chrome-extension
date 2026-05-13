# Fixture: monitoring-edit-filled

- **Source URL:** https://office.bexio.com/index.php/monitoring/edit/id/<id>
- **Captured:** 2026-05-13
- **Captured via:** `copy(document.getElementById('MonitoringForm').outerHTML)`
- **Trimmed:** inline <script> blocks removed; otherwise whole.
- **Anonymised:** yes — personal names → Doe/Roe/Smith/Klein/Weber/… placeholders; client/project/package/template names → Acme/Globex/Initech/Project Falcon/AC… placeholders; CSRF token → `TEST_CSRF_TOKEN`; extension id → `EXTENSION_ID_PLACEHOLDER`.
- **Notable elements for tests:** Same elements as monitoring-edit.html, but an existing entry: select2-chosen spans show work='Work', status='Erledigt', project='Acme - Back Office', package='Misc'; #monitoring_user_id selected 'Doe Jane'; hidden #monitoring_contact_id has a value. Useful for readFormData / readTextFromSelect2.
- **Size:** 60952 bytes

# Fixture: monitoring-edit

- **Source URL:** https://office.bexio.com/index.php/monitoring/edit
- **Captured:** 2026-05-13
- **Re-verified:** 2026-09-17, after bexio switched to its sidebar layout — the live `#MonitoringForm` matched this capture element by element (tag, id, classes, `name`, `type`, `role`, `for`; select2 counters normalised), so it was kept. The same day a leak check against the extended name list replaced a client brand and an internal project name left in the template buttons.
- **Captured via:** `copy(document.getElementById('MonitoringForm').outerHTML)`
- **Trimmed:** inline <script> blocks removed; otherwise whole.
- **Anonymised:** yes — personal names → Doe/Roe/Smith/Klein/Weber/… placeholders; client/project/package/template names → Acme/Globex/Initech/Project Falcon/AC… placeholders; CSRF token → `TEST_CSRF_TOKEN`; extension id → `EXTENSION_ID_PLACEHOLDER`.
- **Notable elements for tests:** #MonitoringForm; select2 containers #s2id_monitoring_client_service_id / _monitoring_status_id / _pr_project_id / _pr_package_id / _sub_contact_id (+ sibling <select>); #autocomplete_monitoring_contact_id; #monitoring_allowable_bill; #monitoring_date; #monitoring_duration; #monitoring_text + iframe #monitoring_text_ifr; injected #SoulcodeExtensionTemplates / #SoulcodeExtensionLoader; submit button[name='save'].save. Empty/blank form (new entry).
- **Size:** 31162 bytes

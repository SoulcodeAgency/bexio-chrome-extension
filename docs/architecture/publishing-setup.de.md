# Chrome Web Store Automatik einrichten — Checkliste

Diese Checkliste ist einmalig durchzuarbeiten, bevor die erste automatische Veröffentlichung läuft. Sie ist die deutsche Kurzfassung von `publishing.md` → "One-time setup". Die technischen Hintergründe stehen dort.

Durchzuführen von der Person, der der Store-Eintrag gehört.

---

## Vorher wissen

`Build.ps1 -CreatePackage` macht am Ende zwei Dinge, die nur auf Windows Sinn ergeben: es öffnet die Dev-Console im Browser (`Start-Process`) und den Explorer mit dem `dist`-Ordner (`Invoke-Item`). Auf dem Linux-Runner schlagen beide fehl.

Das ZIP wird aber **vorher** erstellt, und der `catch`-Block bricht nicht ab. Im Log erscheint darum wahrscheinlich ein rotes `FAILED` — das ist harmlos, der Upload funktioniert trotzdem.

---

## Teil 1 — Zugangsdaten erstellen

- [ ] **1. Google-Konto wählen.** Es braucht mindestens "Editor"-Rechte auf dem Store-Eintrag. In diesem Konto angemeldet bleiben.
- [ ] **2. Google-Cloud-Projekt öffnen** auf `https://console.cloud.google.com/`. Ein neues Projekt erstellen oder ein bestehendes nehmen.
- [ ] **3. Chrome Web Store API aktivieren.** APIs & Services → Library → "Chrome Web Store API" suchen → Enable.
- [ ] **4. OAuth-Client erstellen.** APIs & Services → Credentials → Create credentials → OAuth client ID.
  - Beim ersten Mal fragt Google nach dem Consent Screen: "External" wählen, Name setzen (z.B. "Soulcode CWS Publisher"), dich selbst als Test-User eintragen.
  - Danach Typ **Desktop app** wählen, Name z.B. "cws-publisher".
  - **Client ID** und **Client Secret** kopieren.
- [ ] **5. Refresh Token holen.** Im Terminal:

  ```bash
  npx --yes chrome-webstore-upload-keys
  ```

  Das Tool fragt nach Client ID und Secret, öffnet den Browser, du bestätigst den Zugriff. Bei der Warnung "unverified app" auf "Continue" klicken — das ist normal, weil der Consent Screen im Testmodus ist. Am Schluss steht der Refresh Token im Terminal. Kopieren.

---

## Teil 2 — Secrets in GitHub eintragen

- [ ] **6.** Repo → Settings → Secrets and variables → Actions → "New repository secret". Vier Mal, Namen **exakt** so:

| Name | Wert |
| --- | --- |
| `CWS_EXTENSION_ID` | `nbmjdligmcfaeebdihmgbdpahdfddlhm` |
| `CWS_CLIENT_ID` | aus Schritt 4 |
| `CWS_CLIENT_SECRET` | aus Schritt 4 |
| `CWS_REFRESH_TOKEN` | aus Schritt 5 |

---

## Teil 3 — Smoke-Test (ohne Veröffentlichung)

- [ ] **7.** Actions → `publish-chrome-web-store` → "Run workflow".
  - `tag`: `1.3.5`
  - `publish`: **false** ← wichtig, sonst geht es direkt live
- [ ] **8.** Workflow durchlaufen lassen. Rotes `FAILED` beim Packen ignorieren (siehe oben). Der Schritt "Upload + publish" muss grün sein.
- [ ] **9.** In der Chrome Web Store Dev-Console prüfen: dort sollte jetzt ein **Entwurf** liegen.
- [ ] **10.** Entwurf verwerfen. Er enthält den alten 1.3.5-Stand und soll nicht veröffentlicht werden.

---

## Teil 4 — Scharf schalten

- [ ] **11.** PR [#33](https://github.com/SoulcodeAgency/bexio-chrome-extension/pull/33) mergen.
- [ ] **12.** Den alten **Draft-Release 1.3.5 auf GitHub löschen.** Achtung, das ist eine Falle: der Workflow startet beim Ereignis "Release published". Wenn dieser alte Entwurf später veröffentlicht wird, landet ein 1.3.5-Build im Store.
- [ ] **13.** Ab jetzt gilt: `feat:` oder `fix:` nach `main` mergen → release-please öffnet eine Release-PR → diese mergen → der Store-Upload läuft automatisch.

---

## Wenn der Token nicht mehr geht

Wird der Zugriff später widerrufen (Passwortwechsel, Sicherheitsrichtlinie, manueller Widerruf), schlägt der Workflow mit einem 401 von Google fehl.

Lösung: nur Schritt 5 wiederholen und das Secret `CWS_REFRESH_TOKEN` ersetzen. Die anderen drei Secrets bleiben gültig.

---

## Verwandte Dokumente

- `docs/architecture/publishing.md` — beide Release-Wege im Detail, Commit-Regeln, Wiederherstellung nach Fehlern
- `RELEASE.md` — Kurzanleitung für den Alltag

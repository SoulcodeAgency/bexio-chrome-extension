# Chrome Web Store Automatik einrichten — Checkliste

Diese Checkliste ist einmalig durchzuarbeiten, bevor die erste automatische Veröffentlichung läuft. Sie ist die deutsche Kurzfassung von `publishing.md` → "One-time setup". Die technischen Hintergründe stehen dort.

Durchzuführen von der Person, der der Store-Eintrag gehört.

---

## Wie das Ganze funktioniert

Heute lädt ein Mensch das ZIP von Hand im Browser hoch. Der GitHub-Runner ist kein Mensch: kein Browser, keine Anmeldung. Er braucht trotzdem einen Weg, sich gegenüber Google als jemand auszuweisen, der die Extension verändern darf. Genau dafür ist dieses Setup da.

Die Kette:

1. Der Store hat eine **API** — ZIP hochladen und veröffentlichen per HTTP, ohne Oberfläche.
2. Jeder Google-API-Zugriff läuft über ein **Cloud-Projekt**. Das ist nur ein Behälter für Kontingente und Aktivierungen. Die CWS-API kostet nichts, es braucht kein Billing.
3. Im Projekt muss die **CWS-API aktiviert** werden. Solange sie aus ist, antwortet Google mit `403 SERVICE_DISABLED` — das sieht aus wie ein Rechteproblem, ist aber keins.
4. **Client ID + Client Secret** sind der Ausweis der *Anwendung* ("das Publish-Skript").
5. Der **Refresh Token** ist die dauerhafte Erlaubnis eines *bestimmten Kontos*, dass diese Anwendung in seinem Namen handelt.
6. Zur Laufzeit tauscht der Workflow diese drei Werte gegen ein kurzlebiges Zugriffs-Token (rund eine Stunde) und spricht damit die Store-API an.
7. `CWS_EXTENSION_ID` ist die Adresse: *welche* Extension.

**Warum das an einem persönlichen Konto hängt:** Die Chrome Web Store API unterstützt keine Service-Accounts. Es geht nur über ein echtes Nutzerkonto und dessen Refresh Token. Deshalb ein Funktions-Konto (`dev@soulcode.ch`) und kein persönliches — sonst steht die Pipeline still, sobald diese Person das Unternehmen verlässt.

---

## Was für dieses Repo eingerichtet ist

| | |
| --- | --- |
| Google-Konto | `dev@soulcode.ch` |
| Store-Publisher | Gruppe "Soulcode" |
| Extension-ID | `nbmjdligmcfaeebdihmgbdpahdfddlhm` |
| Cloud-Projekt | `soulcode-cws-publisher` (ohne Organisation) |
| OAuth-Client | "cws-publisher (GitHub Actions)", Typ Desktop app |
| Consent Screen | User type External, Publishing status **In production** |

**Alle Werte müssen aus demselben Konto stammen.** Client ID, Client Secret und Refresh Token gehören zu `dev@soulcode.ch`, weil dieses Konto Rechte am Store-Eintrag hat. Ein Token aus einem anderen Konto führt später zu einem Rechtefehler beim Upload.

---

## Vorher wissen

`Build.ps1 -CreatePackage` macht am Ende zwei Dinge, die nur auf Windows Sinn ergeben: es öffnet die Dev-Console im Browser (`Start-Process`) und den Explorer mit dem `dist`-Ordner (`Invoke-Item`). Auf dem Linux-Runner schlagen beide fehl.

Das ZIP wird aber **vorher** erstellt, und der `catch`-Block bricht nicht ab. Im Log erscheint darum wahrscheinlich ein rotes `FAILED` — das ist harmlos, der Upload funktioniert trotzdem.

---

## Teil 1 — Zugangsdaten erstellen

- [ ] **1. Konto prüfen.** Store-Eintrag im [Developer Dashboard](https://chrome.google.com/webstore/devconsole/) öffnen. Lädt die Seite, hat das Konto genug Rechte (nötig ist mindestens die Rolle **Item Manager**, nicht zwingend Editor). Rollen verwaltet ein **Admin** unter Publisher → Settings.

  Achtung bei mehreren Google-Konten im Browser: Die `/u/0/`, `/u/1/`-Zähler in Google-URLs zeigen auf das erste, zweite usw. angemeldete Konto. Am saubersten ist ein eigenes Chrome-Profil oder ein Inkognito-Fenster nur mit `dev@soulcode.ch`.

- [ ] **2. Cloud-Projekt anlegen** auf `https://console.cloud.google.com/` → "Create project". Name frei wählbar, er taucht im Release-Prozess nie wieder auf. **Danach prüfen, dass das Projekt oben links auch ausgewählt ist** — sonst aktiviert man im nächsten Schritt die API im falschen Projekt, und der Fehler fällt erst beim Upload auf.

- [ ] **3. Chrome Web Store API aktivieren.** Direktlink: `https://console.cloud.google.com/apis/library/chromewebstore.googleapis.com` → **Enable**. Kontrolle: die API taucht danach unter "APIs & Services" in der Liste auf.

- [ ] **4. Consent Screen konfigurieren.** Menü **Google Auth Platform** (`https://console.cloud.google.com/auth/overview`) → "Get started". Vier Schritte:
  - App name: z.B. `Soulcode CWS Publisher` — dieser Name steht später auf dem Zustimmungs-Bildschirm.
  - User support email: `dev@soulcode.ch`
  - Audience: **External**. "Internal" ist nur mit einer Google Cloud Organization möglich und für dieses Konto gesperrt ("Because you're not a Google Workspace user…").
  - Contact email: `dev@soulcode.ch`
  - Googles Nutzerdaten-Richtlinie zustimmen → **Create**.

- [ ] **5. Publishing status auf "In production" setzen.** Menü **Audience** → **Publish app** → Confirm.

  **Diesen Schritt nicht überspringen.** Im Status "Testing" gibt Google bei User type External nur Refresh Tokens mit **7 Tagen Gültigkeit** aus — die Pipeline würde nach einer Woche mit einem 401 stehenbleiben, ohne erkennbaren Grund.

  Was "In production" bedeutet: Es hebt nur die Beschränkung auf eingetragene Testnutzer auf. Die App ist dadurch **nicht** auffindbar (es gibt kein Verzeichnis für OAuth-Anwendungen), und sie ist ohne Client ID **und** Secret nicht ansprechbar. Selbst wer zustimmen würde, bekäme nur ein Token für sein *eigenes* Konto — und damit keinerlei Zugriff auf den Store-Eintrag, denn die Rechte hängen am Konto, nicht an der App. Umkehrbar über "Back to testing".

- [ ] **6. OAuth-Client erstellen.** Menü **Clients** → **Create client** → Application type **Desktop app**.

  **Nicht "Chrome extension" wählen** — das wäre der Typ für eine Extension, die selbst Nutzer anmeldet. "Desktop app" ist richtig, weil der Token-Abruf im nächsten Schritt lokal über eine Weiterleitung läuft.

  **Sofort "Download JSON" klicken.** Das Client Secret zeigt Google **nur dieses eine Mal**. Datei in den Passwort-Manager. Geht es verloren, kann man im selben Client ein neues Secret erzeugen — dasselbe wiederherstellen kann man nicht.

- [ ] **7. Refresh Token holen.** Im Terminal:

  ```bash
  npx --yes chrome-webstore-upload-keys
  ```

  Das Tool fragt nach Client ID und Secret und öffnet den Browser.
  - **Konto auf dem Zustimmungs-Bildschirm prüfen** — es muss `dev@soulcode.ch` sein.
  - Die Warnung **"Google hasn't verified this app"** ist erwartet: über **Advanced** → **"Go to … (unsafe)"** weiterklicken. Die App ist nicht von Google geprüft, weil sie nur intern benutzt wird; eine Verifizierung ist dafür nicht nötig.
  - Am Schluss steht der Refresh Token im Terminal. Ebenfalls in den Passwort-Manager.

---

## Teil 2 — Secrets in GitHub eintragen

- [ ] **8.** Repo → Settings → Secrets and variables → Actions → "New repository secret". Vier Mal, Namen **exakt** so:

| Name | Wert |
| --- | --- |
| `CWS_EXTENSION_ID` | `nbmjdligmcfaeebdihmgbdpahdfddlhm` |
| `CWS_CLIENT_ID` | aus Schritt 6 |
| `CWS_CLIENT_SECRET` | aus Schritt 6 |
| `CWS_REFRESH_TOKEN` | aus Schritt 7 |

GitHub zeigt Secrets nach dem Speichern nicht mehr an — auch dir nicht. Das ist so gewollt; die Werte liegen ja im Passwort-Manager.

---

## Teil 3 — Workflows aktivieren

**Der Zugangsdaten-Test muss nach diesem Teil kommen, nicht davor.** GitHub registriert nur Workflows, die auf dem Standard-Branch (`main`) liegen. Solange die beiden Workflow-Dateien nur auf einem Feature-Branch liegen, tauchen sie im Actions-Tab gar nicht auf und lassen sich nicht manuell starten.

- [ ] **9.** PR [#33](https://github.com/SoulcodeAgency/bexio-chrome-extension/pull/33) mergen. Dadurch werden `release-please` und `publish-chrome-web-store` aktiv.

  Das veröffentlicht noch nichts. `release-please` öffnet innerhalb einer Minute eine Release-PR — die ist nur ein Vorschlag und liegt so lange herum, bis jemand sie merged.

- [ ] **10.** Den alten **Draft-Release 1.3.5 auf GitHub löschen.** Der Publish-Workflow startet beim Ereignis "Release published". Wenn dieser alte Entwurf später veröffentlicht wird, versucht er einen 1.3.5-Build in den Store zu laden.

---

## Teil 4 — Zugangsdaten testen

Ein echter Trockenlauf ist nicht möglich, weil der Store **jede hochgeladene Version ablehnt, die nicht höher ist als die veröffentlichte**. Google dazu: *"If you have not increased the version field in your extension's manifest file, this will fail."* Der aktuelle Tag trägt per Definition die veröffentlichte Version.

Der Lauf prüft deshalb nicht den ganzen Weg, aber die Zugangsdaten:

- [ ] **11.** Actions → `publish-chrome-web-store` → "Run workflow" → `tag`: der aktuelle Tag, `publish`: **false**.
- [ ] **12.** Fehler einordnen:
  - **401 / 403 von Google** → eines der vier Secrets stimmt nicht, oder die API ist im falschen Projekt aktiviert.
  - **`invalid_grant`** → meist ein Leerzeichen oder Zeilenumbruch, der beim Kopieren ins Secret gerutscht ist.
  - **Fehler über die Versionsnummer** → **die Zugangsdaten funktionieren.** Genau das ist das gewünschte Ergebnis.
  - Rotes `FAILED` beim Packen → harmlos, siehe oben.

---

## Teil 5 — Erster echter Release

- [ ] **13.** Die von `release-please` geöffnete Release-PR prüfen und mergen. Das erzeugt Tag und GitHub-Release, und das wiederum startet den Store-Upload. **Dieser erste Lauf ist der eigentliche Test des ganzen Wegs.**
- [ ] **14.** Ab jetzt gilt: `feat:` oder `fix:` nach `main` mergen → release-please öffnet eine Release-PR → diese mergen → der Store-Upload läuft automatisch. Jede Veröffentlichung ist ein Minor-Sprung (1.4.0, 1.5.0, …).

---

## Wenn der Token nicht mehr geht

Wird der Zugriff später widerrufen (Passwortwechsel, Sicherheitsrichtlinie, manueller Widerruf), schlägt der Workflow mit einem 401 von Google fehl.

Lösung: nur Schritt 7 wiederholen und das Secret `CWS_REFRESH_TOKEN` ersetzen. Die anderen drei Secrets bleiben gültig.

---

## Verwandte Dokumente

- `docs/architecture/publishing.md` — beide Release-Wege im Detail, Commit-Regeln, Wiederherstellung nach Fehlern
- `RELEASE.md` — Kurzanleitung für den Alltag

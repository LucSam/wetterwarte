# Temperaturstatistik · Prüfung 12.10.2026

## Nachprüfung der wiederholten Auswahl und vereinfachte Diagramme

Der gemeldete Fehler wurde vor der Korrektur in WebKit reproduziert: Der zweite direkt aufeinanderfolgende Monatswechsel erwartete August (`8`), die Ansicht blieb bei Juli (`7`). Die frühere Prüfung hatte nach jeder Auswahl ausdrücklich `blur()` ausgelöst und damit den Fehler umgangen. Das native Auswahlfeld über der Rastervorschau leitete Ereignisse an ein inzwischen ersetztes DOM-Element weiter.

Die Eingabeweiterleitung löst das aktuelle Element bei jedem Ereignis neu auf und schließt eine bestätigte Auswahl. Das Schließen ist gegen die synchrone erneute Blur-Auslösung in Chrome abgesichert. Texteingaben behalten ihren Fokus; ihre Wertänderung beim Verlassen sperrt den Klick in das nächste Feld nicht.

Geprüfte Abläufe:

- Wiederholte Monats-, Jahres-, Skalen-, Referenz- und Diagrammwechsel ohne künstliches Verlassen des Feldes. Geklickt wird auf die sichtbare Position in der kalibrierten Rastervorschau; die Auswahl erfolgt am echten darüberliegenden Auswahlfeld.
- Ein Neuaufbau der Modulansicht während der Auswahl sowie zwischen `input` und `change`. Die Auswahl landet im aktuellen Element.
- Chrome und Playwright-WebKit, kalibrierte Vorschau in 480 × 320, 480 × 480, 800 × 480 und 1280 × 720 sowie zusätzlicher Pixelmodus in 480 × 320. Der Kiosk ohne Rasterweiterleitung wird ebenfalls geprüft. Keine sichtbare Safari-Automation.
- **Start → Neu laden** über die sichtbare Taste; Referenz, Skala, Diagramm und Klima-Unterseite bleiben gespeichert. Die Taste löscht keine Daten.
- Alle drei Zeitskalen und alle drei Diagrammarten auf allen vier Größen: eine Grafik je Ansicht, keine Scrollfläche oder abgeschnittene Grafik, mindestens 44 Pixel hohe Bedienelemente und 12 Pixel Achsenbeschriftung. Das Band erscheint nur in „Streuung“, die Extremkurven nur in „Kurven“.
- Separate gemeinsame Eingabeprüfung mit Radio-Abspielen, Stummschaltung, Senderauswahl, zwei Texteingaben und Absenden eines eigenen Senders. Synthetisches Audio vermeidet Netz- und Autoplay-Abhängigkeiten.

Das SD-Band hat unveränderte Werte. „Streuung“ bekommt eine eigene Achse aus Mittelwert und Referenzband; „Kurven“ enthält nur Minimum, Maximum und Mittel. Die Legenden nennen nur sichtbare Elemente. Neue Einstellungen beginnen mit 30 Jahre / Klimanormal / Abweichung; vorhandene Einstellungen bleiben erhalten.

Zusätzliche Reproduktion:

```sh
cd ~/Projects/raspberry_pi/wetterwarte
node tests/temperature-browser.mjs --repeat-selects
node tests/temperature-browser.mjs webkit --repeat-selects
cd ../startmenue
node tests/visual-input.mjs
node tests/visual-input.mjs webkit
```

## Ursprüngliche Implementierung und Datenprüfung

Die erste Implementierung wurde in vier Prüfbereichen umgesetzt. Die oben beschriebene Nachprüfung ersetzt die ursprüngliche gleichzeitige Anordnung der Diagramme und erweitert die Interaktionsprüfung:

1. **Daten und Statistik:** 25 bestandene Rechentests, davon neun neue für Temperaturstatistik. Referenzverschiebung, Datenverzögerung am Jahresanfang, Schaltjahre, Tages-/Monats-/Jahresaggregation, echte Extrema, Stichproben-SD, fehlende Daten und Cache-Aktualität. Kleiner echter ERA5-Abruf für Elstal, 28.02.–01.03.2024: drei Tage, korrekte Einheiten und plausible Min ≤ Mittel ≤ Max.
2. **Darstellung:** alle drei Skalen auf 480 × 320, 480 × 480, 800 × 480 und 1280 × 720. Keine Scrollflächen oder abgeschnittenen Diagramme; Achsenschrift mindestens 12 native Pixel, Bedienelemente mindestens 44 Pixel hoch. Pixelraster, Hell/Dunkel, Referenz- und Monatsauswahl in Chrome und Playwright-WebKit geprüft; Screenshots visuell gesichtet. Die erste Implementierung zeigte auf größeren Displays zwei Grafiken gleichzeitig; nach der Rückmeldung wird jetzt jeweils eine große Grafik gezeigt.
3. **Abruf und Interaktion:** kontrollierte API-Testantworten und IndexedDB. Nur das fehlende Jahr wird abgerufen, API-Parameter stimmen, Min/Max/Abweichung stimmen, Diagrammabmessungen ändern sich beim Laden nicht. Monatswechsel und erneutes Öffnen verwenden den dauerhaften Cache. Offline bleiben Werte erhalten; HTTP 503 wird angezeigt und ersetzt keine Daten durch Demo. Die tatsächlich sichtbare Select-Position wurde in der nativen Pixelvorschau angeklickt. Beide Browser bestanden; für robuste WebKit-Tests werden Navigation und Geometriemessung explizit synchronisiert.
4. **Abschluss:** automatische Referenzänderung in der laufenden Oberfläche für 2029 und 2031, ohne Änderung des Referenzschalters; normale Zeitreihen bleiben davon getrennt. Bestehender gemeinsamer Browsertest für Wetter, Radar, Klima, Modelle, Mond, Radio, Start und Standby auf vier Displaygrößen bestanden. TypeScript-Prüfung und gemeinsamer Produktionsbuild erfolgreich. Keine sichtbare Safari-Automation gestartet.

Reproduktion aus `~/Projects/raspberry_pi` bei laufendem `npm run dev`:

```sh
npm --prefix wetterwarte test
cd wetterwarte
node tests/temperature-browser.mjs
node tests/temperature-browser.mjs webkit
cd ../startmenue
node tests/browser.mjs
cd ..
npm run build
```

Die vollständigen 30-jährigen Referenzdaten wurden in den Browserprüfungen als ausdrücklich abgegrenzte Test-Fixtures bereitgestellt, um das API-Kontingent nicht bei jedem Test zu verbrauchen. Zusätzlich geprüft wurde der kleine echte ERA5-Abruf. Auf dem realen TFT und auf einem Raspberry Pi wurde diese Änderung noch nicht getestet. Grafiken und Test-Fixtures liegen ausschließlich im lokalen Testkontext, nicht im Live-Datencache des Benutzerbrowsers.

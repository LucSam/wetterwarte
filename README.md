# Wetterwarte

Lokale Wetter- und Klimaanwendung für Berlin, Potsdam und Wustermark / Elstal. TypeScript, Vite und SVG; ohne Backend, Konto oder Cloud. Helle Oberfläche, Helvetica, Touch-/Mausbedienung. Startet mit gekennzeichneten Demo-Daten.

## Start auf dem Intel-Mac

Geprüft mit Node.js 22.14.0 und npm 10.9.2. Abhängigkeiten sind im Lockfile festgeschrieben.

```sh
cd ~/Projects/raspberry_pi/wetterwarte
npm ci
npm run dev -- --port 5177
```

Eigenständig: **http://127.0.0.1:5177/**. Die gemeinsame Umgebung mit Startmenü und Radio wird dagegen aus `~/Projects/raspberry_pi` mit `npm run dev` unter **http://127.0.0.1:5173/** gestartet. Änderungen erscheinen automatisch; andernfalls mit **⌘R** neu laden. Den Server mit Ctrl+C beenden.

Produktionsvorschau mit Offline-Cache:

```sh
npm run build
npm run preview
```

**http://127.0.0.1:4173/**. Nach vollständigem Erstbesuch lässt sich diese Vorschau offline neu laden, einschließlich der Klimakarte. Jeder Build erhält einen eigenen Cache. Der Entwicklungsmodus benötigt weiterhin den lokalen Vite-Server. Die beiden Ports haben getrennte Einstellungen und Datenspeicher.

## Einbindung ins Startmenü

Dieses Verzeichnis ist ein eigenständiges Unterprojekt. Das übergeordnete Startmenü lädt es unter `/wetter/?embedded=1`; die Vorschauleiste kommt dann vom Startmenü. Datenbank und Einstellungen bleiben unter derselben Browseradresse erhalten. „Start“ führt zum gemeinsamen Menü. Die regulären Herkunftszeilen unter der Darstellung wurden entfernt; Demo-/Offline-/Veraltet-Hinweise bleiben. Max/Min sind auf dem kleinen Display 20 px groß.

## Ansichten

- **Wetter:** Übersicht mit aktueller Temperatur, Wind, Niederschlag, Radar und Tagesreihe. **Vorschau:** oben 48 Stunden DWD ICON-EU, darunter 14 Tage ECMWF IFS in zwei Wochen. **Verlauf:** Temperatur- und Regenkurven. **Mond:** große Phasendarstellung mit auswählbaren Tagen. Die unterschiedlichen Wettermodelle sind beschriftet; Woche 2 ist unsicherer.
- **Fokus:** zusätzliche Wetteraufteilung mit aktueller Temperatur, Stunden- und Tagesvorschau links sowie großer Regenkarte rechts. Alle 14 Tageswerte sind über Pfeile erreichbar; je nach Display werden 1, 3 oder 7 Tage gleichzeitig dargestellt. Die bisherige Übersicht bleibt verfügbar.
- **Radar:** echte DWD-RV-Kurzfristprognose bis zwei Stunden nach der Basismessung, durchgehende Zeitleiste, Abspielen/Pause und **Jetzt**. Jetzt folgt dem ersten verfügbaren Prognosezeitpunkt ab der Systemzeit im 5-Minuten-Raster. Die Anzeige nennt Prognosezeit und separat die zugrunde liegende Basismessung samt Alter. Durch die Lieferverzögerung bleiben weniger als zwei Stunden ab der aktuellen Uhrzeit. Die Systemuhr steht neben „Start“; die Karte kennzeichnet ihre eigene Zeit als Prognosezeit. Methodik und Quellen stehen in dieser README und `docs/methodik.md`. Die kommenden Bilder werden automatisch mit zwei parallelen Abrufen vorbereitet; Balken und Bildzähler zeigen den Stand. Abspielen wartet auf die vollständige Folge. Blau → Violett → Gelb kennzeichnet zunehmende Regenintensität. Fehlende Radardaten sind dezent schraffiert; regenfreie Gebiete bleiben ohne Schraffur.
- **Klima → Karte:** historische DWD-Temperaturmittel 1961–1990 und 1991–2020, einzeln oder als Differenz. Tatsächliche Rasterdaten, keine Interpolation aus den drei auswählbaren Orten. Zellen lassen sich antippen. Differenzen: Blau–Weiß–Rot um null; absolute Mittel: gemeinsame fortlaufende Skala.
- **Klima → Verlauf:** ERA5-Jahreswerte seit 1961, Abweichung gegenüber 1991–2020 und gleitendes Mittel der letzten zehn Jahre. Jahresauswahl zeigt Temperatur, heiße Tage und Niederschlag.
- **Klima → Zukunft:** Modellprojektionen 1995–2014 gegenüber 2030–2049. Temperatur und heiße Tage als Referenz-/Zukunftspunkte je Modell; Niederschlag als Punktgruppen je Jahreszeit mit Modellbandbreite. Nur das verfügbare HighResMIP-Szenario nahe RCP8.5.
- **Modelle:** DWD ICON-EU-EPS und ECMWF AIFS, gemeinsame Sechs-Stunden-Zeitpunkte, Median und P10–P90 je Ensemble. Die Bänder zeigen Ensemble-Streuung.
- **Uhr:** große dunkelgraue Uhrzeit, Datum und Wetter; keine zweite Uhr im Kopfbereich. Uhr und astronomisch berechnete Mondphase verwenden auch im Demo-Modus die wirkliche Systemzeit, angezeigt in Europe/Berlin.

**Darstellung: Auto / Hell / Dunkel** steht außerhalb des Geräts. Auto wechselt am gewählten Ort zwischen Sonnenaufgang und Sonnenuntergang zur hellen Darstellung und nachts zur dunklen. Standort, Jahreszeit und Europe/Berlin werden berücksichtigt; kein Internet nötig. Die Einstellung bleibt gespeichert. Alle Ansichten verwenden gemeinsame Farben für gleiche Messgrößen. Die Mondgrafik verwendet eine lokal gespeicherte NASA-Oberflächentextur mit phasenabhängiger Beleuchtung und schwach sichtbarer Schattenseite. Sie funktioniert ohne Internet.

Die vier Vorschaugrößen stehen außerhalb der Geräteoberfläche. **Neu: 480 × 320 für Joy-IT RB-TFT3.5.** Dieses kleine Format trennt Stunden und Tage auf eigene Seiten; reguläre Seiten passen ohne Scrollen. Die feinen Kartenbeschriftungen bleiben bei 3,5 Zoll klein. **800 × 480 und 1280 × 720 benötigen in den regulären Ansichten kein Scrollen.** Bei 800 × 480 bietet Wetter vier Seiten: Übersicht (Temperatur mit Wind/Niederschlag, Regenradar und Tagesreihe), Vorschau (Stunden und 14 Tage), Verlauf und Mond (große Mondphase und Tagesauswahl). Die Klima-Unteransichten und der Modellvergleich passen auf jeweils eine Seite. Bei 480 × 480 bleiben umfangreiche Ansichten vertikal scrollbar; Radar und Uhr passen auch dort vollständig. Kein horizontales Scrollen. Für die unverkleinerte große Vorschau Browserfenster mindestens 1360 px breit, Zoom 100 %. Schriftgröße und Touchbedienung müssen später am physischen Panel geprüft werden.

## Automatischer Abruf und Cache

**Echte Daten** lädt alle Produkte für den gewählten Ort automatisch. Wetter alle 30 Minuten, Radar alle 5 Minuten, Ensembles alle 3 Stunden bei geöffneter App. Die erstmalige Historien- und Klimaverarbeitung läuft nacheinander im Hintergrund und dauert insgesamt ungefähr 5 Minuten, abhängig von Verbindung und API. Fortschritt steht unter dem Gerät. API-Pausen sind beabsichtigt.

Feste Klimazeiträume bleiben dauerhaft gespeichert; die Historie wird um vollständige Jahre ergänzt. Erfolgreiche Teilabrufe werden wiederverwendet. Fehler bleiben sichtbar; neuer automatischer Versuch frühestens nach 15 Minuten. Nur einen App-Tab für umfangreiche Erstabrufe verwenden. Browserdaten können durch Speicherbereinigung verloren gehen.

Demo-Wetter und Demo-Klima sind synthetisch und getrennt von echten Daten. Netzfehler führen nie zu einem stillen Wechsel auf Beispieldaten. Diese README und `docs/methodik.md` erklären Quellen, Einheiten und Grenzen. Der Info-Dialog wurde entfernt. **JSON exportieren** enthält Herkunft und Datenmodus.

## Technik und Hardware

Datenabruf in `src/data/`, Berechnungen in `src/calc.ts`, SVG-Darstellung in `src/ui/`, Steuerung in `src/main.ts`. Keine Python-/Seaborn-Laufzeit. Helvetica wird lokal verwendet, nicht als Fontdatei mitgeliefert; Systeme ohne Helvetica verwenden Arial bzw. ihre Sans-Serif-Ersatzschrift.

**Raspberry Pi:** gesamte Weboberfläche aus `dist/` über lokalen Webserver und Chromium weiterverwendbar. **ESP32/Presto:** Oberfläche mit LVGL/C++ bzw. MicroPython/PicoGraphics neu umsetzen. Das JSON-Format, Einheiten und Berechnungsdefinitionen sind übertragbar; große Rohdaten müssen für kleine Geräte aufbereitet werden. Die Browservorschau simuliert keine Mikrocontroller-Leistung.

[Hardware, Energieverbrauch und App Store](docs/hardware.md) · [Daten, Methodik und Quellen](docs/methodik.md) · [JSON-Format und externe Modelladapter](docs/data-format.md)

## Prüfen

```sh
npm test
npm run test:browser
node tests/production-offline.mjs   # Produktionsvorschau muss laufen
```

Browserprüfungen verwenden installiertes Google Chrome. 16 Rechentests und 11 Browserszenarien prüfen Größen, Überlauf, Einheiten, Farben, Uhrzeit, Auswahl, Export, Cache, Netzfehler und automatisches Laden. Screenshots liegen in `test-results/`.

Optionaler echter Wetter-/Radartest ohne umfangreiche Klimaabfragen:

```sh
node tests/weather-radar-live.mjs
```

`tests/live-smoke.mjs` und `tests/radar-history-live.mjs` laden auch umfangreiche echte Daten und verbrauchen entsprechendes API-Kontingent. Wetter-/Ensemble-/Klimamodellkennungen wurden am 7.10.2026, neue Radarfarben und Klimaraster am 8.10.2026 geprüft. Quellen und Veränderungen sind in der Methodik dokumentiert. Kein Repository wurde hochgeladen, keine Cloud-Ressource angelegt.


### Retina und physische Displaygröße

Oben das Display wählen, dann **Originalgröße** und **Originalgröße kalibrieren**. Die Linie mit einem echten Lineal messen, den abgelesenen Millimeterwert eingeben und **Anwenden** drücken. Die Linie sollte danach 100 mm lang sein. Maßstab wird lokal gespeichert; nach Monitor- oder Browserzoomwechsel erneut prüfen.

**Arbeitsansicht** nutzt CSS-Pixel und zeichnet auf Retina feiner. **Originalgröße** rendert zuerst in nativer Displayauflösung und skaliert dieses Raster auf die kalibrierte physische Größe. **Pixelraster 2×** vergrößert dieselben Rasterpixel zur Prüfung. Joy-IT erhält zusätzlich RGB565-Quantisierung (65.536 mögliche Farben). Mausbedienung bleibt aktiv; beim Informationsdialog wird für das Scrollen auf skalierte Browserdarstellung gewechselt. Pixelvorschau in Chrome mit `devicePixelRatio = 2` geprüft; wenn ein Browser die Rastererzeugung nicht unterstützt, erscheint ein ausdrücklicher Hinweis.

Die ca. 74 × 49,3 mm aktive Bildfläche des 3,5-Zoll-Displays sind aus Diagonale und 480:320 berechnet, keine bestätigten Panelmaße. Die Händlerangabe 85 × 56 mm ist nicht eindeutig als aktive Fläche definiert; die angegebene Proportion 8:5 widerspricht 480:320. Helligkeit, Kontrast, Subpixelstruktur, Blickwinkel, Touchdruck und Gerätegeschwindigkeit werden nicht simuliert. Details: [Hardware](docs/hardware.md).

Die 3,5-Zoll-Ansicht nutzt größere, kräftigere Beschriftungen und höheren Textkontrast. Zeitstempel, Einheiten und Quellen stehen überwiegend in 11–12 Pixeln; Diagrammachsen berücksichtigen die tatsächliche SVG-Skalierung. Lange Erläuterungen sind in dieser Größe verkürzt und unter „Info“ vollständig verfügbar. Die Größenkalibrierung bleibt davon unabhängig.

Radar-Reparatur (9.10.2026): Die DWD-Konturlinie wird getrennt von Regenklassen maskiert. PNGs werden vor dem Speichern geprüft, ungültige Altbestände neu geladen. Der Bildcache verwendet Safari-kompatible Binärdaten; vorhandene Blob-Einträge bleiben lesbar. Details und Tests: [Prüfprotokoll](../docs/pruefung.md).

## Zusätzliche Karten (9.10.2026)

Unter **Radar** stehen die Ebenen Regen, Temperatur, Wind und Luftqualität zur Auswahl. Die bestehenden Regenbilder und deren Einheiten bleiben unverändert.

- **Temperatur:** echtes DWD-WMS-Feld `Icon-eu_reg00625_fd_gl_T`, 2 m Höhe, ICON-EU 0,0625°, stündliche Ausgabe. Offizielle diskrete ISA-Farbskala in °C; keine Interpolation aus Ortswerten.
- **Wind:** echtes DWD-WMS-Feld `Icon-eps_reg025_fd_pl_SP10M`, 10 m Höhe, ICON-EPS 0,25°, sechsstündliche Ausgabe. Explizites Ensembleprodukt `Probabilities:>10m/s`: **Wahrscheinlichkeit in % für Wind über 36 km/h**, keine Geschwindigkeitsskala und keine Böenkarte. Die originale DWD-Wahrscheinlichkeitsskala wird verwendet.
- **Luftqualität:** [CAMS Europa über Open-Meteo](https://open-meteo.com/en/docs/air-quality-api), `domains=cams_europe`, ca. 11 km, stündliche Ortswerte für EAQI und PM₂,₅ in µg/m³. Die Geografie zeigt die Orte, keine erfundene Flächenverteilung. Es handelt sich um Modellwerte. Quellen: CAMS ENSEMBLE / Open-Meteo, CC BY 4.0.

DWD-Metadaten und Erstbilder werden beim Start vorbereitet und stündlich geprüft, Luftqualität alle sechs Stunden. Weitere Kartenzeiten werden automatisch vorgeladen; Fortschritt und Lücken sind sichtbar. Wetterkarten reichen höchstens 48 Stunden, in ihrer nativen Ausgabeauflösung. Quelle und Modelllauf stehen an der Karte. PNGs und Metadaten liegen dauerhaft in IndexedDB; bei einem neuen erfolgreich geladenen Lauf werden alte Feldbilder entfernt. Demo-Felder sind ausdrücklich synthetisch und werden getrennt erzeugt. Ausfälle zeigen gespeicherte Werte und Fehlermeldungen.

Kartenabruf: `src/data/fields.ts`; Darstellung: `src/ui/fields-view.ts`. Der JSON-Export verwendet für Karten `kind: field` mit Modell, Layer, Lauf und Unix-Zeitachse, für Luftqualität `kind: air` mit `places[].aqi` und `places[].pm25`. Flächenbilder bleiben separate PNG-Dateien; der Export enthält keine vorgetäuschten Temperaturzellen oder Windgeschwindigkeiten.

Offizielle [DWD-Geodienste](https://www.dwd.de/DE/leistungen/geodienste/help/nutzung_geodienste.html); WMS-Metadaten und Stile werden direkt von `maps.dwd.de` gelesen.

## Kompakte Navigation und Lesbarkeit (9.10.2026)

Links/rechts wischen im Inhalt wechselt die Unterseiten, zum Beispiel Regen → Temperatur → Wind → Luftqualität. Über der oberen Menüzeile wechselt dieselbe Geste die Hauptansicht. Nach links geht es vorwärts, nach rechts zurück; die Liste endet am ersten/letzten Eintrag. Ansichten ohne Unterseiten verwenden auch im Inhalt die Hauptnavigation. Maus: mit gedrückter linker Taste ziehen. Zeitregler, Texteingaben und offene Menüs sind davon ausgenommen; vertikales Scrollen bleibt möglich. Die kalibrierte Rastervorschau tauscht vollständige Bilder aus, ohne beim Menüwechsel kurz zur Browserzeichnung zurückzuspringen.

Eine gemeinsame Zeile enthält Ansicht, Unterseite, Ort, Uhrzeit und Start. Bis 800 Pixel werden Ansicht und Unterseite über aufklappbare Menüs gewählt; bei 1280 Pixeln bleiben die Hauptansichten direkt erreichbar. Die zweite Kachelreihe entfällt. Fokus verwendet kräftige, kontrastreiche Zustands- und Stundenwerte sowie ausdrücklich °C statt eines alleinstehenden Gradzeichens. Die Legenden der großen Karten stehen in einer eigenen Spalte neben dem Kartenbild.

Das Regenradar ist auf ganz Brandenburg und Berlin zentriert. Der Ausschnitt passt sich an die Bildschirmproportionen an, ohne Landesränder abzuschneiden. Die senkrechte Intensitätsskala braucht nur 58–64 Pixel Breite. DWD-Basiszeit und Prognosezeit stehen in einer schmalen Zeile; doppelte Überschrift, „Bereit“-Text und leere Statusfußzeile entfallen. DEMO, offline gespeicherte beziehungsweise veraltete Daten bleiben gekennzeichnet. Ladebalken und Bedienelemente behalten beim Laden ihre Position. Unter 0,1 mm/h bleibt die Karte farblos; Schraffur bedeutet fehlende Daten. Der Kartenausschnitt ändert weder Rasterwerte noch deren Auflösung.

**Gemeinsamer Kartenaufbau:** Regen, Temperatur, Wind und Luftqualität verwenden `src/ui/map-layout.ts`. Kartenfläche, senkrechte Skala rechts, Zeitzeile, Ladebalken und Vorschau/Jetzt bleiben beim Wechsel an denselben Positionen. Einheit und Farben entsprechen dem Produkt: mm/h, °C, Wind-Überschreitungswahrscheinlichkeit in % beziehungsweise EAQI. Temperaturhöhe und Windschwelle stehen an der Skala. Bei Prognosen für einen anderen Kalendertag wird das Datum ergänzt. Die Ortsbeschriftungen bleiben unabhängig vom Zoom lesbar.

Luftqualität bleibt eine Karte mit **drei modellierten Ortswerten**, ohne Interpolation zu einem Wetterfeld. Die Zahlen an den Orten zeigen den EAQI; PM₂,₅ in der Seitenleiste gilt für den oben ausgewählten Ort. Fehlende Werte erscheinen als Strich, nicht als Null. Die EAQI-Klassengrenzen folgen der [Open-Meteo-Dokumentation](https://open-meteo.com/en/docs/air-quality-api). Herkunft und Modellauflösung sind weiterhin im Tooltip der Quellenzeile sowie im exportierten Datensatz beziehungsweise dieser README beschrieben.

**Temperatur in 2 Metern über dem Boden** bezeichnet die meteorologische Bezugshöhe, keine Zeitdauer. Die Windkarte bezieht sich auf 10 Meter Höhe. Die verschiedenen Farbskalen haben verschiedene Größen: Regenintensität in mm/h, Temperatur in °C und Windwahrscheinlichkeit in %. Sie sind untereinander nicht quantitativ vergleichbar.

Temperatur- und Windbilder werden nun automatisch für den verfügbaren Zeitraum bis 48 Stunden vorgeladen (höchstens zwei gleichzeitige Feldbild-Abrufe). Ladefortschritt, Zeitleiste, Vorschau/Pause und Jetzt entsprechen dem Regenradar. Die Wiedergabe startet nach vollständigem Vorladen; fehlende Bilder werden als Lücke angezeigt und gezielt erneut geladen. Native Schritte bleiben erhalten: Temperatur 1 Stunde, Wind 6 Stunden. Luftqualität verwendet die bereits geladenen stündlichen Ortswerte; dafür ist kein erneuter Bildabruf erforderlich. Quellen-, Fortschritts- und Statusbereiche behalten ihren Platz während des Ladens.

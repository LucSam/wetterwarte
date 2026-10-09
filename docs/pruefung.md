# Prüfung · 8. Oktober 2026

Intel-Mac, Node 22.14.0, npm 10.9.2, installiertes Google Chrome. Aktueller Stand nach Umstellung auf Helvetica, gemeinsame Farben, automatische Tag-/Nachtdarstellung und neue Klima-/Radarkarten.

- Produktionsbuild und TypeScript-Prüfung erfolgreich. Laufzeitbibliothek SunCalc 2.1.1; SVG-Darstellung ohne zusätzliche Plotbibliothek. Haupt-JavaScript etwa 215 kB, zusätzlich 389 kB für das historische Klimaraster (etwa 82 kB gzip).
- **15 Rechentests bestanden:** Quantile, Ensemble-Mitglieder und gemeinsame Zeitpunkte, fehlende Daten, Berliner Sommer-/Winterzeit, Schaltjahre, heiße Tage ≥30 °C, vollständige Saisons, ERA5-Referenz, Mondphase, Regenklassen und Farben, Refresh-Intervalle, DWD-Rastereinheiten, saisonale Sonnenzeiten sowie kontinuierliche Sechs-Stunden-Ensemblekurven mit erhaltenen echten Lücken.
- **11 Browserszenarien bestanden:** alle fünf Ansichten × vier Displaygrößen, zusätzliche Klimatabs und Variablen, 390-px-Fenster, Orts-/Stunden-/Jahreswahl, Export, Einstellungen, Informationsdialog, fehlende/alte Daten, Demo-/Live-Trennung und Netzfehler.
- Bei 480 × 320, 800 × 480 und 1280 × 720 kein vertikaler oder horizontaler Überlauf der regulären Ansichten. Bei 800 × 480 verteilen vier Wetterseiten die Inhalte auf vollständige Ansichten. Radarsteuerung und Uhr passen auch bei 480 × 480; andere umfangreiche Ansichten bleiben dort vertikal scrollbar. Informationsdialog kann scrollen.
- Automatischer Abruf aller Datenprodukte aus der Uhransicht mit vollständigen Testantworten geprüft: Wetter einschließlich getrennter Tagesvorschau, Radar, Ensemble, drei ERA5-Blöcke, sechs Klimaperioden. Cache-Wiederverwendung und 30-Minuten-/5-Minuten-/3-Stunden-Intervalle geprüft, ohne dabei echte umfangreiche API-Daten erneut abzurufen.
- Radar-Zeitsteuerung mit Uhr 09:10 und Basis 09:00 geprüft: „Jetzt“ zeigt Prognose 09:10, nennt separat die zehn Minuten alte Basis. Nach Minutenwechsel 09:11 wird Prognose 09:15 gewählt; Basis ist elf Minuten alt. Vergangene Zeitpunkte sind nicht mehr anwählbar. Bei manuellem Vorlauf bleibt dieselbe Referenzzeit im Bildabruf erhalten.
- Nachtmodus in allen fünf Ansichten und Klimatabs visuell geprüft. Manuelle Wahl bleibt nach Neuladen erhalten. Automatische Umschaltung unterscheidet Sommerabend und Winternacht; dieselbe Temperaturfarbe in Wetter und Uhr bestätigt.
- Chrome meldet für die tatsächlich gerenderten Ziffern **Helvetica**. Die Schrift wird lokal verwendet, nicht mit der App verteilt.
- Echter Wetter-/Radartest am 8.10.: ICON-EU für Elstal/Potsdam/Berlin, ECMWF IFS mit 14 Tageswerten je Ort, DWD-Manifest sowie aktuelles und zukünftiges Radarbild (+90 Minuten) erfolgreich. Neue Blau–Violett–Gelb-Pixelklassen geprüft. Fehlende Abdeckung als separate Schraffurmaske dargestellt, nicht als trockene Fläche. Bereits geladene Bilder offline wiederverwendet.
- DWD-Klimaraster: Originaldateien 1961–1990 und 1991–2020 heruntergeladen, Geometrien verglichen, vollständige gemeinsame 5-km-Zellen berechnet. Elstal-Zelle: 8,99 → 10,08 °C; angezeigte Genauigkeit eine Nachkommastelle. Offline verfügbar.
- Produktionsoberfläche inklusive erst später geöffneter Klimakarte nach vollständigem Erstbesuch erfolgreich offline neu geladen. Buildabhängige Cache-Version aus Manifest, HTML und Worker erzeugt.

Bereits zuvor echte Daten geprüft: DWD ICON-EU-EPS mit 40 Mitgliedern, ECMWF AIFS mit 51 Mitgliedern, alle drei Klimamodelle und beide vollständigen 20-Jahres-Zeiträume sowie ERA5 1961–2025 für Elstal. Diese umfangreichen Downloads wurden bei der Oberflächenüberarbeitung nicht unnötig wiederholt.

Grenzen: keine Prüfung auf realer Display-Hardware und keine Mikrocontroller-Leistungssimulation. Der Nachtmodus steuert Farben; Hardware-Hintergrundbeleuchtung ist nicht angebunden. DWD-Raster und ERA5 sind keine punktgenauen Stationsmessungen. API-Verfügbarkeit und CORS können sich ändern. Browser-Speicherbereinigung kann lokale Daten löschen.

Screenshots und temporäre Live-Testdaten: `test-results/` und `.audit/`, beide Git-ignoriert. Browserläufe überschreiben Screenshots. Die optionalen Live-Skripte sind getrennt von den regulären Tests; umfangreiche Live-Prüfungen verbrauchen entsprechendes API-Kontingent.

## Mondgrafik, Überarbeitung vom 08.10.2026

NASA-Oberflächentextur mit zeitabhängig berechneter Beleuchtung ersetzt die Sternenkachel. Sichel (zu- und abnehmend), beide Viertel und Vollmond in heller und dunkler Darstellung visuell geprüft. `npm run build` erfolgreich; bestehende Browserprüfungen „All views and sizes“ und „Automatic and manual themes“ bestanden, einschließlich aller drei Vorschaugrößen und ohne Scrollen bei 1280 × 720. `node tests/production-offline.mjs` bestätigt auch das Laden der Mondtextur nach einem Offline-Neuladen.

## 800 × 480, frühere Zwischenfassung vom 08.10.2026

Einzeilige Navigation, kurze Statuszeile und nur eine beschriftete Messzeit im Radar. Kartenbereich dort etwa 300 statt zuvor 170 Pixel hoch. Wetter-Startseite mit Temperatur, Regenradar und waagerechter Tagesreihe; Stunden, Verlauf und Details separat. Details enthalten kompakte Messwerte und einen größeren Mond. Alle vier Wetterseiten in Hell und Dunkel, Radarzeitsteuerung, sämtliche Klima-Unteransichten und Modellvergleich ohne regulären Inhaltsüberlauf geprüft. Die Scrollbereiche wurden nicht einfach abgeschnitten. Quellen, Abrufstand und Methodik bleiben im Informationsdialog. Vollständiger Lauf: 10 Browser- und 15 Rechentests bestanden; Produktionsbuild erfolgreich.


## Aktueller Stand: Vorschau, Mond, Nowcast und Retina

800 × 480: Wind, Niederschlag und Wahrscheinlichkeit stehen unter Min/Max in der Übersicht. Vorschau verbindet Stunden- und Tagesreihen; zwei disjunkte Sieben-Tage-Gruppen geprüft. Mond hat eine eigene Seite mit großer Scheibe, Tagesauswahl und Wochenwechsel. Historische Klimakarten wechseln die große Zahl zwischen absolutem Periodenmittel und Differenz; Zahlen gegen die angezeigten Periodenwerte geprüft. Live-Tagesdaten am 8.10. für 8.–21.10.2026 erhalten. Echter DWD-Nowcast mit Referenz 15:50 und Gültigkeit 17:20 abgerufen und offline wiederverwendet.

Joy-IT 480 × 320: Wetter-Unterseiten, Radar, Modelle, Uhr und alle Klima-Unteransichten in Hell und Dunkel auf Inhaltsüberlauf geprüft; auf diesem Format sind Stunden und Tage getrennt. Retina-Prüfung mit Chrome und `devicePixelRatio = 2`: Canvas bleibt exakt 480 × 320 statt 960 × 640, RGB565-Farben haben höchstens 32/64/32 Kanalstufen. Kalibrierung anhand einer angenommenen Messung von 80 mm geprüft, erwartete physische Skalierung mathematisch kontrolliert, nach Neuladen beibehalten. Klicks durch das Rasterbild, Mondwechsel, Uhr und Wechsel zu 800 × 480 geprüft. Die normale 800er-Vorschau und großen Ansichten bleiben ohne Inhaltsüberlauf.

Das 3,5-Zoll-Maß ist geschätzt aus Diagonale und Pixelproportion, nicht am realen Gerät gemessen. Die Linealkalibrierung auf dem tatsächlichen Laptop kann nur der Benutzer durchführen. Kleine Beschriftungen bleiben auf dieser Hardware physisch klein; die Vorschau kaschiert das nicht mit Retina-Nachzeichnung. Keine Aussage zu Displaygamma, Ablesbarkeit im Sonnenlicht, Touchdruck oder Bildrate auf dem Pi.


## Lesbarkeit auf 3,5 Zoll · 08.10.2026

Kleine HTML-Beschriftungen von 8–10 auf überwiegend 11–12 Pixel angehoben, mit Helvetica in kräftigerem Schnitt und kontrastreicherem Sekundärtext. Achsenbeschriftungen werden zusätzlich anhand der SVG-Skalierung angepasst; überstehende Textbegrenzungen erweitern die viewBox ohne Datenveränderung. Karten zeigen auf dem kleinen Panel größere Ortsnamen und weniger Nebenbeschriftungen. Lange Methodiktexte wurden für die Anzeige verkürzt; vollständige Angaben, einschließlich Farbsättigung und Abrufproblemen, stehen unter Info. Elstal erscheint im kleinen Ortswähler vollständig.

Zusätzlich zu den Layoutbildern speichert der Browsercheck native 480×320-RGB565-Bilder aller Seiten unter `test-results/native-320-*.png`. So wird die tatsächlich rasterisierte Schrift statt nur der glatten Retina-Darstellung beurteilt. Temperatur, heiße Tage und Niederschlag der Klimaprojektion werden auch auf Inhaltsüberlauf geprüft. Die Kalibrierung und alle Datenberechnungen bleiben unverändert.

# Methodik und Datenzugriff

## Daten und wissenschaftliche Grenzen

API-Verfügbarkeit und Modellkennungen am **7. Oktober 2026** anhand der Dokumentation und echten Antworten geprüft:

| Ansicht | API / tatsächliche Modellkennung | Darstellung |
|---|---|---|
| Wetter | `api.open-meteo.com/v1/forecast`, `icon_eu` | Regionales DWD-Modell, etwa 7 km; stündliche Werte, aktuelle modellierte Bedingungen; 4 Kalendertage abgerufen, 48-Stunden-Auswahl |
| Tagesvorschau | `api.open-meteo.com/v1/forecast`, `ecmwf_ifs025` | ECMWF IFS 0,25°; 14 Kalendertage mit Min/Max, Niederschlagssumme, verfügbarer Wahrscheinlichkeit und WMO-Symbol; getrennt von ICON-Stundenwerten |
| Modellvergleich | `ensemble-api.open-meteo.com/v1/ensemble`, `icon_eu_eps`, `ecmwf_aifs025_ensemble` | 40 / 51 Mitglieder; 13 km / 0,25°; nur gemeinsame gültige UTC-Zeitpunkte im 6-Stunden-Raster, angezeigt in Europe/Berlin |
| Klima | `climate-api.open-meteo.com/v1/climate`, `MPI_ESM1_2_XR`, `EC_Earth3P_HR`, `MRI_AGCM3_2_S` | 20-jährige Referenz 1995–2014 und Zukunft 2030–2049 innerhalb derselben Modelle |

Die Wetterwahrscheinlichkeit wird von Open-Meteo aus DWD-Ensembles abgeleitet (> 0,1 mm/h). Niederschlagsmengen gelten für die vorangehende Stunde; tägliche Summen und Extrema für den Berliner Kalendertag. Wind in km/h, Temperatur in °C, Niederschlag in mm. Ortskoordinaten sind Punktabfragen, keine Stadtmittel.

Das Ensemble zeigt Median und 10.–90. Perzentil je Modell mit linear interpolierten empirischen Quantilen. Alle erwarteten Mitglieder müssen je Zeitpunkt vorhanden sein. Die Flächen sind **Ensemble-Streuung, kein kalibriertes Konfidenzintervall**. Es gibt keine Unsicherheitsfläche aus bloßen Unterschieden zweier Einzelmodelle. Open-Meteo liefert interpolierte Stundenwerte; wir nutzen bei AIFS nur native Sechs-Stunden-Zeitpunkte. Linien zwischen diesen Punkten sind Lesehilfen, keine zusätzlichen Daten. Die Modelle bleiben auf ihren unterschiedlichen Gittern.

Die Klima-API enthält nur HighResMIP-Projektionen **nahe RCP8.5**, keinen auswählbaren Szenario-Parameter. Daher gibt es keinen fiktiven SSP-/Szenariowähler. Laut API-Parametertabelle reicht die Verfügbarkeit von 1950-01-01 bis 2050-01-01; 2049 ist das letzte hier genutzte vollständige Jahr. Historische Klimamodellwerte sind **keine Beobachtungen**. Biaskorrektur auf ERA5-Land ist aktiv; die 10-km-Aufbereitung ist keine entsprechende physikalische Modellauflösung (hier native Modelle etwa 20–51 km).

- Temperatur: Tagesmittel → Jahresmittel → gleich gewichtete Mittel der 20 Jahre.
- Heiße Tage: Jahresanzahl der Tage mit Tagesmaximum **≥ 30 °C** → 20-Jahresmittel.
- Niederschlag: vollständige DJF-/MAM-/JJA-/SON-Summen → Mittel von jeweils 20 Saisons. DJF gehört zum Jahr von Januar/Februar; zusätzlich wird Dezember des Vorjahres abgerufen.
- Änderungen werden zuerst je Modell gebildet. Danach zeigt die App Median und Minimum–Maximum der verfügbaren Modelländerungen. Das ist eine Auswahl von drei Modellen aus sieben API-Modellen, keine vollständige Abschätzung aller Klimarisiken. Bei fehlenden Tagen wird das betreffende Modell ausgeschlossen und der Fehler angezeigt. Ein einzelnes Modell erlaubt keine aussagekräftige Modellbandbreite.

Die API liefert in diesen Antworten keinen eindeutigen Initialisierungszeitpunkt des Modelllaufs. `runAt` bleibt deshalb `null`. **Abrufzeit ist nicht Modelllaufzeit.** Alte Wetter- und Ensemble-Caches werden sichtbar gekennzeichnet; sie werden nicht in die Gegenwart verschoben.

## Cache und API-Nutzung

Einstellungen liegen in `localStorage`, Wetter-/Ensembleprodukte und tägliche Klima-Rohdaten samt Aggregaten in IndexedDB. Demo-Daten sind getrennt und werden nicht als Echtcache gespeichert. Wetter aktualisiert bei geöffneter App alle 30 Minuten, Ensembles alle 3 Stunden. Alle Produkte für den gewählten Ort werden im Echtmodus automatisch vorbereitet, unabhängig von der angezeigten Ansicht. Klimadaten verfallen nicht automatisch. Browserdaten können durch Speicherbereinigung verloren gehen; JSON-Export dient zur Weiterverarbeitung, nicht als integrierte Wiederherstellung.

Die kostenlose Open-Meteo-API ist für nichtkommerzielle Nutzung: aktuell 600 gewichtete Aufrufe/Minute, 5.000/Stunde, 10.000/Tag und 300.000/Monat. Lange Zeiträume, mehrere Variablen, Modelle und Orte erhöhen die Zählung. Ein 20-Jahre-Klimaabruf mit 3 Variablen entspricht ungefähr 157 Aufrufen. Sechs Abrufe pro Ort ergeben rund 945; die App hält mindestens 32 Sekunden Abstand zwischen Klimaabrufen. Automatische Wiederholungen frühestens nach 15 Minuten; HTTP 429 wird erklärt. Mehrere parallele Browser-Tabs oder andere Programme teilen gegebenenfalls dasselbe IP-Kontingent; zum Klimaabruf nur einen Tab verwenden.



## Historischer Rückblick

ERA5 wird über `archive-api.open-meteo.com/v1/archive` explizit mit `models=era5` gewählt, damit kein wechselnder Best-Match-Mix einen künstlichen Zeittrend erzeugt. 1961 bis zum letzten abgeschlossenen Kalenderjahr, momentan 2025; Tagesmitteltemperatur, Tagesmaximum und Niederschlag, Berliner Tagesgrenzen. Nur vollständig vorhandene Jahre werden akzeptiert. Jährliche Temperatur = Tagesmittel gemittelt, heiße Tage = Tage mit Maximum ≥ 30 °C, Niederschlag = Jahressumme.

Temperaturstreifen zeigen Jahresabweichungen gegenüber dem vollständig vorliegenden Referenzzeitraum 1991–2020. Die kontinuierliche Blau–Weiß–Rot-Skala deckt −2,5 bis +2,5 °C ab, darüber saturieren die Randfarben. Das schmale Farbband ergänzt eine Jahreskurve und ein nachlaufendes Zehnjahresmittel. Exakte Zahlen stehen beim auswählbaren Jahr. Der Zehnjahreswert ist die mittlere Temperaturabweichung der letzten zehn vollständigen Jahre; kein linear geschätzter Trend pro Jahrzehnt. ERA5 ist eine Reanalyse aus Beobachtungen und Modellrechnung, keine Stationsmessung. Historischer Rückblick und HighResMIP-Zukunft bleiben getrennte Produkte mit explizit verschiedenen Referenzzeiträumen.

Der Historienabruf ist in 1961–1990, 1991–2020 und 2021–letztes vollständiges Jahr aufgeteilt. Rund 510 gewichtete Open-Meteo-Aufrufe insgesamt, mindestens 32 Sekunden Abstand. Diese Drosselung teilt sich den Zeitstempel mit dem Klimaabruf. Persistiert werden kompakte Jahreswerte pro Block; automatischer Erstabruf; danach Ergänzung um vollständige Jahre. Vollständige Teilblöcke bleiben nach Abbruch erhalten.

## DWD-Radar

Quelle: `maps.dwd.de/geoserver/dwd/Niederschlagsradar/ows`, Layer `dwd:Niederschlagsradar`, RV-Produkt. Manifest und echte Zukunftsbilder am 8. Oktober 2026 geprüft. Auflösung laut GetCapabilities: 1 km, 5 Minuten. Die App liest die jüngste veröffentlichte `REFERENCE_TIME` und die angebotene `time`-Dimension. Gültigkeitszeiten reichen bis zwei Stunden nach dieser Referenz. Das ist eine radarbasierte Kurzfristprognose (Nowcast); die Extrapolation bestehender Regenfelder wird mit dem Vorlauf unsicherer, insbesondere bei Neubildung oder Auflösung von Schauern.

`DIM_REFERENCE_TIME` bleibt für alle Bilder eines Laufs konstant. `TIME` wählt die jeweilige Gültigkeitszeit. „Jetzt“ zeigt den ersten veröffentlichten Zeitpunkt **ab** der Systemzeit, ohne die Bildzeit umzubenennen. Die Zeitleiste und das Abspielen beginnen dort; vergangene Zeitpunkte werden nicht angeboten. Durch die Lieferverzögerung bleibt weniger als zwei Stunden Vorlauf ab jetzt. Die Beschriftung unterscheidet „Prognose“ und „Basis“; bei exakt gleicher Referenz und Gültigkeit ist es eine Messung. Ein Radarstand älter als 20 Minuten wird als veraltet markiert.

WMS-Bilder werden in EPSG:3857 angefordert; Landesgrenzen und Orte werden in dieselbe Projektion abgebildet. Echte räumliche Raster, keine Interpolation unserer drei Ortspunkte. Die DWD-Intensitätsklassierung besteht aus ungleich breiten Intensitätsklassen in mm/h; die Farbskala ist **keine lineare numerische Achse**. Transparenz bezeichnet Werte unter 0,1 mm/h; Schraffur fehlende Radardaten. Fehlende oder nicht ladbare Bilder werden mit einem expliziten Hinweis überdeckt. Intensität ist keine Niederschlagssumme. Die 48-Stunden-Stundenreihe steuert das Radar nicht.

Manifeste werden bei geöffneter App alle 5 Minuten geprüft. Bilder werden bei Auswahl geladen und als Blob in IndexedDB gespeichert; Cache-Schlüssel enthalten sowohl Referenz- als auch Gültigkeitszeit. So kann ein älteres Bild nicht als neues Prognosebild desselben Zielzeitpunkts erscheinen. Bei neuem Manifest bleiben dessen bis zu 25 Bildschlüssel erhalten. Bereits geladene Bilder funktionieren offline, fehlende werden als solche angezeigt. Im Demo-Modus ist das gesamte räumliche Feld synthetisch und ausdrücklich gekennzeichnet.

## Historische Klimaraster

DWD Climate Data Center: vieljährige Mittel der 2-m-Lufttemperatur, 1961–1990 und 1991–2020; jeweils Jahresraster (`17`). Originalraster: 1 km, EPSG:31467, Werte in Zehntelgrad Celsius. Sie wurden vom DWD aus Stationsmessungen und Höheninformation abgeleitet. Die tatsächliche Informationsdichte hängt vom Stationsnetz ab; Rasterauflösung ist nicht gleich Messdichte. Veränderte Stationsnetze und Interpolation begrenzen den Vergleich. Es handelt sich um historische Mittelwerte, nicht um zukünftige Tagesprognosen.

- [Jahresraster 1961–1990](https://opendata.dwd.de/climate_environment/CDC/grids_germany/multi_annual/air_temperature_mean/grids_germany_multi_annual_air_temp_mean_1961-1990_17.asc.gz)
- [Jahresraster 1991–2020](https://opendata.dwd.de/climate_environment/CDC/grids_germany/multi_annual/air_temperature_mean/grids_germany_multi_annual_air_temp_mean_1991_2020_17.asc.gz)
- [DWD-Datensatzbeschreibung](https://opendata.dwd.de/climate_environment/CDC/grids_germany/multi_annual/air_temperature_mean/DESCRIPTION_gridsgermany_multi_annual_air_temperature_mean_6190_en.pdf)
- [CDC-Nutzungsbedingungen: CC BY 4.0](https://opendata.dwd.de/climate_environment/CDC/Terms_of_use.pdf)

Die App bündelt ausschließlich vollständige, in beiden Perioden gültige 5 × 5-Blöcke zu 5-km-Zellen. Umrechnung von Zehntelgrad in °C vor Darstellung; keine räumliche Interpolation. Die Zellpolygone werden mit einer Siebenparameter-Transformation nach WGS84 umgerechnet. Ein möglicher Meterbereich-Fehler der Datumstransformation ist gegenüber der 5-km-Darstellung klein. Fehlende Randblöcke bleiben leer. Ausgewählter Bereich: Nordostdeutschland, 4.690 Zellen. Anklickbare Werte beziehen sich auf eine Zelle, nicht auf eine punktgenaue Ortsmessung.

Der verarbeitete Datensatz liegt in `src/data/climate-field.json`, inklusive Prüfsummen der beiden Originaldateien. Er ist etwa 389 kB groß, als Build-Datei etwa 82 kB gzip. Reproduzierbare Aufbereitung nach Download der Originale:

```sh
node scripts/prepare-climate-map.mjs /pfad/1961-1990.asc.gz /pfad/1991-2020.asc.gz
npm run build
```

Der Demo-Modus übernimmt nur die Zellgeometrien und erzeugt eigene synthetische Werte. Der historische Kartensatz ist ein festes lokales Produkt; er benötigt keinen wiederholten API-Abruf. ERA5-Verlauf und HighResMIP-Projektionen bleiben eigenständige Produkte mit eigenen Referenzzeiträumen.

## Darstellung und Farben

Alle Darstellungen werden direkt als SVG erzeugt. Seaborn ist nicht eingebunden. Die Entscheidung für einen Diagrammtyp richtet sich nach Variable und Vergleich:

| Daten | Darstellung | Zweck |
| --- | --- | --- |
| Stündliche Temperatur | Linie mit Zeitachse | zeitlicher Verlauf; Lücken bleiben erhalten |
| Stündliche Niederschlagsmenge | Balken ab null | Menge pro vorangehender Stunde |
| Tagesminimum und -maximum | horizontale Spanne auf gemeinsamer Skala | Tagesbereiche vergleichen |
| Ensemble-Temperatur | Medianlinie, P10–P90-Band | Streuung innerhalb jedes Modells, keine Differenz-Konfidenzintervalle |
| Historische Temperaturfelder | georeferenziertes Zellraster | räumliche Unterschiede aus tatsächlichen Flächendaten |
| Jährliche Temperaturabweichung | Zeitreihe, Flächen über/unter null, nachlaufendes Zehnjahresmittel | Jahresvariabilität und längerfristigen Verlauf getrennt zeigen |
| Modellierte Klimaänderung | verbundene Referenz-/Zukunftspunkte je Modell | Änderungen ohne verdeckte Einzelmodelle |
| Saisonaler Niederschlag | Punktgruppen je Jahreszeit, drei Modellformen, Min–Max-Spanne | diskrete Saisons vergleichen, ohne Zwischenwerte zu implizieren |

Temperaturdifferenzen: symmetrische Blau–Weiß–Rot-Skala um null, Grenzen ±2,5 °C. Absolute historische Temperaturmittel: gemeinsame sequenzielle ColorBrewer-YlOrRd-Skala 5–13 °C für beide Perioden. Modellfarben im Ensemble kennzeichnen die Identität des Modells, nicht kalt/warm. Saisonale Änderungen: Blau für Zunahme, Braun für Abnahme; Kreis, Quadrat und Dreieck unterscheiden die Modelle. Bandbreiten aus drei Klimamodellen sind keine probabilistischen Intervalle.

Radar: Originalfarben der 15 DWD-Klassen werden auf eine festgelegte Blau–Violett–Gelb-Palette übertragen. Klassengrenzen und Alphawerte bleiben erhalten. Die Legende zeigt dieselben Farben und Schwellen; gleich breite Farbfelder bedeuten keine gleichen numerischen Abstände. Unbekannte farbige Pixel werden wie fehlende Radardaten markiert; bei mehr als 2 % unbekannten Farben wird das Bild als nicht zuverlässig darstellbar abgelehnt. Die gespeicherten Original-PNGs bleiben unverändert. Die breitere Radaransicht und die regionale Wetterkarte verwenden dieselbe Projektion. Die grauen Bereiche des DWD-Originalbilds werden als eigene Maske extrahiert und mit einer dezenten diagonalen Schraffur dargestellt. Sie kennzeichnen fehlende Datenabdeckung. Die Maske bleibt von transparenten, niederschlagsarmen Gebieten unterscheidbar.

Diese Auswahl ist für die jeweiligen Vergleiche begründet; sie wurde nicht durch eine Nutzerstudie als universell beste Darstellung nachgewiesen. Leitlinien zu Farbskalen: [Seaborn-Dokumentation](https://seaborn.pydata.org/tutorial/color_palettes.html). Absolutskala: [ColorBrewer](https://colorbrewer2.org/), Cynthia Brewer, Mark Harrower und Pennsylvania State University. SVGs verwenden Helvetica. Die Schrift wird nicht verteilt; ohne lokal installierte Helvetica greift die CSS-Ersatzschrift.

## Mond und Zeit

Mondphase und beleuchteter Anteil werden mit [SunCalc 2.1.1](https://github.com/mourner/suncalc) astronomisch aus der Systemzeit berechnet. Kein Netzwerkabruf nötig. Die Darstellung verwendet eine feste Mondscheibe aus [NASA SVS: Moon Phase and Libration, 2023](https://svs.gsfc.nasa.gov/5048/) (Ernie Wright / NASA Scientific Visualization Studio, LRO; Public Domain). Lokal gespeichert: `src/assets/moon-full.jpg`, Original `phase_full.1571_print.jpg`. Die Beleuchtung wird aus dem berechneten Anteil auf einer Kugel abgeleitet, mit angenäherter Lommel–Seeliger-Schattierung. Die Schattenseite bleibt zur Erkennbarkeit schwach sichtbar. Keine Simulation der Libration, lokalen Drehung, Kraterschatten oder Mondfinsternisse; die Oberflächenaufnahme ist kein aktuelles Mondfoto. Bewölkung und tatsächliche Sichtbarkeit werden nicht abgeleitet. Im Wetter-Zukunftsmodus wird die Phase für den gewählten Zeitpunkt berechnet und entsprechend datiert. Auch im Demo-Modus ist diese Berechnung real und ausdrücklich gekennzeichnet. BSD-2-Clause-Lizenz unter `public/SUNCALC-LICENSE.txt`.

Die Uhr liest jede Sekunde die Systemzeit, formatiert in Europe/Berlin. Sommer-/Winterzeit und Tageswechsel werden durch `Intl` behandelt. „Jetzt“ im Wetter folgt dem aktuellen Stundenfenster; der Zeitstempel der zuletzt geladenen modellierten aktuellen Bedingungen bleibt sichtbar. Hintergrund-Timer können vom Browser gedrosselt werden; beim Zurückkehren in die App werden Datenstände erneut geprüft.

## Quellen und Attribution

- [Open-Meteo Wetter](https://open-meteo.com/en/docs), [DWD](https://open-meteo.com/en/docs/dwd-api), [Ensemble](https://open-meteo.com/en/docs/ensemble-api), [Klima](https://open-meteo.com/en/docs/climate-api), [ERA5-Archiv](https://open-meteo.com/en/docs/historical-weather-api), [Nutzungsgrenzen](https://open-meteo.com/en/pricing).
- Wetter-/Klimadaten: Open-Meteo, DWD, ECMWF und jeweilige Klimamodellgruppen, CC BY 4.0. Veränderungen: zeitliche Auswahl, Quantile, Jahres-/Saisonaggregate und Differenzen.
- [DWD-WMS-Radar](https://maps.dwd.de/geoserver/dwd/Niederschlagsradar/ows?service=WMS&request=GetCapabilities), RV. Veränderungen: Auswahl prognostizierter Frames desselben Referenzlaufs, Kartenprojektion und Einfärbung vorhandener Klassen.
- Deutsche Ländergrenzen: Bundesamt für Kartographie und Geodäsie, Stand 2021, über [geoBoundaries DEU ADM1](https://www.geoboundaries.org/api/current/gbOpen/DEU/ADM1/), Revision `9469f09`. Datenlizenz Deutschland – Namensnennung 2.0. Koordinaten auf vier Nachkommastellen gerundet und geometrisch vereinfacht. Grenzen sind Kartenkontext, keine meteorologischen Daten.
- Elstal: Open-Meteo-Geocoding / GeoNames, 52,5425 N / 12,98795 O.


## Automatische Tag-/Nachtdarstellung

Die Standardeinstellung `auto` verwendet SunCalc-Sonnenaufgang und -untergang für den Berliner Kalendertag und die gewählten Ortskoordinaten. Zwischen diesen Zeitpunkten gilt die helle Darstellung, sonst die dunkle. Die Berechnung verwendet die Systemzeit, unabhängig vom ausgewählten Prognosezeitpunkt. Jahreszeit und Sommer-/Winterzeit gehen über Datum, Koordinaten und Europe/Berlin ein. Es wird kein Umgebungslichtsensor verwendet; örtliche Abschattungen und Bewölkung sind nicht Teil dieser Berechnung.

`light` und `dark` erlauben manuelle Vorschau; die Einstellung liegt zusammen mit Ort und Displayformat in localStorage. Der automatische Wechsel wird beim Start, jede Sekunde und beim Wiederanzeigen der App geprüft. Farben für Messwerte, Text, Auswahlflächen und Diagrammlinien sind gemeinsame CSS-Variablen. Historische Raster und Radarfarben werden nachts zusammen mit ihren jeweiligen Legenden gleichmäßig auf 75 % Helligkeit gesetzt; Werte und Klassengrenzen bleiben unverändert.

Bei den vorgeschlagenen LCDs reduziert dieses Farbschema die Blendwirkung, ersetzt aber keine Hardware-Dimmung der Hintergrundbeleuchtung. Eine solche Dimmung muss später auf dem gewählten Gerät angebunden werden.


## Tagesvorschau, Zeiträume und Klimakarten-Auswahl

Die primäre DWD-ICON-EU-Abfrage lädt vier Kalendertage und stellt davon die nächsten 48 Stunden dar. ICON-EU bietet laut Open-Meteo bis zu fünf Tage, davon die ersten 78 Stunden in nativer Stundenauflösung. Für 14 Kalendertage wird separat `ecmwf_ifs025` abgefragt; die erfolgreich geprüfte API-Antwort vom 8.10.2026 reicht bis 21.10.2026. Deren Tageswerte haben eigene Quellen- und Abrufangaben im JSON. Beide Produkte werden alle 30 Minuten erneuert. Fehlt die Tagesvorschau, bleibt die regionale Stundenprognose nutzbar und ein Fehler erscheint in der Tagesansicht. Woche 2 enthält größere Unsicherheit; aus zwei Einzelmodellen wird kein Unsicherheitsband erzeugt. Die Tageswahrscheinlichkeit wird als von Open-Meteo gelieferter Wert übernommen, fehlende Werte als „–“.

Die große Zahl neben der historischen Klimakarte folgt dem gewählten Layer: „Änderung“ zeigt 1991–2020 minus 1961–1990; bei einer Jahresgruppe steht deren absolute Mitteltemperatur. Die Elstal-Zelle hat gerundet 9,0 bzw. 10,1 °C, damit +1,1 °C zwischen den beiden 30-Jahres-Mitteln. Das ist keine Änderung bis zum heutigen Tag. Absolute Layer teilen dieselbe Temperaturskala; Änderungen verwenden eine um null symmetrische divergierende Skala.

## Methodische Hinweise aus Climatematch / Neuromatch

Das geprüfte [Kursrepository](https://github.com/neuromatch/climate-course-content) ist Lehrmaterial, keine zusätzliche lokale Live-Datenquelle. Für diese App besonders nützlich:

- [Compute and Plot Temperature Anomalies](https://comptools.climatematch.io/tutorials/W1D1_ClimateSystemOverview/student/W1D1_Tutorial6.html): Abweichungen brauchen eine ausdrücklich genannte Referenz. Dieser Grundsatz gilt für Karten- und Jahresreihen; absolute Temperatur und Änderung werden separat ausgewiesen.
- [Quantifying Uncertainty in Projections](https://comptools.climatematch.io/tutorials/W2D1_AnEnsembleofFutures/student/W2D1_Tutorial3.html): Einzelmodelle und ihre Streuung gemeinsam beurteilen. Unsere drei HighResMIP-Modelle ergeben eine Min–Max-Bandbreite, keine kalibrierte Wahrscheinlichkeit; die größeren Wetterensembles zeigen getrennte P10–P90-Bänder.

Kein Kurscode und keine Abbildung wurden übernommen. Die lokale Oberfläche bleibt TypeScript/SVG; für spätere größere Rasteraufbereitung wären die im Kurs verwendeten xarray-/Matplotlib-Verfahren eine geeignete externe Verarbeitung, kein zusätzliches Laufzeiterfordernis des Displays.

# Kompaktes Datenformat v1

`src/types.ts` ist die maßgebliche TypeScript-Definition. Arrays vermeiden wiederholte Zeitstempel pro Variable. `null` bedeutet fehlend; niemals als 0 interpretieren. JSON bleibt Unicode; bei Geräten UTF-8 berücksichtigen.

Jedes Produkt trägt dieselben Herkunftsfelder:

```json
{
  "schema": 1,
  "kind": "ensemble",
  "mode": "demo",
  "source": "Synthetische Beispieldaten",
  "fetchedAt": 1791396000,
  "runAt": null,
  "timezone": "Europe/Berlin",
  "place": "elstal",
  "time": [1791417600, 1791439200],
  "series": [{
    "model": "example_model",
    "label": "Synthetisches Beispiel",
    "resolution": "Beispiel",
    "members": 3,
    "p10": [9.2, 10.2],
    "median": [10, 11],
    "p90": [10.8, 11.8],
    "count": [3, 3]
  }]
}
```

Die Zahlen in diesem Dokument sind ausschließlich Formatbeispiele. Alle Zeitstempel sind **Unixsekunden UTC**. `timezone` ist die Anzeigezeitzone, kein zusätzlicher Zeitstempeloffset. `fetchedAt` bezeichnet den Abruf, `runAt` die tatsächliche Modellinitialisierung, wenn geliefert. Keine Laufzeit aus `generationtime_ms` ableiten: Das ist lediglich Server-Rechenzeit.

## Wetter

`kind: weather`, `model`, eine gemeinsame `time`-Achse und `places`. Jeder Ort enthält:

- `id`: `elstal`, `potsdam`, `berlin`; Sollkoordinaten stehen in `config.ts`.
- `grid`: `[latitude, longitude]` der von der API zurückgegebenen Modellzelle.
- `current`: `time`, `temperature`, `wind`, `direction`, `code`.
- Zeitgleiche Arrays: `temperature` (°C), `rain` (mm, vorangehende Stunde), `probability` (%), `wind` (km/h), `direction` (Grad, meteorologische Herkunft), `code` (WMO).
- `days`: Berliner Kalenderdatum `YYYY-MM-DD`, `min`, `max`, `rain`, `probability` (Tagesmaximum), `wind` (Tagesmaximum).

Die kompakte Übertragung für ein kleines Gerät kann auf einen Ort und 49 Stunden reduziert werden; Ensemble-Einzelmitglieder und Klima-Tagesreihen gehören nicht auf das Displaygerät. JSON-Export enthält alle Orte des geladenen Wetterprodukts; es ist nicht binär gepackt.

## Ensemble

`kind: ensemble`, `place`, `time`, `series`. Jeder Punkt enthält die empirischen Quantile **eines** Ensembles, nicht den Unterschied zweier deterministischer Modelle. `count` zeigt die tatsächliche Mitgliederzahl je Zeitpunkt. Hier werden ausschließlich vollständige Mitgliedersätze verwendet. Bei externen Anbietern die Semantik ihrer Ensemblemitglieder dokumentieren.

## Klima

`kind: climate`, `place`, `baseline: [1995,2014]`, `future: [2030,2049]`, `scenario`, `models`, `errors`.

Jedes Modell besitzt `baseline` und `future` mit:

```json
{
  "temperature": 10.1,
  "hotDays": 9.2,
  "years": 20,
  "rain": { "DJF": 130.0, "MAM": 140.0, "JJA": 190.0, "SON": 150.0 }
}
```

Temperatur in °C, heiße Tage als mittlere Jahresanzahl, Niederschlag als mittlere saisonale Summe in mm. Die Oberfläche berechnet daraus Modelländerungen und deren Median/Spanne. Tägliche Klimareihen bleiben ausschließlich im lokalen Verarbeitungscache; sie werden nicht als Tagesvorhersage präsentiert.

## Externe vortrainierte Modelle

`ExternalForecastProvider` in `src/data/api.ts` beschreibt einen späteren Adapter:

```ts
interface ExternalForecastProvider {
  id: string;
  label: string;
  load(place: PlaceId, from: number, to: number, signal: AbortSignal): Promise<Ensemble>;
}
```

Ein Adapter kann einen später festgelegten HTTPS-/LAN-Endpunkt ansprechen. Vor dem Einbau: Schema, tatsächlichen Modellnamen, Quelle, Laufzeit, Einheiten, Ensemble-Mitgliedschaft und Zeitachse validieren; nur gemeinsame Zeitpunkte vergleichen. Ein deterministisches Modell benötigt einen eigenen Linientyp ohne Ensembleband und darf nicht künstlich zu einem Ensemble vervielfacht werden. Keine Anbieter sind vorausgewählt, keine Daten werden hochgeladen und keine lokalen Modelle trainiert.


## Ergänzung: Vergangenheit und Radar

`kind: history`: `model: era5`, `place`, `baseline: [1991,2020]`, `years: [{year, temperature, hotDays, rain}]`. Einträge sind vollständige Jahresaggregate; `hotDays` ist hier eine ganze Jahresanzahl, `rain` eine Jahressumme. Herkunft und Demo-Kennzeichnung entsprechen den anderen Produkten.

`kind: radar`: `model: dwd_rv`, `time` mit den verfügbaren Gültigkeitszeitpunkten ab der Basismessung bis höchstens +2 Stunden in UTC, `runAt` als jüngste explizite DWD-Referenzzeit, `frameErrors`. Die Georeferenz steht in `src/data/radar.ts` (`RADAR_EXTENT`, EPSG:3857, 1100 × 560 Pixel). Der JSON-Export enthält das Manifest, keine PNG-Bilder. Bilder liegen separat im Browsercache und werden über deterministische WMS-URLs abgerufen. Der Schlüssel enthält `runAt` und die Gültigkeitszeit; `DIM_REFERENCE_TIME` bleibt je Prognoselauf fest, `TIME` wählt dessen gültiges Bild. Die Bedienung bietet nur Zeitpunkte ab der Systemzeit an. `frameErrors` ist für persistente Anbieterfehler reserviert; aktuelle Bildabruf-Fehler werden pro Zeitpunkt in der UI angezeigt.

Für Mikrocontroller müssen PNG-Dekodierung und Rasterdarstellung gesondert geprüft werden. Ein lokaler Pi kann Radar auf die tatsächliche Displaygröße reduzieren; der Browser liefert hierfür keine Leistungszusage.


## Historische Klimakarte und Astronomie

`kind: climate-map`: `baseline: [1961,1990]`, `recent: [1991,2020]`, `nativeResolutionKm: 1`, `displayResolutionKm: 5`, `cells: [{polygon: [[lon,lat],…], baseline, recent}]`. Temperaturen in °C; Polygonkoordinaten in WGS84. Vier Eckpunkte, der Ring wird bei der Darstellung geschlossen. Gemeinsame Herkunftsfelder und Demo-Kennzeichnung gelten ebenfalls.

Die gebündelte Quelldatei verwendet kompaktere Zeilen mit zehn Zahlen: `[lon1,lat1,lon2,lat2,lon3,lat3,lon4,lat4,baseline_C,recent_C]`. `cellFormat` dokumentiert diese Reihenfolge, `sha256` die Originaldateien, `processing` die Aufbereitung. Der Browser entpackt die Zeilen für die UI. Der JSON-Export enthält die lesbaren Zellobjekte; für kleine Geräte sollte ein konkreter Ausschnitt oder ein gerendertes Raster übertragen werden.

Der Wetterexport ergänzt `astronomy: {time, phase, illuminated, waxing, label, source}`. `phase` liegt zwischen 0 und 1 (0 Neumond, 0,5 Vollmond); `illuminated` ist ein Anteil zwischen 0 und 1, kein Prozentwert. Diese astronomische Berechnung nutzt auch bei Demo-Wetter die wirkliche Systemzeit und trägt eine eigene Quellenangabe. Radar-Exporte kennzeichnen Intensität als `mm/h`; modellierte stündliche Niederschlagsmengen verwenden `mm`.


`kind: weather` ergänzt optional `outlook: {model, source, fetchedAt, places: [{id, days: [{date, min, max, rain, probability, code}]}]}`. `date` ist ein Berliner Kalendertag (YYYY-MM-DD), Temperatur in °C, tägliche Regensumme in mm, Wahrscheinlichkeit in Prozent und `code` ein WMO-Wettercode. Der Live-Modellname lautet `ecmwf_ifs025`. 14 Tageswerte werden separat von den `icon_eu`-Stundenreihen gespeichert, ohne zeitliche Interpolation zwischen Modellen. Fehlt die Abfrage, enthält `outlookError` die Fehlerbeschreibung. Bestehende Exporte ohne `outlook` bleiben lesbar.

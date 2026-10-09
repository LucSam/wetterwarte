# Hardware und spätere Veröffentlichung

## Konkrete Displaykandidaten

Die bisherigen drei Kandidaten haben kapazitiven Touch; der ergänzte Joy-IT verwendet resistiven Single-Touch. Die Arbeitsansicht verwendet CSS-Pixel; Originalgröße und Pixelraster rendern stattdessen in nativer Auflösung. Die physische Größe benötigt eine Linealkalibrierung. Keine Simulation der Hardwareleistung.

| Gerät | Display | Geräteprogramm |
| --- | --- | --- |
| [Joy-IT RB-TFT3.5](https://joy-it.net/de/products/RB-TFT3.5) | 3,5″ TFT, 480 × 320, resistiv/XPT2046, 65.536 Farben | Aufsteckdisplay für Raspberry Pi; Browseroberfläche mit angepassten Seiten, Treiber-/Touch-Einrichtung am Pi separat nötig |
| [Waveshare ESP32-S3-Touch-LCD-4.3B-BOX](https://docs.waveshare.com/ESP32-S3-Touch-LCD-4.3B) | 4,3″ IPS-LCD, 800 × 480, 5-Punkt-Touch | Oberfläche später z. B. mit LVGL/C++ neu umsetzen |
| [Pimoroni Presto](https://shop.pimoroni.com/products/presto) | 4″ IPS-LCD, 480 × 480, Touch | Oberfläche später mit MicroPython/PicoGraphics neu umsetzen |
| [Pi 4 + Touch Display 2, 5″](https://www.raspberrypi.com/products/touch-display-2/) | TFT-LCD, 720 × 1280, quer gedreht 1280 × 720, 5-Punkt-Touch | Vorhandene Weboberfläche im lokalen Browser |

**Hintergrund und Energie:** Die genannten Module sind LCDs mit Hintergrundbeleuchtung. Bei gleicher Beleuchtungshelligkeit ist Schwarz kein relevanter Energiesparmodus; die LEDs hinter den dunklen Pixeln leuchten weiter. Deshalb bleibt die Gestaltung hell/neutral. Hintergrundbeleuchtung nachts reduzieren, sofern das Modul dies unterstützt, oder abschalten hilft wesentlich mehr. Ein schwarzer CSS-Hintergrund schont diese LEDs nicht merklich. [LCD/OLED-Unterschied, Samsung Display](https://global.samsungdisplay.com/27598/). Tatsächliche Leistungsaufnahme und Alterung wurden am Gerät nicht gemessen. Die OLED-Frage zu statischen hellen Inhalten betrifft eine andere Displaytechnik.

Geometrische Linien und Datenkurven lassen sich darstellen; entscheidend sind physische Größe und Kontrast. Der Prototyp vermeidet dekorative Haarlinien. Die spätere Schriftgröße und Touchziele müssen am realen Panel geprüft werden. Besonders 1280 × 720 auf 5″ kann eine größere UI-Skalierung benötigen. Für die Presto/ESP32-Fassung bleiben flächige Heatmaps gut geeignet; ein einzelnes Jahr kann als Rechteck gezeichnet werden. Radar-PNG-Decodierung, Kartengröße, HTTPS und Speicherbedarf müssen separat auf der Hardware erprobt werden.

## Spätere Veröffentlichung bei Apple

Für das eigene Tischdisplay ist der App Store nicht erforderlich. Eine öffentliche iPhone/iPad- oder Mac-App ist ein eigenständiger nächster Schritt: App-Paket mit lokalen Webassets oder native Oberfläche, Signierung, Datenschutzangaben, Tests und App Review. Die Zielplattform ist noch offen. Apple verlangt mehr als eine bloß verpackte Website; regionale Klimaauswertung, echte Offline-Nutzung und ein verständlicher Modellvergleich könnten den Nutzen begründen, garantieren aber keine Freigabe. [App Review, insbesondere 4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality).

Das [Apple Developer Program](https://developer.apple.com/programs/) kostet regulär 99 USD pro Jahr bzw. den lokalen Gegenwert. Bei kommerzieller Veröffentlichung braucht auch der verwendete Open-Meteo-Dienst eine passende Nutzungserlaubnis; dessen kostenlose API ist für nichtkommerzielle Nutzung. Datenlizenz und API-Nutzungsbedingungen sind unterschiedliche Dinge. [Open-Meteo-Nutzung](https://open-meteo.com/en/pricing). Der Prototyp bleibt kostenlos und lokal; es wurde keine Veröffentlichung eingerichtet. Zuerst den lokalen Prototyp stabilisieren, danach den zusätzlichen Nutzen einer Store-App bewerten.



## Retina-Vorschau und Joy-IT-Maße · geprüft 08.10.2026

[Hersteller](https://joy-it.net/de/products/RB-TFT3.5) und [Reichelt-Datenblatt](https://cdn-reichelt.de/documents/datenblatt/A300/RB-TFT3.5DATENBLATT_V2.pdf) nennen 480 × 320, 3,5 Zoll und 65.536 Farben. 480:320 ist 3:2 und widerspricht der dortigen Angabe 8:5. Die 85 × 56 mm sind nicht eindeutig die aktive Bildfläche. Die Vorschau nimmt quadratische Pixel an und berechnet aus der Diagonale ca. 74,0 × 49,3 mm (etwa 165 ppi). Diese Größe ist ausdrücklich eine Schätzung; ein bestätigtes Maß der aktiven Fläche würde sie ersetzen.

CSS-Pixel entsprechen auf einem Retina-Mac weder genau einem Hardwarepixel noch einer festen Millimeterlänge. Deshalb rendert die optionale Rasteransicht HTML/SVG zunächst in einen Canvas mit exakt der Zielauflösung, unabhängig von `devicePixelRatio`. Die Joy-IT-Farben werden auf 5 Bit Rot / 6 Bit Grün / 5 Bit Blau quantisiert. Eine Linealkalibrierung bestimmt CSS-Pixel pro Millimeter; die Bildfläche wird damit auf die geschätzte physische Größe skaliert. Alternativ zeigt 2× jeden Zielpixel vergrößert. Originalgröße kann wegen des abweichenden Laptop-Pixelrasters weiterhin Moiré-/Skalierungseffekte haben. Das ist keine Nachbildung der optischen Subpixelstruktur, Panelhelligkeit oder Gamma-Kennlinie.

Diese Vorschau braucht keine neue Abhängigkeit und keinen Server für Screenshots. Die interaktive Weboberfläche liegt unter dem Rasterbild. Browser, die SVG/foreignObject nicht in Canvas zeichnen können, zeigen einen Fehlerhinweis und die skalierte Browseransicht. Informationsdialoge verwenden grundsätzlich die Browserdarstellung. Die Kalibrierung ist monitor- und zoomabhängig und wird lokal gespeichert. 480 × 320 hat nur 40 % der Pixel von 800 × 480; zusätzliche Seiten sind deshalb nötig.

Schrift und Kantenglättung werden vom lokalen Browser erzeugt. Helvetica ist auf dem geprüften Mac verfügbar; auf einem Raspberry Pi hängt die identische Schriftwiedergabe von den dort installierten, entsprechend lizenzierten Schriften ab. Die Vorschau emuliert keine Pi-Schriftrendering-Engine.

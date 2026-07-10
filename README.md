# Asado Pro

Calculadora de asado para Río Gallegos y clima patagónico. Estima carne, chorizos, morcillas, achuras, carbón, leña, bebidas, acompañamientos y escote por persona según cantidad de comensales, corte, escenario de cocción, temperatura y viento.

## Funciones

- Ajuste por quincho, chulengo o fuego a la intemperie.
- Factor térmico por viento, frío y escenario de cocción.
- Desglose opcional por hombres, mujeres y niños.
- Modos de carne: vacuno con hueso, vacuno sin hueso, premium mix, cordero patagónico, cerdo, pollo, vacuno/cerdo y vacuno/pollo.
- Cordero patagónico calculado por medias reses de 6.25 kg.
- Bebidas, hielo, pan, ensaladas, papas, provoleta y salsas calculadas según el grupo.
- Lista de compras editable con progreso, ítems personalizados y categorías.
- Estimación de gastos y costo por persona.
- Pronóstico de parrilla con Open-Meteo: mejor horario, ráfagas, lluvia y alerta de viento.
- Historial local de asados con feedback `sobró / faltó / perfecto` y calibración global.
- Enlace compartible con precios congelados.
- PWA con manifest y service worker para uso offline.

## Gramos de compra y rendimiento por corte

Cada corte compra distinto peso bruto para que lleguen **~520-560 g netos por hombre adulto** al plato, descontando hueso y merma:

| Modo | Rendimiento | Hombre | Mujer | Niño |
| --- | ---: | ---: | ---: | ---: |
| Vacuno sin hueso | 93% | 600 g | 400 g | 200 g |
| Vacuno con hueso | 60% | 880 g | 590 g | 300 g |
| Premium mix | 76% | 720 g | 490 g | 250 g |
| Cordero patagónico | 55% | 950 g | 650 g | 330 g |
| Cerdo | 90% | 620 g | 420 g | 210 g |
| Pollo | 65% | 820 g | 550 g | 280 g |
| Vacuno + cerdo | 84% | 660 g | 450 g | 230 g |
| Vacuno + pollo | 70% | 760 g | 520 g | 260 g |

Las cantidades son de carne cruda (peso de compra). La app muestra los gramos netos por persona en el resultado. El modo cordero redondea la compra a medias reses. La calibración global (`sobró / faltó`) ajusta todo proporcionalmente.

## Deploy

El sitio se publica automáticamente en GitHub Pages al pushear a `main`: el workflow compila con Vite (`GITHUB_PAGES=true`) y despliega `dist/`.

## Desarrollo

```bash
npm install
npm run dev
```

## Validación

```bash
npm run lint
npm run build
```

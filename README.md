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

## Gramos base de carne

| Modo | Hombre | Mujer | Niño |
| --- | ---: | ---: | ---: |
| Todos los modos base | 750 g | 500 g | 250 g |

Las cantidades son de carne cruda. El modo cordero redondea la compra a medias reses.

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
